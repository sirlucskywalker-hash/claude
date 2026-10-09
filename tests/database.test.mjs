
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
const root=new URL('../',import.meta.url);
const uid='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002',owner='10000000-0000-4000-8000-000000000003';
async function q(sql,args=[]){return (await db.query(sql,args)).rows;}
async function asUser(id,fn,role='authenticated'){
  await db.exec('begin; set local role '+role);
  await q("select set_config('request.jwt.claim.sub',$1,true)",[id||'']);
  try{const result=await fn();await db.exec('commit');return result;}catch(e){await db.exec('rollback');throw e;}
}
test('proposed tier database integration',async(t)=>{
await db.exec(await readFile(new URL('tests/database-fixture.sql',root),'utf8'));
await db.exec((await readFile(new URL('supabase/migrations/0001_core.sql',root),'utf8')).replace('create extension if not exists pgcrypto;',''));
await db.exec(`create or replace function public.can_manage_user(target uuid) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from memberships mine join memberships theirs using(organization_id) where mine.user_id=auth.uid() and mine.role in ('owner','admin','coach') and mine.status='active' and theirs.user_id=target and theirs.status='active')$$;`);
await db.exec(await readFile(new URL('tests/database-existing.sql',root),'utf8'));
await db.exec(await readFile(new URL('docs/proposed-tier-operations.sql',root),'utf8'));
await db.exec(await readFile(new URL('supabase/migrations/20261001042402_account_privacy_operations.sql',root),'utf8'));
await db.exec(await readFile(new URL('supabase/migrations/20261001042414_verified_owner_bootstrap.sql',root),'utf8'));
await db.exec(await readFile(new URL('supabase/migrations/20261001042424_lifecycle_notifications.sql',root),'utf8'));
await db.exec((await readFile(new URL('supabase/migrations/20261001043759_operations_and_retention_schedule.sql',root),'utf8')).split('-- Runtime scheduling')[0]);
await q("insert into auth.users(id,email,email_confirmed_at) values($1,'client@example.com',now()),($2,'other@example.com',now()),($3,'owner@example.com',now())",[uid,other,owner]);
await q("insert into profiles(user_id,email) select id,email from auth.users");
const [org]=await q("insert into organizations(name,slug) values('PhysiqueOS','physiqueos') returning id");
await q("insert into memberships(organization_id,user_id,role) values($1,$2,'owner')",[org.id,owner]);
await t.test('users without entitlements resolve to none and cannot sync',async()=>{
 assert.equal((await asUser(uid,()=>q("select current_plan_code() as plan")))[0].plan,'none');
 await assert.rejects(()=>asUser(uid,()=>q("select sync_app_state('{}',0)")),/Membership required/);
 await assert.rejects(()=>asUser(uid,()=>q("select reserve_checkout($1,'founding')",[uid])),/permission denied/);
});
await t.test('invites are email-bound, repeat-safe, and cannot be created by clients',async()=>{
 await assert.rejects(()=>asUser(uid,()=>q("select create_beta_invite($1,null)",[org.id])),/Admin access/);
 const [{token}]=await asUser(owner,()=>q("select create_beta_invite($1,'client@example.com') as token",[org.id]));
 await assert.rejects(()=>asUser(other,()=>q("select claim_invite($1)",[token])),/another email/);
 await asUser(uid,()=>q("select claim_invite($1)",[token]));
 await asUser(uid,()=>q("select claim_invite($1)",[token]));
 assert.equal((await q("select uses from invites"))[0].uses,1);
 assert.equal((await asUser(uid,()=>q("select current_plan_code() as plan")))[0].plan,'beta');
});
await t.test('state revisions prevent lost writes and expose no other user data',async()=>{
 const payload={profile:{name:'Client',age:34,weight:220.462,heightCm:173,goal:'fatloss',equipment:['dumbbells']},logs:[{date:'2026-09-30',weight:220.462,water:100,steps:9000,adherence:90,waist:36}],workoutLogs:[]};
 const [{result}]=await asUser(uid,()=>q("select sync_app_state($1,0) as result",[JSON.stringify(payload)]));
 assert.equal(result.revision,1);
 const [{result:conflict}]=await asUser(uid,()=>q("select sync_app_state('{}',0) as result"));
 assert.equal(conflict.conflict,true);
 assert.equal(conflict.state.profile.name,'Client');
 assert.equal((await asUser(other,()=>q("select * from user_state_snapshots"))).length,0);
 await assert.rejects(()=>asUser(uid,()=>q("update user_state_snapshots set state='{}'")),/permission denied/);
 const [checkin]=await q("select weight_kg,water_ml from daily_checkins");
 assert.equal(Number(checkin.weight_kg),100);
 assert.equal(checkin.water_ml,2957);
 assert.equal(Number((await q("select waist_cm from measurements"))[0].waist_cm),91.44);
});
await t.test('billing records exact tiers, retries once, ignores stale events, and expires access',async()=>{
 await q("insert into billing_customers(user_id,stripe_customer_id) values($1,'cus_client')",[uid]);
 const sub={id:'sub_client',customer:'cus_client',price_id:'price_core',status:'active',period_start:'2026-09-30T00:00:00Z',period_end:'2099-10-30T00:00:00Z',cancel_at_period_end:false,trial_end:null};
 const sync=async(id,time,data)=>asUser(null,()=>q("select record_billing_subscription($1,'customer.subscription.updated',$2,'{}',$3)",[id,time,JSON.stringify(data)]),'service_role');
 await sync('evt_first',100,sub);await sync('evt_first',100,sub);
 assert.equal((await q("select count(*)::int as n from audit_log where action='billing.subscription_synced'"))[0].n,1);
 assert.equal((await asUser(uid,()=>q("select current_plan_code() as plan")))[0].plan,'core');
 await sync('evt_upgrade',200,{...sub,price_id:'price_elite'});
 await sync('evt_old',150,sub);
 assert.equal((await asUser(uid,()=>q("select current_plan_code() as plan")))[0].plan,'elite');
 await sync('evt_canceled',300,{...sub,status:'canceled'});
 assert.equal((await asUser(uid,()=>q("select current_plan_code() as plan")))[0].plan,'beta');
 await q("update entitlements set ends_at=now()-interval '1 day' where user_id=$1 and source='beta'",[uid]);
 assert.equal((await asUser(uid,()=>q("select current_plan_code() as plan")))[0].plan,'none');
});
await t.test('support priority is computed by the server and replies require staff',async()=>{
 const [{ticket}]=await asUser(uid,()=>q("select open_support_ticket('Help','Please help') as ticket"));
 assert.equal((await q("select priority from support_tickets where id=$1",[ticket]))[0].priority,'standard');
 await assert.rejects(()=>asUser(other,()=>q("select reply_support_ticket($1,'fake reply','resolved')",[ticket])),/Staff access/);
 assert.equal((await asUser(other,()=>q("select * from support_tickets"))).length,0);
 await asUser(owner,()=>q("select reply_support_ticket($1,'Resolved','resolved')",[ticket]));
 assert.equal((await asUser(uid,()=>q("select * from support_replies"))).length,1);
});
await t.test('closed launch tiers block checkout; founding reservations enforce cap',async()=>{
 await assert.rejects(()=>asUser(null,()=>q("select reserve_checkout($1,'founding')",[other]),'service_role'),/not open/);
 await q("update plan_catalog set public=true where code='founding'");
 await q("insert into checkout_reservations(user_id,plan_code,state) select $1,'founding','redeemed' from generate_series(1,100)",[uid]);
 await assert.rejects(()=>asUser(null,()=>q("select reserve_checkout($1,'founding')",[other]),'service_role'),/full/);
});
await t.test('owner bootstrap requires an operator allowlist and confirmed email, and is one-time',async()=>{
 assert.equal((await asUser(other,()=>q('select claim_owner_access() as claimed')))[0].claimed,false);
 await q("insert into physique_private.owner_bootstrap(email) values('other@example.com')");
 await q('update auth.users set email_confirmed_at=null where id=$1',[other]);
 assert.equal((await asUser(other,()=>q('select claim_owner_access() as claimed')))[0].claimed,false);
 await q('update auth.users set email_confirmed_at=now() where id=$1',[other]);
 assert.equal((await asUser(other,()=>q('select claim_owner_access() as claimed')))[0].claimed,true);
 assert.equal((await asUser(other,()=>q('select claim_owner_access() as claimed')))[0].claimed,true);
 assert.equal((await asUser(other,()=>q('select current_plan_code() as plan')))[0].plan,'concierge');
 assert.equal((await q("select count(*)::int n from audit_log where action='owner.bootstrap_claimed'"))[0].n,1);
 await assert.rejects(()=>asUser(uid,()=>q("insert into physique_private.owner_bootstrap(email) values('client@example.com')")),/permission denied/);
});
await t.test('exports remain own-account even for staff and exclude internal coaching notes',async()=>{
 const [{result}]=await asUser(other,()=>q("select export_account_page('profiles',0) result"));
 assert.equal(result.rows.length,1);assert.equal(result.rows[0].user_id,other);
 await q("insert into coach_notes(organization_id,client_user_id,author_user_id,visibility,body) values($1,$2,$3,'staff','Private'),($1,$2,$3,'client','Shared')",[org.id,uid,owner]);
 const [{result:notes}]=await asUser(uid,()=>q("select export_account_page('coach_notes',0) result"));
 assert.deepEqual(notes.rows.map(x=>x.body),['Shared']);
 await assert.rejects(()=>asUser(uid,()=>q("select export_account_page('auth.users',0)")),/Unknown export section/);
 await assert.rejects(()=>asUser(uid,()=>q("select export_account_page('profiles',-1)")),/Invalid export offset/);
 await assert.rejects(()=>asUser(null,()=>q("select export_account_page('profiles',0)"),'anon'),/permission denied/);
 await q("insert into daily_checkins(user_id,organization_id,checkin_date) select $1,$2,'2020-01-01'::date+n from generate_series(0,104)n",[uid,org.id]);
 const [{result:page1}]=await asUser(uid,()=>q("select export_account_page('daily_checkins',0) result"));
 const [{result:page2}]=await asUser(uid,()=>q("select export_account_page('daily_checkins',100) result"));
 assert.equal(page1.rows.length,100);assert.equal(page1.next_offset,100);assert.equal(page2.rows.length,6);assert.equal(page2.next_offset,null);
});
await t.test('deletion requests are idempotent, audited, and cannot be submitted for another account',async()=>{
 const [{id}]=await asUser(uid,()=>q('select request_account_deletion() id'));
 assert.equal((await asUser(uid,()=>q('select request_account_deletion() id')))[0].id,id);
 assert.equal((await asUser(owner,()=>q('select request_account_deletion() id')))[0].id===id,false);
 assert.equal((await q("select count(*)::int n from audit_log where action='account.deletion_requested' and actor_user_id=$1",[uid]))[0].n,1);
 await assert.rejects(()=>asUser(uid,()=>q("update account_deletion_requests set status='completed'")),/permission denied/);
});
await t.test('confirmed welcome messages are unique and notification access stays private',async()=>{
 assert.equal((await q("select count(*)::int n from account_notifications where user_id=$1 and event_key='welcome'",[uid]))[0].n,1);
 await q('update auth.users set email_confirmed_at=now() where id=$1',[uid]);
 assert.equal((await q("select count(*)::int n from account_notifications where user_id=$1 and event_key='welcome'",[uid]))[0].n,1);
 const rows=await asUser(owner,()=>q('select * from account_notifications'));
 assert.ok(rows.every(r=>r.user_id===owner));
 const [note]=await q('select id from account_notifications where user_id=$1 limit 1',[uid]);
 await asUser(other,()=>q('select read_account_notification($1)',[note.id]));
 assert.equal((await q('select read_at from account_notifications where id=$1',[note.id]))[0].read_at,null);
 await assert.rejects(()=>asUser(uid,()=>q("update account_notifications set body='fake'")),/permission denied/);
});
await t.test('email jobs lease once, keep retry payload stable, reject stale completion, and suppress complaints',async()=>{
 const claim=()=>asUser(null,()=>q('select claim_lifecycle_emails() result'),'service_role');
 await assert.rejects(()=>asUser(uid,()=>q('select claim_lifecycle_emails()')),/permission denied/);
 const [{result:jobs}]=await claim();assert.ok(jobs.length>0&&jobs.length<=5);
 const job=jobs.find(x=>x.kind==='welcome')||jobs[0];
 const [{result:more}]=await claim();assert.ok(more.every(x=>!jobs.some(j=>j.id===x.id)));
 await asUser(null,()=>q("select finish_lifecycle_email($1,$2,'sent','email_wrong',null)",[job.id,'20000000-0000-4000-8000-000000000001']),'service_role');
 assert.equal((await q('select status from physique_private.email_outbox where id=$1',[job.id]))[0].status,'sending');
 await asUser(null,()=>q("select finish_lifecycle_email($1,$2,'sent','email_valid',null)",[job.id,job.lease_token]),'service_role');
 await asUser(null,()=>q("select record_lifecycle_delivery('delivery_1','email_valid','email.complained',$1)",[[job.email]]),'service_role');
 await asUser(null,()=>q("select record_lifecycle_delivery('delivery_1','email_valid','email.complained',$1)",[[job.email]]),'service_role');
 assert.equal((await q("select count(*)::int n from physique_private.email_delivery_events where event_key='delivery_1'"))[0].n,1);
 assert.equal((await q('select reason from physique_private.email_suppressions where email=$1',[job.email]))[0].reason,'email.complained');
});
await t.test('optional re-engagement honors preferences and never queues marketing mail',async()=>{
 await asUser(uid,()=>q('select set_communication_preferences(false,false)'));
 assert.equal((await q('select coaching_nudges from communication_preferences where user_id=$1',[uid]))[0].coaching_nudges,false);
 assert.equal((await q("select granted from consent_events where user_id=$1 and document_version='communication-preferences-v1'",[uid]))[0].granted,false);
 await q("update profiles set created_at=now()-interval '10 days'");
 await asUser(null,()=>q('select queue_retention_nudges()'),'service_role');
 assert.equal((await q("select count(*)::int n from physique_private.email_outbox where kind='return_to_plan'"))[0].n,0);
 assert.equal((await q("select count(*)::int n from account_notifications where user_id=$1 and category='coaching'",[uid]))[0].n,0);
});
await t.test('operations health is organization-scoped and denied to clients',async()=>{
 await assert.rejects(()=>asUser(uid,()=>q('select operations_health($1)',[org.id])),/Owner or admin/);
 const [{health}]=await asUser(owner,()=>q('select operations_health($1) health',[org.id]));assert.ok(health.active_members>=2);assert.equal(typeof health.queued_emails,'number');
 const [foreignOrg]=await q("insert into organizations(name,slug) values('Other','other') returning id");
 await assert.rejects(()=>asUser(owner,()=>q('select operations_health($1)',[foreignOrg.id])),/Owner or admin/);
});
await db.exec(await readFile(new URL('supabase/migrations/20261008011755_staff_assignment_and_tenant_isolation.sql',root),'utf8'));
const coach='10000000-0000-4000-8000-000000000004',unassigned='10000000-0000-4000-8000-000000000005';
await q("insert into auth.users(id,email,email_confirmed_at) values($1,'coach@example.com',now()),($2,'unassigned@example.com',now())",[coach,unassigned]);
await q("insert into profiles(user_id,email) select id,email from auth.users where id in ($1,$2)",[coach,unassigned]);
await q("insert into memberships(organization_id,user_id,role) values($1,$2,'coach'),($1,$3,'client')",[org.id,coach,unassigned]);
const [isolated]=await q("insert into organizations(name,slug) values('Isolated','isolated') returning id");
await t.test('clients cannot enumerate other members or forge wellness organization IDs',async()=>{
 assert.ok((await asUser(uid,()=>q('select user_id from memberships'))).every(m=>m.user_id===uid));
 await assert.rejects(()=>asUser(uid,()=>q('update client_profiles set organization_id=$1 where user_id=$2',[isolated.id,uid])),/row-level security/);
 await assert.rejects(()=>asUser(uid,()=>q("insert into daily_checkins(user_id,organization_id,checkin_date) values($1,$2,'2026-10-07')",[uid,isolated.id])),/row-level security/);
 await asUser(uid,()=>q("insert into daily_checkins(user_id,organization_id,checkin_date) values($1,$2,'2026-10-07')",[uid,org.id]));
});
await t.test('coaches see only assigned clients and cannot assign themselves',async()=>{
 assert.equal((await asUser(coach,()=>q('select * from client_profiles'))).length,0);
 await assert.rejects(()=>asUser(coach,()=>q('select set_coach_assignment($1,$2,$3,true)',[org.id,coach,uid])),/Owner or admin/);
 await assert.rejects(()=>asUser(owner,()=>q('select set_coach_assignment($1,$2,$3,true)',[isolated.id,coach,uid])),/Owner or admin/);
 await asUser(owner,()=>q('select set_coach_assignment($1,$2,$3,true)',[org.id,coach,uid]));
 assert.ok((await asUser(coach,()=>q('select * from daily_checkins'))).every(r=>r.user_id===uid));
 assert.equal((await asUser(coach,()=>q('select can_manage_user($1) ok',[unassigned])))[0].ok,false);
 assert.equal((await asUser(coach,()=>q('select can_manage_user($1) ok',[uid])))[0].ok,true);
 assert.equal((await asUser(coach,()=>q('select * from billing_customers'))).length,0);
 assert.equal((await asUser(coach,()=>q('select * from account_deletion_requests'))).length,0);
});
await t.test('coach notes require assignment and own authorship; revocation removes access',async()=>{
 await assert.rejects(()=>asUser(coach,()=>q("insert into coach_notes(organization_id,client_user_id,author_user_id,body) values($1,$2,$3,'forged')",[org.id,unassigned,coach])),/row-level security/);
 await assert.rejects(()=>asUser(coach,()=>q("insert into coach_notes(organization_id,client_user_id,author_user_id,body) values($1,$2,$3,'forged author')",[org.id,uid,owner])),/row-level security/);
 await asUser(coach,()=>q("insert into coach_notes(organization_id,client_user_id,author_user_id,body,visibility) values($1,$2,$3,'private','staff')",[org.id,uid,coach]));
 assert.ok((await asUser(uid,()=>q('select * from coach_notes'))).every(n=>n.visibility==='client'));
 await asUser(owner,()=>q('select set_coach_assignment($1,$2,$3,false)',[org.id,coach,uid]));
 assert.equal((await asUser(coach,()=>q('select * from daily_checkins'))).length,0);
 assert.equal((await asUser(coach,()=>q('select * from user_state_snapshots'))).length,0);
 assert.equal((await asUser(coach,()=>q('select * from coach_notes'))).length,0);
 assert.equal((await asUser(owner,()=>q('select * from daily_checkins'))).length>0,true);
});
await t.test('anonymous and authenticated clients cannot forge server telemetry',async()=>{
 await assert.rejects(()=>asUser(null,()=>q("insert into attribution_events(event_name) values('fake')"),'anon'),/permission denied/);
 await assert.rejects(()=>asUser(uid,()=>q("insert into product_events(user_id,event_name) values($1,'fake')",[uid])),/permission denied/);
});
await db.exec(`create schema storage; create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text); alter table storage.objects enable row level security; grant usage on schema storage to authenticated; grant select on storage.objects to authenticated; grant truncate,references,trigger on all tables in schema public to authenticated,anon;`);
await db.exec(await readFile(new URL('supabase/migrations/20261008013107_owner_data_access.sql',root),'utf8'));
await q("insert into physique_private.owner_bootstrap(email,claimed_by,claimed_at) values('owner@example.com',$1,now())",[owner]);
await q("update memberships set role='client' where user_id=$1 and organization_id=$2",[other,org.id]);
await t.test('only the privately verified project owner can inspect all accounts and operational records',async()=>{
 const [{page}]=await asUser(owner,()=>q("select owner_data_page('accounts',0) page"));
 assert.ok(page.rows.some(r=>r.user_id===other));assert.ok(page.rows.every(r=>!('raw_user_meta_data' in r)&&!('encrypted_password' in r)));
 const [{notes}]=await asUser(owner,()=>q("select owner_data_page('coach_notes',0) notes"));assert.ok(notes.rows.some(r=>r.body==='private'));
 const [{invites}]=await asUser(owner,()=>q("select owner_data_page('invites',0) invites"));assert.ok(invites.rows.every(r=>!('token_hash' in r)));
 const [{emails}]=await asUser(owner,()=>q("select owner_data_page('email_outbox',0) emails"));assert.ok(emails.rows.length>0);assert.ok(emails.rows.every(r=>!('lease_token' in r)));
 for(const id of [uid,coach,unassigned])await assert.rejects(()=>asUser(id,()=>q("select owner_data_page('accounts',0)")),/Verified PhysiqueOS owner/);
 await q("insert into memberships(organization_id,user_id,role) values($1,$2,'owner')",[isolated.id,other]);
 await assert.rejects(()=>asUser(other,()=>q("select owner_data_page('profiles',0)")),/Verified PhysiqueOS owner/);
 await assert.rejects(()=>asUser(null,()=>q("select owner_data_page('profiles',0)"),'anon'),/permission denied/);
});
await t.test('owner pages are bounded, audited, reject arbitrary SQL and survive inactive target memberships',async()=>{
 const [{first}]=await asUser(owner,()=>q("select owner_data_page('daily_checkins',0) first"));assert.equal(first.rows.length,100);assert.equal(first.next_offset,100);
 const [{page_two:second}]=await asUser(owner,()=>q("select owner_data_page('daily_checkins',100) as page_two"));assert.ok(second.rows.length>0);assert.equal(second.next_offset,null);
 await assert.rejects(()=>asUser(owner,()=>q("select owner_data_page('auth.users',0)")),/Unknown owner data/);
 await assert.rejects(()=>asUser(owner,()=>q("select owner_data_page('profiles',-1)")),/Invalid owner/);
 await assert.rejects(()=>asUser(owner,()=>q("select owner_data_page('profiles',null)")),/Invalid owner/);
 await q("update memberships set status='suspended' where user_id=$1",[uid]);
 const [{archived}]=await asUser(owner,()=>q("select owner_data_page('client_profiles',0) archived"));assert.ok(archived.rows.some(r=>r.user_id===uid));
 assert.equal((await q("select count(*)::int n from audit_log where action='owner.data_read'"))[0].n,7);
 await q("update memberships set status='suspended' where user_id=$1",[owner]);
 await assert.rejects(()=>asUser(owner,()=>q("select owner_data_page('accounts',0)")),/Verified PhysiqueOS owner/);
 await q("update memberships set status='active' where user_id=$1",[owner]);
});
await t.test('owner photo reads require exact registered paths; bulk destructive grants are removed',async()=>{
 const path=uid+'/test.jpg';await q("insert into progress_photos(user_id,organization_id,storage_path,pose) values($1,$2,$3,'front')",[uid,org.id,path]);
 await q("insert into storage.objects(bucket_id,name) values('progress-photos',$1),('progress-photos','unregistered/test.jpg'),('other-bucket',$1)",[path]);
 const objects=await asUser(owner,()=>q('select * from storage.objects'));assert.equal(objects.length,1);assert.equal(objects[0].name,path);
 assert.equal((await asUser(coach,()=>q('select * from storage.objects'))).length,0);
 assert.equal((await asUser(uid,()=>q('select * from storage.objects'))).length,0);
 assert.equal((await q("select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and (has_table_privilege('authenticated',c.oid,'TRUNCATE') or has_table_privilege('anon',c.oid,'TRUNCATE'))"))[0].n,0);
});
await db.exec(await readFile(new URL('supabase/migrations/20261009002759_deletion_request_review.sql',root),'utf8'));
await t.test('members withdraw only their own pending deletion request, once, without erasing data',async()=>{
 const [{id}]=await asUser(uid,()=>q('select request_account_deletion() id'));
 await assert.rejects(()=>asUser(other,()=>q('select withdraw_account_deletion($1)',[id])),/unavailable/);
 await assert.rejects(()=>asUser(null,()=>q('select withdraw_account_deletion($1)',[id]),'anon'),/permission denied/);
 await asUser(uid,()=>q('select withdraw_account_deletion($1)',[id]));
 await asUser(uid,()=>q('select withdraw_account_deletion($1)',[id]));
 assert.equal((await q('select status from account_deletion_requests where id=$1',[id]))[0].status,'canceled');
 assert.equal((await q("select count(*)::int n from audit_log where action='account.deletion_withdrawn' and entity_id=$1",[id]))[0].n,1);
 assert.equal((await q('select count(*)::int n from auth.users where id=$1',[uid]))[0].n,1);
 assert.equal((await q("select count(*)::int n from physique_private.email_outbox where kind='deletion_withdrawn'"))[0].n,0);
});
await t.test('only the verified owner can start review, including requests from inactive clients',async()=>{
 const [{id}]=await asUser(uid,()=>q('select request_account_deletion() id'));
 for(const user of [uid,coach,other])await assert.rejects(()=>asUser(user,()=>q('select begin_account_deletion_review($1)',[id])),/Verified PhysiqueOS owner/);
 await assert.rejects(()=>asUser(null,()=>q('select begin_account_deletion_review($1)',[id]),'anon'),/permission denied/);
 const [{review}]=await asUser(owner,()=>q('select begin_account_deletion_review($1) review',[id]));
 assert.equal(review.user_id,uid);assert.equal(review.status,'in_progress');assert.equal(review.erased,false);assert.equal(review.billing_verified,false);
 assert.equal(Number(review.photo_records),1);assert.equal(Number(review.storage_objects),1);
 assert.ok((await asUser(owner,()=>q('select * from account_deletion_requests'))).some(r=>r.id===id));
 await asUser(owner,()=>q('select begin_account_deletion_review($1)',[id]));
 assert.equal((await q("select count(*)::int n from audit_log where action='account.deletion_review_started' and entity_id=$1",[id]))[0].n,1);
 await assert.rejects(()=>asUser(uid,()=>q('select withdraw_account_deletion($1)',[id])),/Review has started/);
 await assert.rejects(()=>asUser(owner,()=>q("update account_deletion_requests set status='completed'")),/permission denied/);
});
await t.test('review protects owner accounts, refuses closed requests and does not cancel subscriptions',async()=>{
 const [{own}]=await asUser(owner,()=>q('select request_account_deletion() own'));
 await assert.rejects(()=>asUser(owner,()=>q('select begin_account_deletion_review($1)',[own])),/ownership transfer/);
 await asUser(owner,()=>q('select withdraw_account_deletion($1)',[own]));
 await assert.rejects(()=>asUser(owner,()=>q('select begin_account_deletion_review($1)',[own])),/closed/);
 const [{id}]=await asUser(unassigned,()=>q('select request_account_deletion() id'));
 await q("insert into subscriptions(user_id,stripe_subscription_id,status,cancel_at_period_end,plan_code) values($1,'sub_review_active','active',false,'core')",[unassigned]);
 const [{review}]=await asUser(owner,()=>q('select begin_account_deletion_review($1) review',[id]));
 assert.equal(review.recorded_subscriptions[0].subscription_id,'sub_review_active');
 assert.equal((await q("select status,cancel_at_period_end from subscriptions where stripe_subscription_id='sub_review_active'"))[0].cancel_at_period_end,false);
 await assert.rejects(()=>asUser(owner,()=>q('select begin_account_deletion_review(null)')),/unavailable/);
});
await db.close();
});
