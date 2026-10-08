-- PhysiqueOS is a dedicated project. Only its privately bootstrapped owner
-- receives project-wide business reads, including accounts without membership.
create or replace function public.is_physiqueos_owner()
returns boolean language sql stable security definer set search_path=''
as $$
 select exists(select 1 from physique_private.owner_bootstrap b
 join public.memberships m on m.user_id=b.claimed_by
 join public.organizations o on o.id=m.organization_id
 join auth.users u on u.id=m.user_id
 where b.claimed_by=auth.uid() and u.email_confirmed_at is not null
 and m.role='owner' and m.status='active' and o.slug='physiqueos' and o.status='active');
$$;
revoke all on function public.is_physiqueos_owner() from public,anon;
grant execute on function public.is_physiqueos_owner() to authenticated;

create or replace function public.owner_data_page(section text, page_offset integer default 0)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare source_sql text; records jsonb; org uuid;
begin
 if not public.is_physiqueos_owner() then raise exception 'Verified PhysiqueOS owner access required'; end if;
 if page_offset is null or page_offset<0 or page_offset>1000000 or page_offset%100<>0 then raise exception 'Invalid owner page offset'; end if;
 if section=any(array['organizations','profiles','memberships','invites','invite_claims','client_profiles','daily_checkins','measurements','progress_photos','meal_plans','training_programs','workout_sessions','coach_notes','billing_customers','subscriptions','entitlements','billing_events','checkout_reservations','consent_events','attribution_events','product_events','audit_log','beta_import_receipts','user_app_state','user_state_snapshots','support_tickets','support_replies','account_deletion_requests','account_notifications','communication_preferences','coach_client_assignments','plans','features','plan_features','plan_catalog']) then
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

create or replace function public.owner_can_read_photo(object_name text)
returns boolean language sql stable security definer set search_path=''
as $$select public.is_physiqueos_owner() and exists(select 1 from public.progress_photos p where p.storage_path=object_name and split_part(object_name,'/',1)=p.user_id::text)$$;
revoke all on function public.owner_can_read_photo(text) from public,anon;
grant execute on function public.owner_can_read_photo(text) to authenticated;
create policy physiqueos_owner_photo_read on storage.objects for select to authenticated
using(bucket_id='progress-photos' and public.owner_can_read_photo(name));

-- TRUNCATE bypasses RLS. Browser roles never need bulk destructive/DDL grants.
revoke truncate,references,trigger on all tables in schema public from public,anon,authenticated;

alter default privileges in schema public revoke truncate,references,trigger on tables from public,anon,authenticated;
