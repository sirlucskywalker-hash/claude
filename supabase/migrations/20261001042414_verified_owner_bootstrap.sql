-- Seed owner email privately; never trust signup metadata for authorization.
create table physique_private.owner_bootstrap (
  email text primary key check(email=lower(trim(email))),
  claimed_by uuid unique references auth.users(id) on delete restrict,
  claimed_at timestamptz
);
revoke all on physique_private.owner_bootstrap from public,anon,authenticated;
create or replace function public.claim_owner_access()
returns boolean language plpgsql security definer set search_path=''
as $$
declare uid uuid := auth.uid(); account_email text; seed physique_private.owner_bootstrap%rowtype; org uuid;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  select lower(trim(u.email)) into account_email from auth.users u where u.id=uid and u.email_confirmed_at is not null;
  if account_email is null then return false; end if;
  select * into seed from physique_private.owner_bootstrap where email=account_email for update;
  if not found then return false; end if;
  if seed.claimed_by is not null then return seed.claimed_by=uid; end if;
  select id into org from public.organizations where slug='physiqueos' and status='active';
  if org is null then raise exception 'Owner organization unavailable'; end if;
  insert into public.memberships(organization_id,user_id,role,status) values(org,uid,'owner','active')
    on conflict(organization_id,user_id) do update set role='owner',status='active';
  insert into public.entitlements(user_id,code,source,metadata) values(uid,'app_access','admin','{"tier":"concierge","reason":"owner_workspace"}'::jsonb)
    on conflict(user_id,code,source) do update set active=true,ends_at=null,metadata=excluded.metadata;
  update physique_private.owner_bootstrap set claimed_by=uid,claimed_at=now() where email=account_email;
  insert into public.audit_log(organization_id,actor_user_id,action,entity_type,entity_id)
    values(org,uid,'owner.bootstrap_claimed','membership',uid::text);
  return true;
end $$;
revoke all on function public.claim_owner_access() from public,anon;
grant execute on function public.claim_owner_access() to authenticated;
