import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const source=await readFile(new URL('../account-tools.js',import.meta.url),'utf8');
async function mount({rowError=false,notes=[],deletion=null}={}){
 const dom=new JSDOM('<!doctype html><button id="accountNotificationsBtn"></button><button id="exportAccountBtn"></button><button id="deleteAccountRequestBtn"></button><p id="accountToolsMessage"></p><button id="checkDeletionRequestBtn"></button><button id="withdrawDeletionRequestBtn" disabled></button><p id="deletionRequestStatus"></p><button id="uploadCloudPhotosBtn"></button><button id="refreshCloudPhotosBtn"></button><button id="cloudPhotosPrev"></button><button id="cloudPhotosNext"></button><div id="cloudPhotoGallery"></div><p id="cloudPhotoMessage"></p><input id="photoDate" value="2026-10-01"><input id="photoFront" type="file"><input id="photoSide" type="file"><input id="photoBack" type="file">',{url:'https://example.com/',runScripts:'outside-only'});
 const w=dom.window,calls=[];w.state={profile:{name:'Client'}};w.confirm=()=>true;
 w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=()=>{};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 const client={rpc:async(name,args)=>{calls.push([name,args]);return {data:name==='export_account_page'?{rows:[],next_offset:null}:'request-1'};},storage:{from:()=>({upload:async(...args)=>{calls.push(['upload',...args]);return {};},remove:async(...args)=>{calls.push(['remove',...args]);return {};}})},from:name=>{
  const c={select:()=>c,eq:()=>c,order:()=>c,limit:()=>c,range:()=>c,is:()=>c,in:()=>c,maybeSingle:async()=>({data:name==='account_deletion_requests'?deletion:null}),insert:async(row)=>{calls.push(['insert',row]);return rowError?{error:{message:'Metadata rejected'}}:{};},then:(ok,bad)=>Promise.resolve({data:name==='memberships'?[{organization_id:'org-1'}]:name==='account_notifications'?notes:[]}).then(ok,bad)};return c;
 }};
 w.physiqueCloud={ready:true,user:{id:'client-1'},plan:'beta',client};w.eval(source);await new Promise(r=>setTimeout(r,10));return {w,dom,calls};
}
test('private photo upload cleans up an object when metadata cannot be saved',async()=>{
 const {w,dom,calls}=await mount({rowError:true});Object.defineProperty(w.document.getElementById('photoFront'),'files',{value:[new w.File(['photo'],'front.jpg',{type:'image/jpeg'})]});
 await w.document.getElementById('uploadCloudPhotosBtn').onclick();
 const upload=calls.find(x=>x[0]==='upload'),remove=calls.find(x=>x[0]==='remove');assert.ok(upload[1].startsWith('client-1/'));assert.equal(remove[1][0],upload[1]);assert.ok(w.document.getElementById('cloudPhotoMessage').textContent.includes('Metadata rejected'));dom.window.close();
});
test('account export remains available without a paid tier and covers all record sections',async()=>{
 const {w,dom,calls}=await mount();w.physiqueCloud.plan='none';await w.document.getElementById('exportAccountBtn').onclick();
 assert.equal(calls.filter(x=>x[0]==='export_account_page').length,24);assert.ok(w.document.getElementById('accountToolsMessage').textContent.includes('downloaded'));dom.window.close();
});
test('account notifications render untrusted text safely and record read preferences through RPC',async()=>{
 const {w,dom,calls}=await mount({notes:[{id:'note-1',title:'<img src=x>',body:'<script>bad</script>',created_at:new Date().toISOString(),read_at:null}]});
 await w.document.getElementById('accountNotificationsBtn').onclick();assert.equal(w.document.querySelectorAll('#accountNotificationsList script,#accountNotificationsList img').length,0);
 await w.document.querySelector('#accountNotificationsList button').onclick();assert.ok(calls.some(x=>x[0]==='read_account_notification'));
 w.document.getElementById('coachingNudgesPreference').checked=false;await w.document.getElementById('saveCommunicationPreferences').onclick();assert.deepEqual(JSON.parse(JSON.stringify(calls.find(x=>x[0]==='set_communication_preferences')[1])),{nudges:false,marketing:false});dom.window.close();
});

test('member can withdraw a pending request but cannot submit after the account changes',async()=>{
 const {w,dom,calls}=await mount({deletion:{id:'request-1',status:'pending'}});
 await w.document.getElementById('checkDeletionRequestBtn').onclick();
 assert.equal(w.document.getElementById('withdrawDeletionRequestBtn').disabled,false);
 await w.document.getElementById('withdrawDeletionRequestBtn').onclick();
 assert.ok(calls.some(x=>x[0]==='withdraw_account_deletion'&&x[1].request_id==='request-1'));
 calls.length=0;w.physiqueCloud.user.id='another-account';
 await w.document.getElementById('withdrawDeletionRequestBtn').onclick();
 assert.equal(calls.some(x=>x[0]==='withdraw_account_deletion'),false);dom.window.close();
});
test('reviewed deletion requests direct members to support and disable withdrawal',async()=>{
 const {w,dom}=await mount({deletion:{id:'request-1',status:'in_progress'}});
 await w.document.getElementById('checkDeletionRequestBtn').onclick();
 assert.equal(w.document.getElementById('withdrawDeletionRequestBtn').disabled,true);
 assert.match(w.document.getElementById('deletionRequestStatus').textContent,/Contact support/);dom.window.close();
});
