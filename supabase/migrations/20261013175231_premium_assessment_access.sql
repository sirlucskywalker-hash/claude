-- Extend the existing bounded consent taxonomy for explicitly authorized video processing.
alter table public.consent_events drop constraint consent_events_consent_type_check;
alter table public.consent_events add constraint consent_events_consent_type_check check (consent_type in ('terms','privacy','marketing','health_data','ai_video_processing'));

insert into public.features(code,name,category,description,delivery_status) values
 ('starting_assessment','Written starting assessment','Training','Written baseline and starter-program settings','available'),
 ('guided_posing','Guided posing assessment','Training','Optional front, side and back posing checkpoints; no automated body composition inference','available'),
 ('ai_video_assessment','Premium AI video assessment','Training','Sampled video frames plus movement observations and written baseline; requires review','planned')
on conflict(code) do nothing;
insert into public.plan_features(plan_code,feature_code,enabled,limits)
select p.code,f.code,case f.code when 'starting_assessment' then true when 'guided_posing' then p.code in ('beta','founding','pro','elite','concierge') else p.code in ('elite','concierge') end,
case when f.code='ai_video_assessment' then jsonb_build_object('daily_attempts',case when p.code='concierge' then 6 else 2 end,'clip_seconds',15) else '{}'::jsonb end
from public.plans p cross join public.features f where f.code in ('starting_assessment','guided_posing','ai_video_assessment')
on conflict(plan_code,feature_code) do update set enabled=excluded.enabled,limits=excluded.limits;

create table public.assessment_records (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('posing','ai_video')),
 status text not null check(status in ('recorded','processing','needs_review','failed')),
 input jsonb not null default '{}'::jsonb check(octet_length(input::text)<=10000),
 report jsonb check(report is null or octet_length(report::text)<=20000),
 consent_version text, created_at timestamptz not null default now(), completed_at timestamptz
);
create index assessment_records_user_recent on public.assessment_records(user_id,created_at desc);
alter table public.assessment_records enable row level security;
revoke all on public.assessment_records from public,anon,authenticated;
grant select on public.assessment_records to authenticated;
grant all on public.assessment_records to service_role;
create policy assessment_records_read on public.assessment_records for select to authenticated
using(user_id=(select auth.uid()) or (select public.is_physiqueos_owner()) or public.can_manage_user(user_id));

create or replace function public.record_posing_assessment(views text[],notes text default '')
returns uuid language plpgsql security definer set search_path=''
as $$
declare uid uuid:=auth.uid(); record_id uuid;
begin
 if uid is null or not public.has_feature('guided_posing') then raise exception 'Pro posing access required'; end if;
 if views is null or cardinality(views)<1 or cardinality(views)>3 or not views <@ array['front','side','back']::text[] or array_position(views,null) is not null or notes is null or length(notes)>3000 then raise exception 'Invalid posing checkpoint'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,742));
 if (select count(*) from public.assessment_records where user_id=uid and kind='posing' and created_at>now()-interval '1 day')>=10 then raise exception 'Posing checkpoint limit reached for today'; end if;
 insert into public.assessment_records(user_id,kind,status,input,completed_at)
 values(uid,'posing','recorded',jsonb_build_object('views',views,'notes',notes,'assessment_type','self-reported'),now()) returning id into record_id;
 insert into public.audit_log(actor_user_id,action,entity_type,entity_id) values(uid,'assessment.posing_recorded','assessment_record',record_id::text);
 return record_id;
end $$;
revoke all on function public.record_posing_assessment(text[],text) from public,anon;
grant execute on function public.record_posing_assessment(text[],text) to authenticated;

create or replace function public.reserve_ai_video_assessment(request_id uuid,written jsonb,camera_view text,consent text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare uid uuid:=auth.uid(); existing public.assessment_records; daily_limit integer;
begin
 if uid is null or not (public.has_feature('ai_video_assessment') or public.is_physiqueos_owner()) then raise exception 'Premium AI video access required'; end if;
 if request_id is null or consent is distinct from 'ai-video-v1' or camera_view is null or camera_view not in ('side','front') or jsonb_typeof(written) is distinct from 'object' or octet_length(written::text)>8000 then raise exception 'Invalid video assessment consent or input'; end if;
 if written->>'symptoms' is distinct from 'no' or written->>'pain' is distinct from 'no' or written->>'condition' is distinct from 'no' or written->>'injury' is null or written->>'injury' not in ('none','resolved') or written->>'mobility' is null or written->>'mobility' not in ('comfortable','limited') then raise exception 'Written screening requires review first'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,743));
 select * into existing from public.assessment_records where id=request_id;
 if found then
  if existing.user_id<>uid or existing.kind<>'ai_video' then raise exception 'Assessment request unavailable'; end if;
  return jsonb_build_object('created',false,'status',existing.status,'report',existing.report);
 end if;
 daily_limit:=case when public.current_plan_code()='concierge' then 6 else 2 end;
 if (select count(*) from public.assessment_records where user_id=uid and kind='ai_video' and created_at>now()-interval '1 day')>=daily_limit then raise exception 'AI video daily attempt limit reached'; end if;
 insert into public.assessment_records(id,user_id,kind,status,input,consent_version)
 values(request_id,uid,'ai_video','processing',jsonb_build_object('written',written,'camera_view',camera_view,'method','sampled-frames-and-local-pose'),consent);
 insert into public.consent_events(user_id,consent_type,document_version,granted) values(uid,'ai_video_processing',consent,true);
 insert into public.audit_log(actor_user_id,action,entity_type,entity_id) values(uid,'assessment.ai_video_reserved','assessment_record',request_id::text);
 return jsonb_build_object('created',true,'status','processing');
end $$;
revoke all on function public.reserve_ai_video_assessment(uuid,jsonb,text,text) from public,anon;
grant execute on function public.reserve_ai_video_assessment(uuid,jsonb,text,text) to authenticated;

create or replace function public.owner_data_page(section text, page_offset integer default 0)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare source_sql text; records jsonb; org uuid;
begin
 if not public.is_physiqueos_owner() then raise exception 'Verified PhysiqueOS owner access required'; end if;
 if page_offset is null or page_offset<0 or page_offset>1000000 or page_offset%100<>0 then raise exception 'Invalid owner page offset'; end if;
 if section=any(array['organizations','profiles','memberships','invites','invite_claims','client_profiles','daily_checkins','measurements','progress_photos','meal_plans','training_programs','workout_sessions','coach_notes','billing_customers','subscriptions','entitlements','billing_events','checkout_reservations','consent_events','attribution_events','product_events','audit_log','beta_import_receipts','user_app_state','user_state_snapshots','support_tickets','support_replies','account_deletion_requests','account_notifications','communication_preferences','assessment_records','coach_client_assignments','plans','features','plan_features','plan_catalog']) then
  source_sql:=format('select to_jsonb(t)-''token_hash'' as record from public.%I t',section);
 elsif section='accounts' then
  -- No password hashes, tokens, identity provider credentials or auth internals.
  source_sql:='select jsonb_build_object(''user_id'',id,''email'',email,''email_confirmed_at'',email_confirmed_at,''created_at'',to_jsonb(u)->''created_at'',''last_sign_in_at'',to_jsonb(u)->''last_sign_in_at'',''banned_until'',to_jsonb(u)->''banned_until'') record from auth.users u';
 elsif section='email_outbox' then
  source_sql:='select to_jsonb(t)-''lease_token'' as record from physique_private.email_outbox t';
 elsif section=any(array['email_delivery_events','email_suppressions']) then
  source_sql:=format('select to_jsonb(t) record from physique_private.%I t',section);
 else raise exception 'Unknown owner data section'; end if;
 execute 'select coalesce(jsonb_agg(record order by record::text),''[]''::jsonb) from (select record from ('||source_sql||') source order by record::text limit 101 offset $1) page' into records using page_offset;
 select id into org from public.organizations where slug='physiqueos';
 insert into public.audit_log(organization_id,actor_user_id,action,entity_type,entity_id,after_data)
 values(org,auth.uid(),'owner.data_read','owner_data',section,jsonb_build_object('offset',page_offset));
 return jsonb_build_object('section',section,'offset',page_offset,'rows',case when jsonb_array_length(records)>100 then records-100 else records end,'next_offset',case when jsonb_array_length(records)>100 then page_offset+100 else null end);
end $$;
revoke all on function public.owner_data_page(text,integer) from public,anon;
grant execute on function public.owner_data_page(text,integer) to authenticated;


create or replace function public.export_account_page(section text,page_offset integer default 0)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare uid uuid:=auth.uid(); rows jsonb; condition text; order_column text;
begin
 if uid is null then raise exception 'Sign in first'; end if;
 if page_offset is null or page_offset<0 or page_offset>1000000 then raise exception 'Invalid export offset'; end if;
 if section=any(array['profiles','memberships','client_profiles','daily_checkins','measurements','progress_photos','meal_plans','training_programs','workout_sessions','billing_customers','subscriptions','entitlements','consent_events','attribution_events','product_events','beta_import_receipts','user_state_snapshots','user_app_state','support_tickets','account_deletion_requests','assessment_records','account_notifications','communication_preferences']) then
   condition:='user_id = $1';
   order_column:=case when section in ('profiles','client_profiles','billing_customers','user_state_snapshots','user_app_state','communication_preferences') then 'user_id' else 'id' end;
 elsif section='coach_notes' then condition:='client_user_id = $1 and visibility = ''client'''; order_column:='id';
 elsif section='support_replies' then condition:='ticket_id in (select id from public.support_tickets where user_id = $1)'; order_column:='id';
 else raise exception 'Unknown export section'; end if;
 execute format('select coalesce(jsonb_agg(to_jsonb(x)),''[]''::jsonb) from (select * from public.%I where %s order by %I limit 100 offset $2)x',section,condition,order_column) into rows using uid,page_offset;
 return jsonb_build_object('rows',rows,'next_offset',case when jsonb_array_length(rows)=100 then page_offset+100 else null end);
end $$;
revoke all on function public.export_account_page(text,integer) from public,anon;
grant execute on function public.export_account_page(text,integer) to authenticated;
