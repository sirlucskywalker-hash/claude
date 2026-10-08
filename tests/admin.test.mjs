import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const root=new URL('../',import.meta.url),html=await readFile(new URL('admin.html',root),'utf8'),source=await readFile(new URL('admin.js',root),'utf8');
async function mount(role='owner'){
 const dom=new JSDOM(html,{url:'https://example.com/app/admin.html',runScripts:'outside-only'}),w=dom.window,calls=[];
 const client={auth:{getUser:async()=>({data:{user:{id:'owner'}}})},rpc:async(name,args)=>{calls.push({name,args});return name==='operations_health'?{data:{active_members:2}}:{error:{message:'Assignment rejected'}};},from:name=>{
  calls.push({table:name});const filters={};
  const result=()=>({data:name==='memberships'?(filters.role==='coach'?[{user_id:'coach'}]:[{role,organization_id:'org'}]):name==='profiles'?[{user_id:'coach',full_name:'Coach'}]:name==='admin_client_overview_v2'?[{user_id:'member',full_name:'<img src=x onerror=alert(1)>',email:'member@example.com'}]:name==='coach_notes'?[{body:'<script>unsafe</script>',visibility:'staff',created_at:'2026-10-07'}]:name==='user_state_snapshots'?{state:{profile:{name:'Member'}}}:[]});
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
