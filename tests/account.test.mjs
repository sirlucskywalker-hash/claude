import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const source=await readFile(new URL('../cloud.js',import.meta.url),'utf8');
const user={id:'client-1',email:'client@example.com',user_metadata:{full_name:'Client'}};
async function mount({plan='beta',saved=null,local={},session=true,syncResult=null,verifyError=null,verifiedUser=user}={}){
 const dom=new JSDOM('<!doctype html><main><section id="coach" data-feature="adaptive_coach"></section></main>',{url:'https://example.com/app/',runScripts:'outside-only'});
 const w=dom.window;w.state={profile:{},logs:[]};w.renderAll=()=>{};w.alert=()=>{};w.confirm=()=>false;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 for(const [k,v] of Object.entries(local))w.localStorage.setItem(k,typeof v==='string'?v:JSON.stringify(v));
 const prices=[['founding',3900],['core',2900],['pro',5900],['elite',11900],['concierge',34900]].map(([code,monthly_cents])=>({code,name:code,monthly_cents,features:[],public:false}));
 const verificationCalls=[];
 const client={auth:{verifyOtp:async(args)=>{verificationCalls.push(args);return verifyError?{error:{message:verifyError}}:{data:{session:{},user:verifiedUser}};},getSession:async()=>({data:{session:session?{user}:null}}),onAuthStateChange:()=>{},signInWithPassword:async()=>({data:{session:{},user}}),signOut:async()=>({})},
 rpc:async(name)=>({data:name==='current_plan_code'?plan:name==='sync_app_state'?(syncResult||{revision:2,updated_at:new Date().toISOString()}):{ok:true}}),
 from:name=>{const result={data:name==='user_state_snapshots'?saved:name==='plan_features'?[{feature_code:'adaptive_coach',limits:{}}]:name==='plan_catalog'?prices:[]};const c={select:()=>c,eq:()=>c,order:()=>c,maybeSingle:async()=>result,then:(ok,bad)=>Promise.resolve(result).then(ok,bad)};return c;}};
 w.supabase={createClient:()=>client};w.eval(source);
 for(let i=0;i<10;i++){await new Promise(r=>setTimeout(r,5));if(w.document.getElementById('accountPlan')?.textContent.includes('READY')||!session)break;}
 return {w,dom,verificationCalls};
}
test('account gate stays visible before sign-in',async()=>{
 const {w,dom}=await mount({session:false});
 assert.ok(!w.document.getElementById('authGate').classList.contains('hidden'));dom.window.close();
});
test('no entitlement opens all five tier cards with enrollment closed',async()=>{
 const {w,dom}=await mount({plan:'none'});
 assert.equal(w.document.querySelectorAll('.tierCard').length,5);
 assert.ok(w.document.getElementById('membershipDialog').open);
 assert.ok([...w.document.querySelectorAll('[data-buy]')].every(b=>b.disabled));
 assert.equal(w.document.getElementById('membershipBody').textContent.includes('$349'),true);dom.window.close();
});
test('another account cache never becomes the signed-in account state',async()=>{
 const {w,dom}=await mount({local:{physiqueOS:{profile:{name:'Other user',age:40}},physiqueOS_owner:'other-account'}});
 assert.equal(w.state.profile.name,undefined);
 assert.equal(w.localStorage.getItem('physiqueOS_owner'),'client-1');dom.window.close();
});
test('same-revision offline edits resume rather than being overwritten',async()=>{
 const {w,dom}=await mount({
 saved:{state:{profile:{name:'Remote'},logs:[]},revision:1},
 local:{'physiqueOS_account_client-1':{profile:{name:'Offline'},logs:[],__localDirty:true,__cloudRevision:1}}
 });
 for(let i=0;i<10&&w.physiqueCloud.busy;i++)await new Promise(r=>setTimeout(r,5));
 assert.equal(w.state.profile.name,'Offline');
 assert.equal(w.physiqueCloud.revision,2);dom.window.close();
});
test('conflicting device edits are backed up before loading remote state',async()=>{
 const {w,dom}=await mount({saved:{state:{profile:{name:'Original'},logs:[]},revision:1},syncResult:{conflict:true,revision:2,state:{profile:{name:'Other device'},logs:[]}}});
 w.state.profile.name='This device';
 await w.document.getElementById('syncNowBtn').onclick();
 assert.equal(w.state.profile.name,'Other device');
 assert.equal(JSON.parse(w.localStorage.getItem('physiqueOS_account_client-1_conflict')).profile.name,'This device');
 dom.window.close();
});

test('confirmation fallback verifies in-app, ignores email redirect targets, and clears the link',async()=>{
 const {w,dom,verificationCalls}=await mount({session:false});
 w.document.getElementById('authEmail').value='client@example.com';
 w.document.getElementById('authConfirmationLink').value='https://oyrtpvtzaoftinqoossn.supabase.co/auth/v1/verify?token='+ 'a'.repeat(64)+'&type=signup&redirect_to=http://localhost:3000';
 await w.document.getElementById('authConfirmLink').onclick();
 assert.equal(verificationCalls.length,1);assert.equal(verificationCalls[0].type,'signup');
 assert.equal(w.document.getElementById('authConfirmationLink').value,'');assert.ok(w.document.getElementById('authGate').classList.contains('hidden'));dom.window.close();
});
test('confirmation fallback rejects foreign origins and password-recovery links',async()=>{
 const {w,dom,verificationCalls}=await mount({session:false});w.document.getElementById('authEmail').value='client@example.com';
 for(const url of ['https://evil.example/auth/v1/verify?token='+ 'a'.repeat(64)+'&type=signup','https://oyrtpvtzaoftinqoossn.supabase.co/auth/v1/verify?token='+ 'a'.repeat(64)+'&type=recovery']){
  w.document.getElementById('authConfirmationLink').value=url;await w.document.getElementById('authConfirmLink').onclick();
 }
 assert.equal(verificationCalls.length,0);assert.equal(w.document.getElementById('authConfirmationLink').value,'');dom.window.close();
});
test('used confirmation links leave sign-in available with a clear recovery message',async()=>{
 const {w,dom}=await mount({session:false,verifyError:'expired'});w.document.getElementById('authEmail').value='client@example.com';
 w.document.getElementById('authConfirmationLink').value='https://oyrtpvtzaoftinqoossn.supabase.co/auth/v1/verify?token='+ 'a'.repeat(64)+'&type=signup';
 await w.document.getElementById('authConfirmLink').onclick();
 assert.ok(w.document.getElementById('authMessage').textContent.includes('Try signing in'));assert.equal(w.document.getElementById('authConfirmLink').disabled,false);assert.equal(w.physiqueCloud.ready,false);dom.window.close();
});
test('confirmation links cannot silently load an unexpected account',async()=>{
 const {w,dom}=await mount({session:false,verifiedUser:{...user,email:'other@example.com'}});w.document.getElementById('authEmail').value='client@example.com';
 w.document.getElementById('authConfirmationLink').value='https://oyrtpvtzaoftinqoossn.supabase.co/auth/v1/verify?token='+ 'a'.repeat(64)+'&type=signup';
 await w.document.getElementById('authConfirmLink').onclick();assert.ok(w.document.getElementById('authMessage').textContent.includes('different email'));assert.equal(w.physiqueCloud.user,null);dom.window.close();
});
