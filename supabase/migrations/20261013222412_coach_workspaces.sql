-- Customer coach workspaces never acquire PhysiqueOS staff/owner roles.
create table public.coach_membership_plans (
 code text primary key, name text not null, client_limit integer check(client_limit between 1 and 1000),
 public_enrollment boolean not null default false, monthly_cents integer check(monthly_cents>0),
 included_client_plan text not null default 'core' check(included_client_plan='core'),
 ai_video_included boolean not null default false check(not ai_video_included)
);
insert into public.coach_membership_plans(code,name,client_limit) values
 ('starter','Starter',5),('growth','Growth',15),('professional','Professional',30),('studio','Studio',60),('scale','Scale',100),('enterprise','Enterprise',null);
create table public.coach_workspaces (
 id uuid primary key default gen_random_uuid(),owner_user_id uuid not null unique references auth.users(id) on delete cascade,
 name text not null check(length(name) between 1 and 100),plan_code text not null references public.coach_membership_plans(code),
 status text not null default 'pending' check(status in ('pending','pilot','suspended')),client_limit integer check(client_limit between 1 and 1000),
 access_until timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.coach_workspace_clients (
 workspace_id uuid not null references public.coach_workspaces(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,status text not null check(status in ('active','archived')),
 consent_version text not null,joined_at timestamptz not null default now(),archived_at timestamptz,
 primary key(workspace_id,user_id)
);
create unique index one_active_coach_workspace_per_client on public.coach_workspace_clients(user_id) where status='active';
create table public.coach_workspace_invites (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.coach_workspaces(id) on delete cascade,
 email text not null,token_hash text not null unique,expires_at timestamptz not null,revoked boolean not null default false,
 claimed_by uuid references auth.users(id) on delete set null,claimed_at timestamptz,created_at timestamptz not null default now()
);
create unique index one_pending_coach_invite_email on public.coach_workspace_invites(workspace_id,email) where claimed_at is null and not revoked;
create index coach_invite_capacity on public.coach_workspace_invites(workspace_id,expires_at) where claimed_at is null and not revoked;
create table public.coach_workspace_content (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.coach_workspaces(id) on delete cascade,
 client_user_id uuid references auth.users(id) on delete cascade,kind text not null check(kind in ('training','nutrition','note')),
 visibility text not null check(visibility in ('staff','client')),title text not null check(length(title) between 1 and 120),
 body text not null check(length(body) between 1 and 10000),created_by uuid references auth.users(id) on delete set null,created_at timestamptz not null default now(),
 foreign key(workspace_id,client_user_id) references public.coach_workspace_clients(workspace_id,user_id),
 check(client_user_id is not null or visibility='staff')
);
create index coach_content_client on public.coach_workspace_content(workspace_id,client_user_id,created_at desc);
create table public.coach_workspace_messages (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.coach_workspaces(id) on delete cascade,
 client_user_id uuid not null,author_user_id uuid references auth.users(id) on delete set null,
 body text not null check(length(body) between 1 and 3000),created_at timestamptz not null default now(),
 foreign key(workspace_id,client_user_id) references public.coach_workspace_clients(workspace_id,user_id)
);
create index coach_messages_client on public.coach_workspace_messages(workspace_id,client_user_id,created_at desc);

create or replace function public.can_own_coach_workspace(workspace uuid) returns boolean
 language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (public.is_physiqueos_owner() or exists(select 1 from public.coach_workspaces w where w.id=workspace and w.owner_user_id=auth.uid())); $$;
revoke all on function public.can_own_coach_workspace(uuid) from public,anon;
grant execute on function public.can_own_coach_workspace(uuid) to authenticated;
create or replace function public.can_read_coach_client(workspace uuid,client uuid) returns boolean
 language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (public.can_own_coach_workspace(workspace) or (auth.uid()=client and exists(select 1 from public.coach_workspace_clients c where c.workspace_id=workspace and c.user_id=client))); $$;
revoke all on function public.can_read_coach_client(uuid,uuid) from public,anon;
grant execute on function public.can_read_coach_client(uuid,uuid) to authenticated;

do $$declare t text;begin
 foreach t in array array['coach_membership_plans','coach_workspaces','coach_workspace_clients','coach_workspace_invites','coach_workspace_content','coach_workspace_messages'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
grant select on public.coach_membership_plans to anon,authenticated;
create policy coach_catalog_read on public.coach_membership_plans for select to anon,authenticated using(true);
grant select on public.coach_workspaces,public.coach_workspace_clients,public.coach_workspace_content,public.coach_workspace_messages to authenticated;
create policy coach_workspace_read on public.coach_workspaces for select to authenticated using(public.can_own_coach_workspace(id) or exists(select 1 from public.coach_workspace_clients c where c.workspace_id=id and c.user_id=(select auth.uid())));
create policy coach_client_read on public.coach_workspace_clients for select to authenticated using(public.can_read_coach_client(workspace_id,user_id));
create policy coach_content_read on public.coach_workspace_content for select to authenticated using(public.can_own_coach_workspace(workspace_id) or (visibility='client' and client_user_id=(select auth.uid()) and public.can_read_coach_client(workspace_id,client_user_id)));
create policy coach_message_read on public.coach_workspace_messages for select to authenticated using(public.can_read_coach_client(workspace_id,client_user_id));

create or replace function public.request_coach_workspace(workspace_name text,requested_plan text) returns uuid
 language plpgsql security definer set search_path='' as $$
 declare result uuid;begin
 if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise exception 'Confirmed account required';end if;
 if workspace_name is null or length(btrim(workspace_name)) not between 1 and 100 or not exists(select 1 from public.coach_membership_plans where code=requested_plan) then raise exception 'Choose a workspace name and capacity tier';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,832));
 select id into result from public.coach_workspaces where owner_user_id=auth.uid();if result is not null then return result;end if;
 insert into public.coach_workspaces(owner_user_id,name,plan_code) values(auth.uid(),btrim(workspace_name),requested_plan) returning id into result;
 insert into public.audit_log(actor_user_id,action,entity_type,entity_id) values(auth.uid(),'coach.workspace_requested','coach_workspace',result::text);
 return result;end $$;

create or replace function public.grant_coach_pilot(workspace uuid,tier text,until_time timestamptz,enterprise_limit integer default null) returns void
 language plpgsql security definer set search_path='' as $$
 declare cap integer; occupied integer;begin
 if not public.is_physiqueos_owner() then raise exception 'Verified PhysiqueOS owner access required';end if;
 perform 1 from public.coach_workspaces where id=workspace for update;if not found then raise exception 'Workspace unavailable';end if;
 select client_limit into cap from public.coach_membership_plans where code=tier;if not found then raise exception 'Unknown coach tier';end if;
 if tier='enterprise' then cap:=enterprise_limit;end if;
 if cap is null or cap not between 1 and 1000 or until_time is null or until_time<=now() or until_time>now()+interval '90 days' then raise exception 'Valid capacity and a pilot expiry within 90 days required';end if;
 select (select count(*) from public.coach_workspace_clients where workspace_id=workspace and status='active')+(select count(*) from public.coach_workspace_invites where workspace_id=workspace and claimed_at is null and not revoked and expires_at>now()) into occupied;
 if occupied>cap then raise exception 'Archive clients or revoke invitations before lowering capacity';end if;
 update public.coach_workspaces set plan_code=tier,client_limit=cap,status='pilot',access_until=until_time,updated_at=now() where id=workspace;
 insert into public.audit_log(actor_user_id,action,entity_type,entity_id,after_data) values(auth.uid(),'coach.pilot_granted','coach_workspace',workspace::text,jsonb_build_object('tier',tier,'capacity',cap,'until',until_time));
 end $$;

create or replace function public.create_coach_client_invite(workspace uuid,client_email text) returns text
 language plpgsql security definer set search_path=public,extensions as $$
 declare w public.coach_workspaces; token text;mail text:=lower(btrim(client_email));occupied integer;begin
 if not public.can_own_coach_workspace(workspace) then raise exception 'Workspace owner required';end if;
 select * into w from public.coach_workspaces where id=workspace for update;
 if w.status<>'pilot' or w.access_until is null or w.access_until<=now() then raise exception 'Workspace membership is not active';end if;
 if mail is null or length(mail)>254 or mail !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Valid client email required';end if;
 if exists(select 1 from auth.users where id=w.owner_user_id and lower(email)=mail) then raise exception 'Coach cannot occupy their own client seat';end if;
 update public.coach_workspace_invites set revoked=true where workspace_id=workspace and claimed_at is null and not revoked and expires_at<=now();
 select (select count(*) from public.coach_workspace_clients where workspace_id=workspace and status='active')+(select count(*) from public.coach_workspace_invites where workspace_id=workspace and claimed_at is null and not revoked and expires_at>now()) into occupied;
 if occupied>=w.client_limit then raise exception 'Client capacity reached. Upgrade capacity or free a seat';end if;
 if exists(select 1 from public.coach_workspace_clients c join auth.users u on u.id=c.user_id where c.workspace_id=workspace and c.status='active' and lower(u.email)=mail) then raise exception 'This client is already active in the workspace';end if;
 token:=encode(gen_random_bytes(24),'hex');
 insert into public.coach_workspace_invites(workspace_id,email,token_hash,expires_at) values(workspace,mail,encode(digest(token,'sha256'),'hex'),now()+interval '7 days');
 insert into public.audit_log(actor_user_id,action,entity_type,entity_id) values(auth.uid(),'coach.invite_created','coach_workspace',workspace::text);return token;end $$;

alter table public.consent_events add column context jsonb not null default '{}'::jsonb check(jsonb_typeof(context)='object' and octet_length(context::text)<=2000);
alter table public.consent_events drop constraint consent_events_consent_type_check;
alter table public.consent_events add constraint consent_events_consent_type_check check(consent_type in ('terms','privacy','marketing','health_data','ai_video_processing','coach_data_sharing'));
create or replace function public.preview_coach_client_invite(raw_token text) returns jsonb
 language plpgsql security definer set search_path=public,extensions as $$
 declare inv public.coach_workspace_invites;w public.coach_workspaces;mail text;coach_name text;begin
 if auth.uid() is null or raw_token is null or length(raw_token)<>48 then raise exception 'Sign in with the invited, confirmed account first';end if;
 select email into mail from auth.users where id=auth.uid() and email_confirmed_at is not null;
 select * into inv from public.coach_workspace_invites where token_hash=encode(digest(raw_token,'sha256'),'hex');
 if mail is null or inv.id is null or inv.email<>lower(mail) then raise exception 'Invitation is unavailable for this confirmed account';end if;
 select * into w from public.coach_workspaces where id=inv.workspace_id;
 if w.status<>'pilot' or w.access_until is null or w.access_until<=now() or inv.revoked or inv.expires_at<=now() or (inv.claimed_at is not null and inv.claimed_by<>auth.uid()) then raise exception 'Invitation expired or workspace inactive';end if;
 select full_name into coach_name from public.profiles where user_id=w.owner_user_id;
 return jsonb_build_object('workspace_name',w.name,'coach_name',coalesce(coach_name,w.name),'expires_at',inv.expires_at,'included_client_plan','core');end $$;

create or replace function public.claim_coach_client_invite(raw_token text,consent text) returns jsonb
 language plpgsql security definer set search_path=public,extensions as $$
 declare inv public.coach_workspace_invites;w public.coach_workspaces;mail text;org uuid;begin
 if auth.uid() is null or consent is distinct from 'coach-sharing-v1' or raw_token is null or length(raw_token)<>48 then raise exception 'Confirmed account and explicit coach-sharing consent required';end if;
 select email into mail from auth.users where id=auth.uid() and email_confirmed_at is not null;if mail is null then raise exception 'Confirm your email first';end if;
 select * into inv from public.coach_workspace_invites where token_hash=encode(digest(raw_token,'sha256'),'hex');
 if inv.id is null or inv.email<>lower(mail) then raise exception 'Invitation is unavailable for this account';end if;
 -- Consistent locking order across invite, claim, archive and pilot changes.
 select * into w from public.coach_workspaces where id=inv.workspace_id for update;
 select * into inv from public.coach_workspace_invites where id=inv.id for update;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,833));
 if inv.claimed_by=auth.uid() and exists(select 1 from public.coach_workspace_clients where workspace_id=w.id and user_id=auth.uid() and status='active') then return jsonb_build_object('workspace_id',w.id,'already_claimed',true);end if;
 if w.owner_user_id=auth.uid() or w.status<>'pilot' or w.access_until is null or w.client_limit is null or w.access_until<=now() or inv.revoked or inv.expires_at<=now() or inv.claimed_at is not null then raise exception 'Invitation expired, exhausted or workspace inactive';end if;
 if exists(select 1 from public.coach_workspace_clients where user_id=auth.uid() and status='active') then raise exception 'Leave your current coach workspace before joining another';end if;
 if (select count(*) from public.coach_workspace_clients where workspace_id=w.id and status='active')>=w.client_limit then raise exception 'Client capacity reached';end if;
 insert into public.coach_workspace_clients(workspace_id,user_id,status,consent_version) values(w.id,auth.uid(),'active',consent)
 on conflict(workspace_id,user_id) do update set status='active',consent_version=excluded.consent_version,joined_at=now(),archived_at=null;
 update public.coach_workspace_invites set claimed_by=auth.uid(),claimed_at=now() where id=inv.id;
 select id into org from public.organizations where slug='physiqueos';
 if org is not null then insert into public.memberships(organization_id,user_id,role,status) values(org,auth.uid(),'client','active') on conflict(organization_id,user_id) do nothing;end if;
 insert into public.consent_events(user_id,consent_type,document_version,granted,context) values(auth.uid(),'coach_data_sharing',consent,true,jsonb_build_object('workspace_id',w.id,'coach_user_id',w.owner_user_id));
 insert into public.audit_log(actor_user_id,action,entity_type,entity_id) values(auth.uid(),'coach.invite_claimed','coach_workspace',w.id::text);
 perform physique_private.notify_account(auth.uid(),'coach_join:'||inv.id,'coach_join','Coach workspace joined','Your coach-sponsored client access is active while the workspace membership and your seat remain active.','coaching',false);
 return jsonb_build_object('workspace_id',w.id,'already_claimed',false);end $$;

create or replace function public.archive_coach_client(workspace uuid,client uuid) returns void
 language plpgsql security definer set search_path='' as $$
 begin
 if auth.uid() is null or (auth.uid()<>client and not public.can_own_coach_workspace(workspace)) then raise exception 'Workspace owner or this client required';end if;
 perform 1 from public.coach_workspaces where id=workspace for update;
 update public.coach_workspace_clients set status='archived',archived_at=now() where workspace_id=workspace and user_id=client and status='active';
 if found then
 insert into public.consent_events(user_id,consent_type,document_version,granted,context) values(client,'coach_data_sharing','coach-sharing-v1',false,jsonb_build_object('workspace_id',workspace));
 insert into public.audit_log(actor_user_id,action,entity_type,entity_id) values(auth.uid(),'coach.client_archived','coach_workspace',workspace::text);
 perform physique_private.notify_account(client,'coach_archive:'||workspace||':'||now()::text,'coach_archive','Coach seat archived','Coach-sponsored access and live data sharing have ended. Saved records and any independent membership are preserved.','coaching',false);
 end if;end $$;
create or replace function public.revoke_coach_invite(workspace uuid,invitation uuid) returns void
 language plpgsql security definer set search_path='' as $$begin
 if not public.can_own_coach_workspace(workspace) then raise exception 'Workspace owner required';end if;
 perform 1 from public.coach_workspaces where id=workspace for update;
 update public.coach_workspace_invites set revoked=true where id=invitation and workspace_id=workspace and claimed_at is null and not revoked;
 end $$;

-- Independent subscriptions remain authoritative; sponsorship is a separate Core fallback.
create or replace function public.current_plan_code() returns text language sql stable security definer set search_path='' as $$
 select coalesce((select case when e.source='beta' then 'beta' else case when e.metadata->>'tier' in ('core','founding','pro','elite','concierge','beta') then e.metadata->>'tier' else 'none' end end
 from public.entitlements e where auth.uid() is not null and e.user_id=auth.uid() and e.code='app_access' and e.active and e.starts_at<=now() and (e.ends_at is null or e.ends_at>now())
 order by case e.source when 'stripe' then 1 when 'admin' then 2 when 'beta' then 3 else 4 end,e.created_at desc limit 1),
 (select 'core' from public.coach_workspace_clients c join public.coach_workspaces w on w.id=c.workspace_id where c.user_id=auth.uid() and c.status='active' and w.status='pilot' and w.access_until>now() and w.client_limit is not null limit 1),'none'); $$;

create or replace function public.coach_portal_overview(selected_workspace uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
 declare workspaces jsonb;clients jsonb;invites jsonb;links jsonb;chosen uuid;begin
 if auth.uid() is null then raise exception 'Sign in first';end if;
 select coalesce(jsonb_agg(to_jsonb(w)||jsonb_build_object('active_clients',(select count(*) from public.coach_workspace_clients c where c.workspace_id=w.id and c.status='active'),'reserved_invites',(select count(*) from public.coach_workspace_invites i where i.workspace_id=w.id and i.claimed_at is null and not i.revoked and i.expires_at>now()))),'[]'::jsonb) into workspaces from (select * from public.coach_workspaces where owner_user_id=auth.uid() or public.is_physiqueos_owner() order by created_at desc limit 100) w;
 chosen:=coalesce(selected_workspace,(workspaces->0->>'id')::uuid);
 if chosen is not null and not public.can_own_coach_workspace(chosen) then raise exception 'Workspace owner required';end if;
 select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('name',p.full_name,'email',p.email)),'[]'::jsonb) into clients from (select * from public.coach_workspace_clients where workspace_id=chosen order by status,joined_at desc limit 1000) c left join public.profiles p on p.user_id=c.user_id;
 select coalesce(jsonb_agg(to_jsonb(i)-'token_hash'),'[]'::jsonb) into invites from public.coach_workspace_invites i where i.workspace_id=chosen and i.claimed_at is null and not i.revoked and i.expires_at>now();
 select coalesce(jsonb_agg(jsonb_build_object('workspace_id',w.id,'name',w.name,'status',c.status,'membership_status',w.status,'access_until',w.access_until)),'[]'::jsonb) into links from public.coach_workspace_clients c join public.coach_workspaces w on w.id=c.workspace_id where c.user_id=auth.uid();
 return jsonb_build_object('workspaces',workspaces,'clients',clients,'invites',invites,'client_workspaces',links,'is_owner',public.is_physiqueos_owner());end $$;

create or replace function public.coach_client_detail(workspace uuid,client uuid) returns jsonb
 language plpgsql security definer set search_path='' as $$
 declare saved jsonb;details jsonb;begin
 if not public.can_own_coach_workspace(workspace) or not exists(select 1 from public.coach_workspace_clients c join public.coach_workspaces w on w.id=c.workspace_id where c.workspace_id=workspace and c.user_id=client and c.status='active' and w.status='pilot' and w.access_until>now()) then raise exception 'Active, consented client access required';end if;
 select state into saved from public.user_state_snapshots where user_id=client;
 select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into details from jsonb_each(case when jsonb_typeof(saved->'profile')='object' then saved->'profile' else '{}'::jsonb end) where key in ('name','age','sex','units','heightCm','weight','goalWeight','bf','activity','goal','trainingGoal','days','experience','equipment','injuries','acuteInjury','redFlag','pregnant','edRisk','sessionLength','budget','diet','allergies','exclude','preferredFoods','meals');
 insert into public.audit_log(actor_user_id,action,entity_type,entity_id,after_data) values(auth.uid(),'coach.shared_data_read','coach_workspace',workspace::text,jsonb_build_object('client',client));
 return jsonb_build_object('profile',details,'written_assessment',saved->'startingAssessment'->'answers',
 'checkins',case when jsonb_typeof(saved->'logs')='array' then (select coalesce(jsonb_agg(value),'[]'::jsonb) from (select value from jsonb_array_elements(saved->'logs') with ordinality a(value,n) order by n desc limit 30)x) else '[]'::jsonb end,
 'workouts',case when jsonb_typeof(saved->'workoutLogs')='array' then (select coalesce(jsonb_agg(value),'[]'::jsonb) from (select value from jsonb_array_elements(saved->'workoutLogs') with ordinality a(value,n) order by n desc limit 20)x) else '[]'::jsonb end);
 end $$;

create or replace function public.save_coach_content(workspace uuid,client uuid,content_kind text,content_visibility text,content_title text,content_body text) returns uuid
 language plpgsql security definer set search_path='' as $$declare result uuid;begin
 if not public.can_own_coach_workspace(workspace) then raise exception 'Workspace owner required';end if;
 perform 1 from public.coach_workspaces where id=workspace and status='pilot' and access_until>now() for update;if not found then raise exception 'Workspace membership is not active';end if;
 if client is not null and not exists(select 1 from public.coach_workspace_clients where workspace_id=workspace and user_id=client and status='active') then raise exception 'Active client required';end if;
 if content_kind is null or content_kind not in ('training','nutrition','note') or content_visibility is null or content_visibility not in ('staff','client') or (client is null and content_visibility<>'staff') or content_title is null or length(btrim(content_title)) not between 1 and 120 or content_body is null or length(btrim(content_body)) not between 1 and 10000 then raise exception 'Valid title, content and visibility required';end if;
 if (select count(*) from public.coach_workspace_content where workspace_id=workspace)>=5000 then raise exception 'Workspace content limit reached. Contact support';end if;
 insert into public.coach_workspace_content(workspace_id,client_user_id,kind,visibility,title,body,created_by) values(workspace,client,content_kind,content_visibility,btrim(content_title),btrim(content_body),auth.uid()) returning id into result;
 insert into public.audit_log(actor_user_id,action,entity_type,entity_id) values(auth.uid(),'coach.content_saved','coach_workspace',workspace::text);return result;end $$;

create or replace function public.send_coach_message(workspace uuid,client uuid,message text) returns uuid
 language plpgsql security definer set search_path='' as $$declare result uuid; max_daily integer;begin
 if auth.uid() is null or not public.can_read_coach_client(workspace,client) then raise exception 'Conversation access required';end if;
 perform 1 from public.coach_workspaces where id=workspace and status='pilot' and access_until>now() for update;if not found then raise exception 'Workspace membership is not active';end if;
 if not exists(select 1 from public.coach_workspace_clients where workspace_id=workspace and user_id=client and status='active') or message is null or length(btrim(message)) not between 1 and 3000 then raise exception 'Active client and valid message required';end if;
 max_daily:=case when public.can_own_coach_workspace(workspace) then 500 else 20 end;
 if (select count(*) from public.coach_workspace_messages where workspace_id=workspace and author_user_id=auth.uid() and created_at>now()-interval '1 day')>=max_daily then raise exception 'Daily message limit reached';end if;
 insert into public.coach_workspace_messages(workspace_id,client_user_id,author_user_id,body) values(workspace,client,auth.uid(),btrim(message)) returning id into result;
 insert into public.audit_log(actor_user_id,action,entity_type,entity_id) values(auth.uid(),'coach.message_sent','coach_workspace',workspace::text);return result;end $$;

do $$declare f record;begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('request_coach_workspace','grant_coach_pilot','create_coach_client_invite','claim_coach_client_invite','preview_coach_client_invite','archive_coach_client','revoke_coach_invite','coach_portal_overview','coach_client_detail','save_coach_content','send_coach_message') loop
 execute format('revoke all on function %s from public,anon',f.signature);execute format('grant execute on function %s to authenticated',f.signature);
 end loop;end $$;

create or replace function public.owner_data_page(section text, page_offset integer default 0)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare source_sql text; records jsonb; org uuid;
begin
 if not public.is_physiqueos_owner() then raise exception 'Verified PhysiqueOS owner access required'; end if;
 if page_offset is null or page_offset<0 or page_offset>1000000 or page_offset%100<>0 then raise exception 'Invalid owner page offset'; end if;
 if section=any(array['organizations','profiles','memberships','invites','invite_claims','client_profiles','daily_checkins','measurements','progress_photos','meal_plans','training_programs','workout_sessions','coach_notes','billing_customers','subscriptions','entitlements','billing_events','checkout_reservations','consent_events','attribution_events','product_events','audit_log','beta_import_receipts','user_app_state','user_state_snapshots','support_tickets','support_replies','account_deletion_requests','account_notifications','communication_preferences','assessment_records','coach_membership_plans','coach_workspaces','coach_workspace_clients','coach_workspace_invites','coach_workspace_content','coach_workspace_messages','coach_client_assignments','plans','features','plan_features','plan_catalog']) then
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
 elsif section='coach_workspaces' then condition:='owner_user_id=$1 or id in (select workspace_id from public.coach_workspace_clients where user_id=$1)';order_column:='id';
 elsif section='coach_workspace_clients' then condition:='user_id=$1 or workspace_id in (select id from public.coach_workspaces where owner_user_id=$1)';order_column:='workspace_id';
 elsif section='coach_workspace_invites' then condition:='workspace_id in (select id from public.coach_workspaces where owner_user_id=$1)';order_column:='id';
 elsif section='coach_workspace_content' then condition:='(client_user_id=$1 and visibility=''client'') or workspace_id in (select id from public.coach_workspaces where owner_user_id=$1)';order_column:='id';
 elsif section='coach_workspace_messages' then condition:='client_user_id=$1 or workspace_id in (select id from public.coach_workspaces where owner_user_id=$1)';order_column:='id';
 elsif section='coach_notes' then condition:='client_user_id = $1 and visibility = ''client'''; order_column:='id';
 elsif section='support_replies' then condition:='ticket_id in (select id from public.support_tickets where user_id = $1)'; order_column:='id';
 else raise exception 'Unknown export section'; end if;
 execute format('select coalesce(jsonb_agg(to_jsonb(x)-''token_hash''),''[]''::jsonb) from (select * from public.%I t where %s order by %I,to_jsonb(t)::text limit 100 offset $2)x',section,condition,order_column) into rows using uid,page_offset;
 return jsonb_build_object('rows',rows,'next_offset',case when jsonb_array_length(rows)=100 then page_offset+100 else null end);
end $$;
revoke all on function public.export_account_page(text,integer) from public,anon;
grant execute on function public.export_account_page(text,integer) to authenticated;
