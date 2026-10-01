create table public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check(status in ('pending','in_progress','completed','canceled')),
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index one_open_deletion_request on public.account_deletion_requests(user_id) where status in ('pending','in_progress');
alter table public.account_deletion_requests enable row level security;
revoke all on public.account_deletion_requests from anon,authenticated;
grant select on public.account_deletion_requests to authenticated;
create policy deletion_requests_read on public.account_deletion_requests for select to authenticated using(user_id=(select auth.uid()) or public.can_manage_user(user_id));
create or replace function public.request_account_deletion()
returns uuid language plpgsql security definer set search_path=''
as $$
declare uid uuid:=auth.uid(); request_id uuid;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,731));
  select id into request_id from public.account_deletion_requests where user_id=uid and status in ('pending','in_progress');
  if request_id is not null then return request_id; end if;
  insert into public.account_deletion_requests(user_id) values(uid) returning id into request_id;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id) values(uid,'account.deletion_requested','account_deletion_request',request_id::text);
  return request_id;
end $$;
revoke all on function public.request_account_deletion() from public,anon;
grant execute on function public.request_account_deletion() to authenticated;
-- Own-account exports work without paid membership. Never export internal notes or raw billing webhooks.
create or replace function public.export_account_page(section text,page_offset integer default 0)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare uid uuid:=auth.uid(); rows jsonb; condition text; order_column text;
begin
 if uid is null then raise exception 'Sign in first'; end if;
 if page_offset is null or page_offset<0 or page_offset>1000000 then raise exception 'Invalid export offset'; end if;
 if section=any(array['profiles','memberships','client_profiles','daily_checkins','measurements','progress_photos','meal_plans','training_programs','workout_sessions','billing_customers','subscriptions','entitlements','consent_events','attribution_events','product_events','beta_import_receipts','user_state_snapshots','user_app_state','support_tickets','account_deletion_requests','account_notifications','communication_preferences']) then
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
alter table public.progress_photos add constraint progress_photo_owner_path check(split_part(storage_path,'/',1)=user_id::text) not valid;
