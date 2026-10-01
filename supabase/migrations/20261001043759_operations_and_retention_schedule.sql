create or replace function physique_private.support_reply_message()
returns trigger language plpgsql security definer set search_path=''
as $$declare recipient uuid;
begin
 select user_id into recipient from public.support_tickets where id=new.ticket_id;
 perform physique_private.notify_account(recipient,'support-reply:'||new.id::text,'support_reply','Your support request has a reply','Open Get support in the app to read the reply. Your private support details are not included in this email.','account');
 return new;
end $$;
revoke all on function physique_private.support_reply_message() from public,anon,authenticated;
create trigger physiqueos_support_reply_message after insert on public.support_replies for each row execute function physique_private.support_reply_message();
create or replace function public.operations_health(org uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$begin
 if auth.uid() is null or not public.has_org_role(org,array['owner','admin']) then raise exception 'Owner or admin access required'; end if;
 return jsonb_build_object(
  'active_members',(select count(*) from public.memberships where organization_id=org and status='active'),
  'open_support',(select count(*) from public.support_tickets t where t.status in ('open','in_progress') and exists(select 1 from public.memberships m where m.organization_id=org and m.user_id=t.user_id)),
  'pending_deletion',(select count(*) from public.account_deletion_requests d where d.status in ('pending','in_progress') and exists(select 1 from public.memberships m where m.organization_id=org and m.user_id=d.user_id)),
  'queued_emails',(select count(*) from physique_private.email_outbox e where e.status in ('pending','sending') and exists(select 1 from public.memberships m where m.organization_id=org and m.user_id=e.user_id)),
  'failed_emails',(select count(*) from physique_private.email_outbox e where e.status='failed' and exists(select 1 from public.memberships m where m.organization_id=org and m.user_id=e.user_id)),
  'payment_issues',(select count(*) from public.subscriptions s where s.status in ('past_due','unpaid','incomplete') and exists(select 1 from public.memberships m where m.organization_id=org and m.user_id=s.user_id)),
  'scheduled_cancellations',(select count(*) from public.subscriptions s where s.cancel_at_period_end and s.status in ('active','trialing','past_due') and exists(select 1 from public.memberships m where m.organization_id=org and m.user_id=s.user_id))
 );
end $$;
revoke all on function public.operations_health(uuid) from public,anon;
grant execute on function public.operations_health(uuid) to authenticated;
-- Runtime scheduling is verified on hosted Postgres; PGlite does not provide pg_cron.
create extension if not exists pg_cron;
select cron.schedule('physiqueos-retention-nudges','0 13 * * *','select public.queue_retention_nudges()');
