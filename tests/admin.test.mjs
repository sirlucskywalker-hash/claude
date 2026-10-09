import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const root=new URL('../',import.meta.url),html=await readFile(new URL('admin.html',root),'utf8'),source=await readFile(new URL('admin.js',root),'utf8');
async function mount(role='owner'){
 const dom=new JSDOM(html,{url:'https://example.com/app/admin.html',runScripts:'outside-only'}),w=dom.window,calls=[];
 const client={auth:{getUser:async()=>({data:{user:{id:'owner'}}})},rpc:async(name,args)=>{calls.push({name,args});return name==='is_physiqueos_owner'?{data:role==='owner'}:name==='owner_data_page'?{data:{section:args.section,offset:args.page_offset,rows:[{user_id:'unclaimed',email:'<script>unsafe</script>'}],next_offset:args.page_offset===0?100:null}}:name==='operations_health'?{data:{active_members:2}}:{error:{message:'Assignment rejected'}};},from:name=>{
  calls.push({table:name});const filters={};
  const result=()=>({data:name==='memberships'?(filters.role==='coach'?[{user_id:'coach'}]:[{role,organization_id:'org'}]):name==='profiles'?[{user_id:'coach',full_name:'Coach'}]:name==='admin_client_overview_v2'?[{user_id:'member',full_name:'<img src=x onerror=alert(1)>',email:'member@example.com'}]:name==='account_deletion_requests'?[{id:'request-1',user_id:'inactive',status:'pending',requested_at:'2026-10-08'}]:name==='coach_notes'?[{body:'<script>unsafe</script>',visibility:'staff',created_at:'2026-10-07'}]:name==='user_state_snapshots'?{state:{profile:{name:'Member'}}}:[]});
  const q={select:()=>q,eq:(k,v)=>{filters[k]=v;return q;},in:()=>q,order:()=>q,limit:()=>q,maybeSingle:async()=>result(),then:(ok,bad)=>Promise.resolve(result()).then(ok,bad)};return q;
 }};
 w.supabase={createClient:()=>client};w.eval(source);
 for(let i=0;i<25&&w.document.getElementById('adminStatus').textContent==='Checking access…';i++)await new Promise(r=>setTimeout(r,5));
 return {w,dom,calls};
}
test('ordinary clients cannot load owner roster or assignment controls',async()=>{
 const {w,dom,calls}=await mount('client');
 assert.ok(w.document.getElementById('adminContent').classList.contains('hidden'));
 assert.equal(calls.some(c=>c.table==='admin_client_overview_v2'),false);dom.window.close();
});
test('owner assignment uses selected member and org; rejected change remains visible without rendering injected HTML',async()=>{
 const {w,dom,calls}=await mount();
 assert.equal(w.document.querySelector('#membersBody img'),null);
 await w.document.querySelector('[data-member]').onclick();
 assert.equal(w.document.querySelector('#memberDetail script'),null);
 const form=w.document.getElementById('coachAssignmentForm');form.elements.coach.value='coach';
 await form.onsubmit({preventDefault(){},target:form});
 const call=calls.find(c=>c.name==='set_coach_assignment');assert.deepEqual(JSON.parse(JSON.stringify(call.args)),{org:'org',coach:'coach',client:'member',grant_access:true});
 assert.equal(w.document.getElementById('assignmentStatus').textContent,'Assignment rejected');
 assert.equal(form.querySelector('button').disabled,false);dom.window.close();
});

test('owner can inspect unclaimed accounts, change sections and navigate pages without HTML injection',async()=>{
 const {w,dom,calls}=await mount();
 assert.equal(w.document.getElementById('ownerExplorer').classList.contains('hidden'),false);
 assert.match(w.document.getElementById('ownerData').textContent,/unclaimed/);
 assert.equal(w.document.querySelector('#ownerData script'),null);
 await w.document.getElementById('ownerNext').onclick();
 assert.equal(calls.filter(c=>c.name==='owner_data_page').at(-1).args.page_offset,100);
 const select=w.document.getElementById('ownerSection');select.value='email_outbox';await select.onchange();
 const last=calls.filter(c=>c.name==='owner_data_page').at(-1);assert.equal(last.args.section,'email_outbox');assert.equal(last.args.page_offset,0);
 dom.window.close();
});
test('ordinary administrators cannot load project-wide owner records',async()=>{
 const {w,dom,calls}=await mount('admin');assert.equal(w.document.getElementById('ownerExplorer').classList.contains('hidden'),true);
 assert.equal(calls.some(c=>c.name==='owner_data_page'),false);dom.window.close();
});

test('owner review failures remain visible and ordinary admins do not get review controls',async()=>{
 const {w,dom,calls}=await mount();const button=w.document.querySelector('[data-deletion-review]');assert.ok(button);
 await button.onclick();assert.equal(calls.find(c=>c.name==='begin_account_deletion_review').args.request_id,'request-1');
 assert.match(button.parentElement.querySelector('pre').textContent,/rejected/);assert.equal(button.disabled,false);dom.window.close();
 const admin=await mount('admin');assert.equal(admin.w.document.querySelector('[data-deletion-review]'),null);admin.dom.window.close();
});
