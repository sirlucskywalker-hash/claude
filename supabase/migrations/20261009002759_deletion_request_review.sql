-- Narrow privileged operations; browser roles retain no direct UPDATE grant.
create policy deletion_requests_owner_read on public.account_deletion_requests
for select to authenticated using ((select public.is_physiqueos_owner()));

create or replace function public.withdraw_account_deletion(request_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
declare uid uuid:=auth.uid(); current_request public.account_deletion_requests;
begin
 if uid is null then raise exception 'Sign in first'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,731));
 select * into current_request from public.account_deletion_requests
 where id=request_id and user_id=uid for update;
 if not found then raise exception 'Deletion request unavailable'; end if;
 if current_request.status='canceled' then return true; end if;
 if current_request.status<>'pending' then raise exception 'Review has started. Contact support to withdraw this request'; end if;
 update public.account_deletion_requests set status='canceled',updated_at=now() where id=request_id;
 insert into public.audit_log(actor_user_id,action,entity_type,entity_id)
 values(uid,'account.deletion_withdrawn','account_deletion_request',request_id::text);
 perform physique_private.notify_account(uid,'deletion_withdrawn:'||request_id,'deletion_withdrawn',
 'Deletion request withdrawn','Your pending deletion request was withdrawn. Your account and billing remain unchanged.','account',false);
 return true;
end $$;
revoke all on function public.withdraw_account_deletion(uuid) from public,anon;
grant execute on function public.withdraw_account_deletion(uuid) to authenticated;

create or replace function public.begin_account_deletion_review(request_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare target uuid; current_request public.account_deletion_requests; billing jsonb; photos bigint; objects bigint;
begin
 if not public.is_physiqueos_owner() then raise exception 'Verified PhysiqueOS owner access required'; end if;
 select user_id into target from public.account_deletion_requests where id=request_id;
 if target is null then raise exception 'Deletion request unavailable'; end if;
 perform pg_advisory_xact_lock(hashtextextended(target::text,731));
 select * into current_request from public.account_deletion_requests where id=request_id for update;
 if not found then raise exception 'Deletion request unavailable'; end if;
 if current_request.status not in ('pending','in_progress') then raise exception 'Deletion request is closed'; end if;
 if exists(select 1 from physique_private.owner_bootstrap where claimed_by=target)
 or exists(select 1 from public.memberships where user_id=target and role='owner' and status='active')
 then raise exception 'Owner accounts require a separate ownership transfer review'; end if;
 if current_request.status='pending' then
  update public.account_deletion_requests set status='in_progress',updated_at=now() where id=request_id;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id)
  values(auth.uid(),'account.deletion_review_started','account_deletion_request',request_id::text);
  perform physique_private.notify_account(target,'deletion_review:'||request_id,'deletion_review',
  'Your deletion request is under review','The owner is reviewing your request. This does not erase your data or cancel billing. Contact support if you need to change your request.','account',false);
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('subscription_id',stripe_subscription_id,'status',status,
 'cancel_at_period_end',cancel_at_period_end,'current_period_end',current_period_end)), '[]'::jsonb)
 into billing from public.subscriptions where user_id=target and status not in ('canceled','incomplete_expired');
 select count(*) into photos from public.progress_photos where user_id=target;
 select count(*) into objects from storage.objects where bucket_id='progress-photos' and split_part(name,'/',1)=target::text;
 return jsonb_build_object('request_id',request_id,'user_id',target,'status','in_progress',
 'recorded_subscriptions',billing,'photo_records',photos,'storage_objects',objects,
 'billing_verified',false,'erased',false);
end $$;
revoke all on function public.begin_account_deletion_review(uuid) from public,anon;
grant execute on function public.begin_account_deletion_review(uuid) to authenticated;
