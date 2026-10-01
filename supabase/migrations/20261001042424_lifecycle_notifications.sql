create table public.account_notifications (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 event_key text not null,title text not null,body text not null,category text not null check(category in ('account','billing','coaching')),
 read_at timestamptz,created_at timestamptz not null default now(),unique(user_id,event_key)
);
alter table public.account_notifications enable row level security;
revoke all on public.account_notifications from public,anon,authenticated;
grant select on public.account_notifications to authenticated;
create policy own_account_notifications on public.account_notifications for select to authenticated using(user_id=(select auth.uid()));
create index account_notifications_recent on public.account_notifications(user_id,created_at desc);
create table public.communication_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 coaching_nudges boolean not null default true,marketing_email boolean not null default false,updated_at timestamptz not null default now()
);
alter table public.communication_preferences enable row level security;
revoke all on public.communication_preferences from public,anon,authenticated;
grant select on public.communication_preferences to authenticated;
create policy own_communication_preferences on public.communication_preferences for select to authenticated using(user_id=(select auth.uid()));
create table physique_private.email_outbox (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 event_key text not null unique,kind text not null,payload jsonb not null,recipient_email text,recipient_name text,
 status text not null default 'pending' check(status in ('pending','sending','sent','failed','suppressed')),
 attempts integer not null default 0,next_attempt_at timestamptz not null default now(),first_attempt_at timestamptz,
 lease_token uuid,lease_until timestamptz,provider_id text unique,delivery_status text,
 error_code text,created_at timestamptz not null default now(),sent_at timestamptz
);
create index email_outbox_due on physique_private.email_outbox(next_attempt_at) where status in ('pending','sending');
create table physique_private.email_suppressions(email text primary key,reason text not null,created_at timestamptz not null default now());
create table physique_private.email_delivery_events(event_key text primary key,provider_id text,event_type text not null,created_at timestamptz not null default now());
revoke all on physique_private.email_outbox,physique_private.email_suppressions,physique_private.email_delivery_events from public,anon,authenticated;

create or replace function physique_private.notify_account(uid uuid,event text,kind text,title text,body text,category text,send_email boolean default true)
returns void language plpgsql security definer set search_path=''
as $$
begin
 insert into public.account_notifications(user_id,event_key,title,body,category) values(uid,event,title,body,category) on conflict(user_id,event_key) do nothing;
 if send_email then
  insert into physique_private.email_outbox(user_id,event_key,kind,payload) values(uid,uid::text||':'||event,kind,jsonb_build_object('title',title,'body',body)) on conflict(event_key) do nothing;
 end if;
end $$;
revoke all on function physique_private.notify_account(uuid,text,text,text,text,text,boolean) from public,anon,authenticated;

create or replace function physique_private.welcome_confirmed_user()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if new.email_confirmed_at is not null and (tg_op='INSERT' or old.email_confirmed_at is null) then
  perform physique_private.notify_account(new.id,'welcome','welcome','Welcome to PhysiqueOS','Your account is ready. Complete your profile, choose one achievable daily goal, and claim your membership invitation if needed. Your first step is to open the app.','account');
 end if;
 return new;
end $$;
revoke all on function physique_private.welcome_confirmed_user() from public,anon,authenticated;
create trigger physiqueos_welcome after insert or update of email_confirmed_at on auth.users for each row execute function physique_private.welcome_confirmed_user();

create or replace function physique_private.subscription_message()
returns trigger language plpgsql security definer set search_path=''
as $$
declare key text:=new.stripe_subscription_id||':'||new.last_event_created::text; message text;
begin
 if new.status='canceled' and (tg_op='INSERT' or old.status is distinct from new.status) then
  perform physique_private.notify_account(new.user_id,key||':ended','membership_ended','Your paid membership has ended','Your subscription is canceled. You can still sign in to export your account records and contact support. Thank you for training with us.','billing');
 elsif new.cancel_at_period_end and (tg_op='INSERT' or not old.cancel_at_period_end) then
  message:='Your cancellation is scheduled for '||coalesce(new.current_period_end::text,'the end of your paid period')||'. You retain paid access until then. You can review lower-cost plans or undo cancellation in Manage billing. Leaving Founding ends its locked rate.';
  perform physique_private.notify_account(new.user_id,key||':cancel_scheduled','cancellation_scheduled','Your cancellation is scheduled',message,'billing');
 elsif tg_op='UPDATE' and old.cancel_at_period_end and not new.cancel_at_period_end and new.status in ('active','trialing') then
  perform physique_private.notify_account(new.user_id,key||':resumed','membership_resumed','Your membership will continue','Your scheduled cancellation has been removed. Review your subscription and next billing date in Manage billing.','billing');
 elsif tg_op='UPDATE' and old.plan_code is distinct from new.plan_code then
  perform physique_private.notify_account(new.user_id,key||':changed','plan_changed','Your membership changed','Your current paid tier is now '||new.plan_code||'. Your saved progress stays with your account. Review the plan and billing details in Manage billing.','billing');
 elsif new.status='past_due' and (tg_op='INSERT' or old.status is distinct from new.status) then
  perform physique_private.notify_account(new.user_id,key||':payment','payment_issue','Please review your payment method','There is a payment issue with your subscription. Open Manage billing to check your invoice and update your payment method.','billing');
 elsif tg_op='INSERT' and new.status in ('active','trialing') then
  perform physique_private.notify_account(new.user_id,key||':active','membership_started','Your membership is active','Your '||new.plan_code||' membership is ready. Open the app to continue your plan.','billing');
 end if;
 return new;
end $$;
revoke all on function physique_private.subscription_message() from public,anon,authenticated;
create trigger physiqueos_subscription_message after insert or update on public.subscriptions for each row execute function physique_private.subscription_message();

create or replace function physique_private.deletion_message()
returns trigger language plpgsql security definer set search_path=''
as $$begin
 perform physique_private.notify_account(new.user_id,'deletion:'||new.id::text,'deletion_requested','Your deletion request is saved','The owner will review your request. Your account remains active until processing is complete. This request does not cancel your subscription; use Manage billing to cancel separately.','account');
 return new;
end $$;
revoke all on function physique_private.deletion_message() from public,anon,authenticated;
create trigger physiqueos_deletion_message after insert on public.account_deletion_requests for each row execute function physique_private.deletion_message();

create or replace function public.read_account_notification(notification_id uuid)
returns void language sql security definer set search_path=''
as $$update public.account_notifications set read_at=coalesce(read_at,now()) where id=notification_id and user_id=auth.uid()$$;
revoke all on function public.read_account_notification(uuid) from public,anon;
grant execute on function public.read_account_notification(uuid) to authenticated;
create or replace function public.set_communication_preferences(nudges boolean,marketing boolean)
returns void language plpgsql security definer set search_path=''
as $$begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 if nudges is null or marketing is null then raise exception 'Preferences required'; end if;
 insert into public.communication_preferences(user_id,coaching_nudges,marketing_email) values(auth.uid(),nudges,marketing)
 on conflict(user_id) do update set coaching_nudges=excluded.coaching_nudges,marketing_email=excluded.marketing_email,updated_at=now();
 insert into public.consent_events(user_id,consent_type,document_version,granted) values(auth.uid(),'marketing','communication-preferences-v1',marketing);
end $$;
revoke all on function public.set_communication_preferences(boolean,boolean) from public,anon;
grant execute on function public.set_communication_preferences(boolean,boolean) to authenticated;

-- Only the server worker can claim deliveries. Leases make concurrent workers safe.
create or replace function public.claim_lifecycle_emails()
returns jsonb language plpgsql security definer set search_path=''
as $$declare result jsonb;
begin
 update physique_private.email_outbox set status='failed',error_code='retry_window_expired' where status in ('pending','sending') and (attempts>=6 or first_attempt_at<now()-interval '23 hours');
 with due as (
  select id from physique_private.email_outbox where (status='pending' and next_attempt_at<=now()) or (status='sending' and lease_until<now()) order by created_at for update skip locked limit 5
 ), claimed as (
  update physique_private.email_outbox e set status='sending',attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,now()),lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes',recipient_email=coalesce(recipient_email,(select email from auth.users where id=e.user_id)),recipient_name=coalesce(recipient_name,(select full_name from public.profiles where user_id=e.user_id),'there')
  from due where e.id=due.id returning e.*
 ) select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('email',c.recipient_email,'name',c.recipient_name,'suppressed',s.email is not null,'confirmed',u.email_confirmed_at is not null and u.email=c.recipient_email)),'[]'::jsonb) into result
 from claimed c join auth.users u on u.id=c.user_id left join physique_private.email_suppressions s on s.email=lower(c.recipient_email);
 return result;
end $$;
revoke all on function public.claim_lifecycle_emails() from public,anon,authenticated;
grant execute on function public.claim_lifecycle_emails() to service_role;
create or replace function public.finish_lifecycle_email(job_id uuid,lease uuid,result_status text,message_id text default null,failure_code text default null)
returns void language plpgsql security definer set search_path=''
as $$begin
 if result_status not in ('sent','pending','failed','suppressed') then raise exception 'Invalid result'; end if;
 update physique_private.email_outbox set status=result_status,provider_id=coalesce(message_id,provider_id),error_code=left(failure_code,80),sent_at=case when result_status='sent' then now() else sent_at end,next_attempt_at=now()+make_interval(secs=>least(3600,60*(2^attempts)::int)),lease_until=null
 where id=job_id and lease_token=lease and status='sending';
end $$;
revoke all on function public.finish_lifecycle_email(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.finish_lifecycle_email(uuid,uuid,text,text,text) to service_role;
create or replace function public.record_lifecycle_delivery(event_id text,message_id text,event_type text,recipients text[])
returns void language plpgsql security definer set search_path=''
as $$begin
 insert into physique_private.email_delivery_events(event_key,provider_id,event_type) values(event_id,message_id,event_type) on conflict(event_key) do nothing;
 if not found then return; end if;
 update physique_private.email_outbox set delivery_status=event_type where provider_id=message_id and (delivery_status is null or delivery_status not in ('email.bounced','email.complained'));
 if event_type in ('email.bounced','email.complained') then
  insert into physique_private.email_suppressions(email,reason) select lower(trim(email)),event_type from unnest(recipients)email on conflict(email) do update set reason=excluded.reason;
 end if;
end $$;
revoke all on function public.record_lifecycle_delivery(text,text,text,text[]) from public,anon,authenticated;
grant execute on function public.record_lifecycle_delivery(text,text,text,text[]) to service_role;

-- Helpful in-app re-engagement only: no unsolicited marketing email and at most one nudge per week.
create or replace function public.queue_retention_nudges()
returns integer language plpgsql security definer set search_path=''
as $$declare member record; total integer:=0;
begin
 for member in select p.user_id from public.profiles p join auth.users u on u.id=p.user_id
 left join public.communication_preferences c on c.user_id=p.user_id
 left join public.user_state_snapshots s on s.user_id=p.user_id
 where p.status='active' and u.email_confirmed_at is not null and coalesce(c.coaching_nudges,true)
 and coalesce(s.updated_at,p.created_at)<now()-interval '7 days'
 and not exists(select 1 from public.account_deletion_requests d where d.user_id=p.user_id and d.status in ('pending','in_progress'))
 loop
  perform physique_private.notify_account(member.user_id,'return:'||to_char(now(),'IYYY-IW'),'return_to_plan','Your next step is ready','Start small: complete one check-in or resume your next session. If your current plan is too demanding, contact support to simplify it.','coaching',false);
  total:=total+1;
 end loop;
 return total;
end $$;
revoke all on function public.queue_retention_nudges() from public,anon,authenticated;
grant execute on function public.queue_retention_nudges() to service_role;
