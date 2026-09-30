-- Operational tier access, invitation claims, synchronization and billing transactions.
create schema if not exists physique_private;
revoke all on schema physique_private from public,anon,authenticated;
grant usage on schema physique_private to authenticated,service_role;

alter table public.user_state_snapshots add column if not exists revision bigint not null default 0;
alter table public.subscriptions add column if not exists plan_code text references public.plans(code);
alter table public.subscriptions add column if not exists last_event_created bigint not null default 0;
alter table public.features add column if not exists delivery_status text not null default 'available'
  check(delivery_status in ('available','planned'));
update public.features set delivery_status='planned' where code in ('wearables','form_feedback');
update public.plan_features set enabled=false where feature_code in ('wearables','form_feedback');
insert into public.features(code,name,category,description)
values('advanced_meal_swaps','Advanced meal swaps','Nutrition','Budget-aware substitutions and meal choices')
on conflict(code) do nothing;
insert into public.plan_features(plan_code,feature_code,enabled,limits)
select code,'advanced_meal_swaps',code in ('beta','founding','pro','elite','concierge'),'{}'::jsonb from public.plans
on conflict(plan_code,feature_code) do update set enabled=excluded.enabled;
insert into public.plan_features(plan_code,feature_code,enabled,limits)
select code,'priority_support',code in ('founding','pro','elite','concierge'),'{}'::jsonb from public.plans
on conflict(plan_code,feature_code) do update set enabled=excluded.enabled;
update public.plan_features set limits=jsonb_build_object('review_interval_days',case when plan_code='core' then 30 else 7 end)
where feature_code='nutrition_targets';

create or replace function public.current_plan_code()
returns text language sql stable security definer set search_path=public
as $$
select coalesce((select case when e.source='beta' then 'beta'
  else case when e.metadata->>'tier' in ('core','founding','pro','elite','concierge','beta') then e.metadata->>'tier' else 'none' end end
from public.entitlements e
where auth.uid() is not null and e.user_id=auth.uid() and e.code='app_access'
and e.active and e.starts_at<=now() and (e.ends_at is null or e.ends_at>now())
order by case e.source when 'stripe' then 1 when 'admin' then 2 when 'beta' then 3 else 4 end,e.created_at desc limit 1),'none')
$$;
revoke all on function public.current_plan_code() from public,anon;
grant execute on function public.current_plan_code() to authenticated,service_role;
create or replace function public.has_feature(feature text)
returns boolean language sql stable security definer set search_path=public
as $$select auth.uid() is not null and exists(select 1 from public.plan_features pf join public.features f on f.code=pf.feature_code
where pf.plan_code=public.current_plan_code() and pf.feature_code=feature and pf.enabled and f.delivery_status='available')$$;
revoke all on function public.has_feature(text) from public,anon;
grant execute on function public.has_feature(text) to authenticated,service_role;

create table public.invite_claims(
invite_id uuid references public.invites(id) on delete cascade,
user_id uuid references auth.users(id) on delete cascade,
claimed_at timestamptz not null default now(),primary key(invite_id,user_id));
alter table public.invite_claims enable row level security;
revoke all on public.invite_claims from anon,authenticated;
grant select on public.invite_claims to authenticated;
create policy own_invite_claims on public.invite_claims for select to authenticated using(user_id=(select auth.uid()));

create or replace function public.claim_invite(raw_token text)
returns jsonb language plpgsql security definer set search_path=public,extensions
as $$
declare inv public.invites%rowtype; uid uuid:=auth.uid(); mail text;
begin
if uid is null then raise exception 'Authentication required'; end if;
select email into mail from auth.users where id=uid and email_confirmed_at is not null;
if mail is null then raise exception 'Confirm your email first'; end if;
select * into inv from public.invites where token_hash=encode(digest(raw_token,'sha256'),'hex') for update;
if inv.id is null then raise exception 'Invalid invitation'; end if;
if inv.email is not null and lower(inv.email)<>lower(mail) then raise exception 'Invitation belongs to another email'; end if;
if exists(select 1 from public.invite_claims where invite_id=inv.id and user_id=uid) then
return jsonb_build_object('ok',true,'already_claimed',true); end if;
if (inv.expires_at is not null and inv.expires_at<=now()) or inv.uses>=inv.max_uses then raise exception 'Invite expired or exhausted'; end if;
insert into public.memberships(organization_id,user_id,role,status) values(inv.organization_id,uid,inv.role,'active')
on conflict(organization_id,user_id) do nothing;
insert into public.invite_claims(invite_id,user_id) values(inv.id,uid);
update public.invites set uses=uses+1,claimed_by=case when max_uses=1 then uid else claimed_by end,
claimed_at=case when max_uses=1 then now() else claimed_at end where id=inv.id;
if inv.role='client' then
insert into public.entitlements(user_id,code,source,active,metadata)
values(uid,'app_access','beta',true,jsonb_build_object('invite_id',inv.id,'tier','beta'))
on conflict(user_id,code,source) do update set active=true,ends_at=null,metadata=excluded.metadata;
end if;
insert into public.attribution_events(user_id,invite_id,event_name,source,campaign,landing_path)
values(uid,inv.id,'invite.claimed',inv.source,inv.campaign,'invite');
insert into public.audit_log(organization_id,actor_user_id,action,entity_type,entity_id)
values(inv.organization_id,uid,'invite.claimed','invite',inv.id::text);
return jsonb_build_object('ok',true,'role',inv.role,'organization_id',inv.organization_id);
end;$$;
revoke all on function public.claim_invite(text) from public,anon;
grant execute on function public.claim_invite(text) to authenticated;

create or replace function public.create_beta_invite(org uuid,invite_email text default null)
returns text language plpgsql security definer set search_path=public,extensions
as $$
declare token text; iid uuid;
begin
if auth.uid() is null or not public.has_org_role(org,array['owner','admin']) then raise exception 'Admin access required'; end if;
token:=encode(gen_random_bytes(24),'hex');
insert into public.invites(organization_id,token_hash,email,role,expires_at,max_uses,created_by,campaign,source)
values(org,encode(digest(token,'sha256'),'hex'),nullif(trim(invite_email),''),'client',now()+interval '14 days',1,auth.uid(),'beta','owner-dashboard')
returning id into iid;
insert into public.audit_log(organization_id,actor_user_id,action,entity_type,entity_id)
values(org,auth.uid(),'invite.created','invite',iid::text);
return token;
end;$$;
revoke all on function public.create_beta_invite(uuid,text) from public,anon;
grant execute on function public.create_beta_invite(uuid,text) to authenticated;

create table public.support_tickets(
id uuid primary key default gen_random_uuid(),
user_id uuid not null references auth.users(id) on delete cascade,
subject text not null check(length(subject) between 1 and 160),
body text not null check(length(body) between 1 and 10000),
priority text not null default 'standard' check(priority in ('standard','priority','concierge')),
status text not null default 'open' check(status in ('open','in_progress','resolved')),
created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.support_replies(
id uuid primary key default gen_random_uuid(),
ticket_id uuid not null references public.support_tickets(id) on delete cascade,
author_user_id uuid not null references auth.users(id),
body text not null check(length(body) between 1 and 10000),
created_at timestamptz not null default now());
alter table public.support_tickets enable row level security;
alter table public.support_replies enable row level security;
revoke all on public.support_tickets,public.support_replies from anon,authenticated;
grant select on public.support_tickets,public.support_replies to authenticated;
create policy tickets_read on public.support_tickets for select to authenticated using(user_id=auth.uid() or public.can_manage_user(user_id));
create policy replies_read on public.support_replies for select to authenticated using(exists(select 1 from public.support_tickets t where t.id=ticket_id and (t.user_id=auth.uid() or public.can_manage_user(t.user_id))));
create or replace function public.open_support_ticket(subject text,body text)
returns uuid language plpgsql security definer set search_path=public
as $$
declare tid uuid; pri text; org uuid;
begin
if auth.uid() is null then raise exception 'Authentication required'; end if;
pri:=case when public.has_feature('concierge_messaging') then 'concierge' when public.has_feature('priority_support') then 'priority' else 'standard' end;
insert into public.support_tickets(user_id,subject,body,priority) values(auth.uid(),subject,body,pri) returning id into tid;
select id into org from public.organizations where slug='physiqueos';
insert into public.memberships(organization_id,user_id,role,status) values(org,auth.uid(),'client','active') on conflict(organization_id,user_id) do nothing;
return tid;
end;$$;
revoke all on function public.open_support_ticket(text,text) from public,anon;
grant execute on function public.open_support_ticket(text,text) to authenticated;
create or replace function public.reply_support_ticket(ticket uuid,message text,new_status text default 'in_progress')
returns uuid language plpgsql security definer set search_path=public
as $$
declare uid uuid; rid uuid;
begin
select user_id into uid from public.support_tickets where id=ticket;
if auth.uid() is null or not public.can_manage_user(uid) then raise exception 'Staff access required'; end if;
insert into public.support_replies(ticket_id,author_user_id,body) values(ticket,auth.uid(),message) returning id into rid;
update public.support_tickets set status=new_status,updated_at=now() where id=ticket;
insert into public.audit_log(actor_user_id,action,entity_type,entity_id) values(auth.uid(),'support.replied','support_ticket',ticket::text);
return rid;
end;$$;
revoke all on function public.reply_support_ticket(uuid,text,text) from public,anon;
grant execute on function public.reply_support_ticket(uuid,text,text) to authenticated;

create or replace function public.sync_app_state(payload jsonb,expected_revision bigint)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare uid uuid:=auth.uid(); saved public.user_state_snapshots%rowtype;
begin
if uid is null or public.current_plan_code()='none' then raise exception 'Membership required'; end if;
if jsonb_typeof(payload)<>'object' or octet_length(payload::text)>2000000 then raise exception 'Invalid or oversized state'; end if;
perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
select * into saved from public.user_state_snapshots where user_id=uid for update;
if coalesce(saved.revision,0)<>expected_revision then return jsonb_build_object('conflict',true,'revision',saved.revision,'updated_at',saved.updated_at,'state',saved.state); end if;
insert into public.user_state_snapshots(user_id,state,client_version,updated_at,revision)
values(uid,payload,'web-tiers-3',now(),expected_revision+1)
on conflict(user_id) do update set state=excluded.state,updated_at=excluded.updated_at,revision=excluded.revision,client_version=excluded.client_version
returning * into saved;
return jsonb_build_object('conflict',false,'revision',saved.revision,'updated_at',saved.updated_at);
end;$$;
revoke all on function public.sync_app_state(jsonb,bigint) from public,anon;
grant execute on function public.sync_app_state(jsonb,bigint) to authenticated;
revoke insert,update,delete on public.user_state_snapshots from anon,authenticated;

create table public.checkout_reservations(
id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
plan_code text not null references public.plans(code),stripe_session_id text unique,
state text not null default 'reserved' check(state in ('reserved','redeemed','expired')),
expires_at timestamptz not null default now()+interval '35 minutes',
created_at timestamptz not null default now());
alter table public.checkout_reservations enable row level security;
revoke all on public.checkout_reservations from anon,authenticated;
create or replace function public.reserve_checkout(target_user uuid,tier text)
returns uuid language plpgsql security definer set search_path=public
as $$
declare rid uuid; cap int;
begin
perform pg_advisory_xact_lock(hashtextextended('checkout:'||tier,0));
if not exists(select 1 from public.plan_catalog where code=tier and public) then raise exception 'This tier is not open for enrollment'; end if;
if exists(select 1 from public.subscriptions where user_id=target_user and status in ('active','trialing','past_due','incomplete')) then raise exception 'Manage your existing subscription in billing'; end if;
if tier='founding' and exists(select 1 from public.checkout_reservations where user_id=target_user and plan_code=tier and state='redeemed') then raise exception 'Founding rate ends when canceled'; end if;
update public.checkout_reservations set state='expired' where state='reserved' and expires_at<=now();
if exists(select 1 from public.checkout_reservations where user_id=target_user and state='reserved') then raise exception 'A checkout is already pending; use it or wait 35 minutes'; end if;
cap:=case when tier='founding' then 100 else null end;
if cap is not null and (select count(*) from public.checkout_reservations where plan_code=tier and state in ('reserved','redeemed'))>=cap then raise exception 'Founding 100 is full'; end if;
-- Concierge remains closed until a delivery cadence and explicit seat cap are configured.
if tier='concierge' then raise exception 'Concierge enrollment requires staff intake'; end if;
insert into public.checkout_reservations(user_id,plan_code) values(target_user,tier) returning id into rid;
return rid;
end;$$;
revoke all on function public.reserve_checkout(uuid,text) from public,anon,authenticated;
grant execute on function public.reserve_checkout(uuid,text) to service_role;

create or replace function public.record_billing_subscription(event_id text,event_type text,event_created bigint,event_payload jsonb,sub jsonb)
returns void language plpgsql security definer set search_path=public
as $$
declare uid uuid; tier text; existing_stamp bigint; active boolean; org uuid; sid text:=sub->>'id';
begin
if sid is null then raise exception 'Missing subscription'; end if;
perform pg_advisory_xact_lock(hashtextextended(sid,0));
if exists(select 1 from public.billing_events where stripe_event_id=event_id and processed_at is not null) then return; end if;
select user_id into uid from public.billing_customers where stripe_customer_id=sub->>'customer';
if uid is null then raise exception 'Unknown billing customer'; end if;
select code into tier from public.plan_catalog where stripe_monthly_price_id=sub->>'price_id' or stripe_annual_price_id=sub->>'price_id';
if tier is null then raise exception 'Unknown price'; end if;
select last_event_created into existing_stamp from public.subscriptions where stripe_subscription_id=sid;
insert into public.billing_events(stripe_event_id,event_type,payload) values(event_id,event_type,event_payload)
on conflict(stripe_event_id) do nothing;
if coalesce(existing_stamp,0)>event_created then
update public.billing_events set processed_at=now(),error=null where stripe_event_id=event_id; return; end if;
insert into public.subscriptions(user_id,stripe_subscription_id,stripe_price_id,status,current_period_start,current_period_end,cancel_at_period_end,trial_end,plan_code,last_event_created)
values(uid,sid,sub->>'price_id',sub->>'status',(sub->>'period_start')::timestamptz,(sub->>'period_end')::timestamptz,
(sub->>'cancel_at_period_end')::boolean,(sub->>'trial_end')::timestamptz,tier,event_created)
on conflict(stripe_subscription_id) do update set status=excluded.status,stripe_price_id=excluded.stripe_price_id,
current_period_start=excluded.current_period_start,current_period_end=excluded.current_period_end,
cancel_at_period_end=excluded.cancel_at_period_end,trial_end=excluded.trial_end,plan_code=excluded.plan_code,last_event_created=excluded.last_event_created,updated_at=now();
select id into org from public.organizations where slug='physiqueos';
insert into public.memberships(organization_id,user_id,role,status) values(org,uid,'client','active') on conflict(organization_id,user_id) do nothing;
-- Resolve across all subscriptions so an old cancellation cannot revoke a newer subscription.
select s.plan_code into tier from public.subscriptions s where s.user_id=uid and s.status in ('active','trialing') and s.current_period_end>now() order by s.updated_at desc limit 1;
active:=tier is not null;
insert into public.entitlements(user_id,code,source,active,ends_at,metadata)
values(uid,'app_access','stripe',active,
(select max(current_period_end) from public.subscriptions where user_id=uid and status in ('active','trialing')),
jsonb_build_object('tier',tier,'stripe_subscription_id',sid))
on conflict(user_id,code,source) do update set active=excluded.active,ends_at=excluded.ends_at,metadata=excluded.metadata;
if active then
update public.checkout_reservations set state='redeemed' where user_id=uid and plan_code=tier and state='reserved';
end if;
insert into public.audit_log(organization_id,actor_user_id,action,entity_type,entity_id,after_data)
values(org,null,'billing.subscription_synced','subscription',sid,jsonb_build_object('status',sub->>'status','tier',tier));
update public.billing_events set processed_at=now(),error=null where stripe_event_id=event_id;
end;$$;
revoke all on function public.record_billing_subscription(text,text,bigint,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.record_billing_subscription(text,text,bigint,jsonb,jsonb) to service_role;

-- Project snapshot records into the normalized reporting tables in the same transaction.
create or replace function physique_private.number_value(value text)
returns numeric language sql immutable set search_path=pg_catalog
as $$select case when value ~ '^-?[0-9]+([.][0-9]+)?$' then value::numeric else null end$$;
revoke all on function physique_private.number_value(text) from public,anon,authenticated;

alter table public.workout_sessions add column if not exists client_entry_key text;
create unique index if not exists workout_client_entry on public.workout_sessions(user_id,client_entry_key);
create or replace function physique_private.project_snapshot()
returns trigger language plpgsql security definer set search_path=public,physique_private
as $$
declare org uuid; p jsonb:=new.state->'profile'; entry jsonb; n int:=0;
begin
select id into org from public.organizations where slug='physiqueos';
if org is null then raise exception 'Organization not configured'; end if;
insert into public.memberships(organization_id,user_id,role,status) values(org,new.user_id,'client','active')
on conflict(organization_id,user_id) do nothing;
if jsonb_typeof(p)='object' then
update public.profiles set full_name=coalesce(nullif(p->>'name',''),full_name),timezone=coalesce(new.state->>'timezone',timezone),updated_at=now() where user_id=new.user_id;
insert into public.client_profiles(user_id,organization_id,sex,height_cm,starting_weight_kg,goal_weight_kg,body_fat_pct,goal,aggressiveness,experience,activity_level,training_days,meals_per_day,food_budget_weekly,postal_code,preferred_stores,diet_restrictions,foods_avoid,injuries_limitations,equipment,onboarding_complete,updated_at)
values(new.user_id,org,p->>'sex',number_value(p->>'heightCm'),number_value(p->>'weight')/2.20462,number_value(p->>'goalWeight')/2.20462,
number_value(p->>'bf'),p->>'goal',p->>'aggr',p->>'experience',number_value(p->>'activity'),
number_value(p->>'days')::int,number_value(p->>'meals')::int,number_value(p->>'budget'),p->>'zip',
string_to_array(p->>'stores',','),string_to_array(p->>'diet',','),string_to_array(p->>'exclude',','),p->>'injuries',
case when jsonb_typeof(p->'equipment')='array' then array(select jsonb_array_elements_text(p->'equipment')) else '{}'::text[] end,
coalesce(number_value(p->>'age')>0 and number_value(p->>'weight')>0 and number_value(p->>'heightCm')>0,false),now())
on conflict(user_id) do update set sex=excluded.sex,height_cm=excluded.height_cm,goal_weight_kg=excluded.goal_weight_kg,body_fat_pct=excluded.body_fat_pct,goal=excluded.goal,
aggressiveness=excluded.aggressiveness,experience=excluded.experience,activity_level=excluded.activity_level,training_days=excluded.training_days,meals_per_day=excluded.meals_per_day,
food_budget_weekly=excluded.food_budget_weekly,postal_code=excluded.postal_code,preferred_stores=excluded.preferred_stores,diet_restrictions=excluded.diet_restrictions,foods_avoid=excluded.foods_avoid,
injuries_limitations=excluded.injuries_limitations,equipment=excluded.equipment,onboarding_complete=excluded.onboarding_complete,updated_at=now();
end if;
if jsonb_typeof(new.state->'logs')='array' then
for entry in select value from jsonb_array_elements(new.state->'logs') loop
if entry->>'date' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
insert into public.daily_checkins(user_id,organization_id,checkin_date,weight_kg,steps,water_ml,sleep_hours,calories,adherence_pct,hunger,energy,stress,notes)
values(new.user_id,org,(entry->>'date')::date,number_value(entry->>'weight')/2.20462,number_value(entry->>'steps')::int,
round(number_value(entry->>'water')*29.5735)::int,number_value(entry->>'sleep'),number_value(entry->>'calories')::int,
number_value(entry->>'adherence'),number_value(entry->>'hunger')::int,number_value(entry->>'energy')::int,number_value(entry->>'stress')::int,entry->>'notes')
on conflict(user_id,checkin_date) do update set weight_kg=excluded.weight_kg,steps=excluded.steps,water_ml=excluded.water_ml,sleep_hours=excluded.sleep_hours,
calories=excluded.calories,adherence_pct=excluded.adherence_pct,hunger=excluded.hunger,energy=excluded.energy,stress=excluded.stress,notes=excluded.notes;
insert into public.measurements(user_id,organization_id,measured_at,waist_cm,neck_cm,shoulders_cm,chest_cm,arm_left_cm,arm_right_cm,hips_cm,thigh_left_cm,thigh_right_cm,calf_left_cm,calf_right_cm)
values(new.user_id,org,(entry->>'date')::date,number_value(entry->>'waist')*2.54,number_value(entry->>'neck')*2.54,number_value(entry->>'shoulders')*2.54,number_value(entry->>'chest')*2.54,
number_value(entry->>'armL')*2.54,number_value(entry->>'armR')*2.54,number_value(entry->>'hips')*2.54,number_value(entry->>'thighL')*2.54,number_value(entry->>'thighR')*2.54,
number_value(entry->>'calfL')*2.54,number_value(entry->>'calfR')*2.54)
on conflict(user_id,measured_at) do update set waist_cm=excluded.waist_cm,neck_cm=excluded.neck_cm,shoulders_cm=excluded.shoulders_cm,chest_cm=excluded.chest_cm,
arm_left_cm=excluded.arm_left_cm,arm_right_cm=excluded.arm_right_cm,hips_cm=excluded.hips_cm,thigh_left_cm=excluded.thigh_left_cm,thigh_right_cm=excluded.thigh_right_cm,
calf_left_cm=excluded.calf_left_cm,calf_right_cm=excluded.calf_right_cm;
end if;
end loop;
end if;
if jsonb_typeof(new.state->'workoutLogs')='array' then
for entry in select value from jsonb_array_elements(new.state->'workoutLogs') loop
n:=n+1;
if entry->>'date' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
insert into public.workout_sessions(user_id,organization_id,performed_at,session,rpe,notes,client_entry_key)
values(new.user_id,org,(entry->>'date')::date,entry,number_value(entry->>'sessionRpe'),entry->>'notes',coalesce(entry->>'id',n::text||':'||(entry->>'date')||':'||(entry->>'workout')))
on conflict(user_id,client_entry_key) do update set session=excluded.session,rpe=excluded.rpe,notes=excluded.notes;
end if;
end loop;
end if;
return new;
end;$$;
revoke all on function physique_private.project_snapshot() from public,anon,authenticated;
create trigger project_snapshot after insert or update of state on public.user_state_snapshots
for each row execute function physique_private.project_snapshot();
