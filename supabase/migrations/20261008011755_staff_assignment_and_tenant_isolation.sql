-- Additive assignment model; no existing user or wellness records are deleted.
create table public.coach_client_assignments (
 organization_id uuid not null references public.organizations(id) on delete cascade,
 coach_user_id uuid not null,
 client_user_id uuid not null,
 active boolean not null default true,
 assigned_by uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now(),
 primary key(organization_id,coach_user_id,client_user_id),
 foreign key(organization_id,coach_user_id) references public.memberships(organization_id,user_id) on delete cascade,
 foreign key(organization_id,client_user_id) references public.memberships(organization_id,user_id) on delete cascade,
 check(coach_user_id<>client_user_id)
);
create index assignments_client_lookup on public.coach_client_assignments(client_user_id,organization_id) where active;
alter table public.coach_client_assignments enable row level security;
revoke all on public.coach_client_assignments from public,anon,authenticated;
grant select on public.coach_client_assignments to authenticated;
grant all on public.coach_client_assignments to service_role;
create policy assignments_read on public.coach_client_assignments for select to authenticated
 using(coach_user_id=(select auth.uid()) or client_user_id=(select auth.uid()) or public.has_org_role(organization_id,array['owner','admin']));

create or replace function public.can_access_client(org uuid,target uuid) returns boolean
 language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists (
  select 1 from public.memberships mine join public.memberships theirs on theirs.organization_id=mine.organization_id
  where mine.organization_id=org and mine.user_id=auth.uid() and mine.status='active'
   and theirs.user_id=target and theirs.status='active'
   and (mine.role in ('owner','admin') or (mine.role='coach' and theirs.role='client' and exists(
    select 1 from public.coach_client_assignments a where a.organization_id=org and a.coach_user_id=mine.user_id and a.client_user_id=target and a.active)))
 ); $$;
revoke all on function public.can_access_client(uuid,uuid) from public,anon;
grant execute on function public.can_access_client(uuid,uuid) to authenticated,service_role;

create or replace function public.can_manage_user(target uuid) returns boolean
 language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.memberships m where m.user_id=target and m.status='active' and public.can_access_client(m.organization_id,target)); $$;
revoke all on function public.can_manage_user(uuid) from public,anon;
grant execute on function public.can_manage_user(uuid) to authenticated,service_role;

create or replace function public.can_admin_user(target uuid) returns boolean
 language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.memberships mine join public.memberships theirs using(organization_id)
 where mine.user_id=auth.uid() and mine.status='active' and mine.role in ('owner','admin') and theirs.user_id=target and theirs.status='active'); $$;
revoke all on function public.can_admin_user(uuid) from public,anon;
grant execute on function public.can_admin_user(uuid) to authenticated,service_role;

create or replace function public.set_coach_assignment(org uuid,coach uuid,client uuid,grant_access boolean) returns void
 language plpgsql security definer set search_path='' as $$
 begin
 if auth.uid() is null or not public.has_org_role(org,array['owner','admin']) then raise exception 'Owner or admin access required'; end if;
 if grant_access is null or coach is null or client is null or coach=client then raise exception 'Valid assignment required'; end if;
 if grant_access then
  if not exists(select 1 from public.memberships where organization_id=org and user_id=coach and role='coach' and status='active')
   or not exists(select 1 from public.memberships where organization_id=org and user_id=client and role='client' and status='active') then raise exception 'Active coach and client must belong to this organization'; end if;
  insert into public.coach_client_assignments(organization_id,coach_user_id,client_user_id,assigned_by)
   values(org,coach,client,auth.uid()) on conflict(organization_id,coach_user_id,client_user_id)
   do update set active=true,assigned_by=auth.uid(),updated_at=now() where not coach_client_assignments.active;
 else
  update public.coach_client_assignments set active=false,assigned_by=auth.uid(),updated_at=now()
   where organization_id=org and coach_user_id=coach and client_user_id=client and active;
 end if;
 if found then insert into public.audit_log(organization_id,actor_user_id,action,entity_type,entity_id,after_data)
 values(org,auth.uid(),case when grant_access then 'coach.assigned' else 'coach.unassigned' end,'coach_assignment',client::text,jsonb_build_object('coach_user_id',coach,'active',grant_access)); end if;
 end; $$;
revoke all on function public.set_coach_assignment(uuid,uuid,uuid,boolean) from public,anon;
grant execute on function public.set_coach_assignment(uuid,uuid,uuid,boolean) to authenticated;

-- Replace all permissive policies on wellness tables so old policies cannot OR around the checks.
do $$declare t text; p record; staff_write boolean;
begin
 foreach t in array array['client_profiles','daily_checkins','measurements','progress_photos','meal_plans','training_programs','workout_sessions'] loop
  for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
   execute format('drop policy %I on public.%I',p.policyname,t);
  end loop;
  execute format('create policy scoped_read on public.%I for select to authenticated using(user_id=(select auth.uid()) or public.can_access_client(organization_id,user_id))',t);
  staff_write:=t in ('meal_plans','training_programs');
  execute format('create policy scoped_write on public.%I for all to authenticated using ((user_id=(select auth.uid()) and public.is_org_member(organization_id)) %s) with check ((user_id=(select auth.uid()) and public.is_org_member(organization_id)) %s)',t,
   case when staff_write then 'or public.can_access_client(organization_id,user_id)' else '' end,
   case when staff_write then 'or public.can_access_client(organization_id,user_id)' else '' end);
 end loop;
end $$;

drop policy memberships_member_select on public.memberships;
create policy memberships_scoped_select on public.memberships for select to authenticated
 using(user_id=(select auth.uid()) or public.has_org_role(organization_id,array['owner','admin']) or public.can_access_client(organization_id,user_id));

drop policy coachnotes_read on public.coach_notes;
drop policy coachnotes_staff_write on public.coach_notes;
create policy coachnotes_scoped_read on public.coach_notes for select to authenticated
 using((client_user_id=(select auth.uid()) and visibility='client') or public.can_access_client(organization_id,client_user_id));
create policy coachnotes_scoped_insert on public.coach_notes for insert to authenticated
 with check(public.can_access_client(organization_id,client_user_id) and author_user_id=(select auth.uid()));
create policy coachnotes_scoped_update on public.coach_notes for update to authenticated
 using(public.can_access_client(organization_id,client_user_id) and author_user_id=(select auth.uid()))
 with check(public.can_access_client(organization_id,client_user_id) and author_user_id=(select auth.uid()));
create policy coachnotes_scoped_delete on public.coach_notes for delete to authenticated
 using(public.can_access_client(organization_id,client_user_id) and (author_user_id=(select auth.uid()) or public.has_org_role(organization_id,array['owner','admin'])));

-- Coaching assignment does not grant financial, consent, or deletion administration.
do $$declare t text; p record;
begin
 foreach t in array array['billing_customers','subscriptions','entitlements','consent_events','account_deletion_requests'] loop
  for p in select policyname from pg_policies where schemaname='public' and tablename=t and cmd='SELECT' loop
   execute format('drop policy %I on public.%I',p.policyname,t);
  end loop;
  execute format('create policy private_admin_read on public.%I for select to authenticated using(user_id=(select auth.uid()) or public.can_admin_user(user_id))',t);
 end loop;
end $$;
-- Public clients cannot forge acquisition or product telemetry; server triggers remain permitted.
do $$declare p record;
begin
 for p in select tablename,policyname from pg_policies where schemaname='public' and tablename in ('attribution_events','product_events') and cmd='INSERT' loop
  execute format('drop policy %I on public.%I',p.policyname,p.tablename);
 end loop;
end $$;
revoke insert on public.attribution_events,public.product_events from anon,authenticated;
