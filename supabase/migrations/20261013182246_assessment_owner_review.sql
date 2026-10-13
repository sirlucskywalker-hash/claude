-- A recorded service review is never medical clearance or an automatic plan change.
alter table public.assessment_records
 add column review_outcome text check(review_outcome in ('feedback_recorded','follow_up_needed')),
 add column review_note text check(review_note is null or length(review_note) between 1 and 3000),
 add column reviewed_by uuid references auth.users(id) on delete set null,
 add column reviewed_at timestamptz;
alter table public.assessment_records add constraint assessment_review_complete check (
 (reviewed_at is null and review_outcome is null and review_note is null and reviewed_by is null)
 or (reviewed_at is not null and review_outcome is not null and review_note is not null)
);

create or replace function public.record_assessment_review(assessment_id uuid,outcome text,note text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare item public.assessment_records; cleaned text:=btrim(note);
begin
 if not public.is_physiqueos_owner() then raise exception 'Verified PhysiqueOS owner access required'; end if;
 if assessment_id is null or outcome is null or outcome not in ('feedback_recorded','follow_up_needed')
 or cleaned is null or length(cleaned)<1 or length(cleaned)>3000 then raise exception 'Choose a review outcome and enter 1–3000 characters of member-visible feedback'; end if;
 select * into item from public.assessment_records where id=assessment_id for update;
 if not found or item.kind<>'ai_video' or item.status<>'needs_review' or item.report is null then raise exception 'Assessment report is unavailable for review'; end if;
 if item.reviewed_at is not null then
  if item.review_outcome=outcome and item.review_note=cleaned then return jsonb_build_object('assessment_id',item.id,'reviewed_at',item.reviewed_at,'outcome',item.review_outcome); end if;
  raise exception 'A review is already recorded. Use a separate support message for follow-up';
 end if;
 update public.assessment_records set review_outcome=outcome,review_note=cleaned,reviewed_by=auth.uid(),reviewed_at=now() where id=assessment_id;
 insert into public.audit_log(actor_user_id,action,entity_type,entity_id,after_data)
 values(auth.uid(),'assessment.review_recorded','assessment_record',assessment_id::text,jsonb_build_object('outcome',outcome));
 perform physique_private.notify_account(item.user_id,'assessment_review:'||assessment_id,'assessment_review',
 'Assessment feedback recorded','Owner feedback is available in your assessment records. This is a service review, not medical clearance; your program and restrictions have not changed.','coaching',false);
 return jsonb_build_object('assessment_id',item.id,'reviewed_at',now(),'outcome',outcome);
end $$;
revoke all on function public.record_assessment_review(uuid,text,text) from public,anon;
grant execute on function public.record_assessment_review(uuid,text,text) to authenticated;
