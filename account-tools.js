(()=>{
const $=id=>document.getElementById(id), bucket='progress-photos';
const sections=['profiles','memberships','client_profiles','daily_checkins','measurements','progress_photos','meal_plans','training_programs','workout_sessions','billing_customers','subscriptions','entitlements','consent_events','attribution_events','product_events','beta_import_receipts','user_state_snapshots','user_app_state','support_tickets','support_replies','coach_notes','account_deletion_requests','account_notifications','communication_preferences'];
let offset=0,generation=0,deletionRequest=null,deletionGeneration=0;
function account(){const c=window.physiqueCloud;if(!c?.ready||!c.user)throw new Error('Sign in first.');return c;}
function same(id){if(window.physiqueCloud?.user?.id!==id)throw new Error('Account changed. Please retry.');}
function notice(id,text){$(id).textContent=text;}
async function rpc(name,args){const {data,error}=await account().client.rpc(name,args);if(error)throw error;return data;}
function download(data,name){const u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
async function exportAccount(){
 const b=$('exportAccountBtn');b.disabled=true;
 try{
  const c=account(),id=c.user.id,started=new Date().toISOString(),out={format:'physiqueos-account-export-v1',started_at:started,user_id:id,records:{},device_state:JSON.parse(JSON.stringify(state)),device_backups:{},photo_files_included:false};
  for(const suffix of ['_conflict','_recovery']){const raw=localStorage.getItem('physiqueOS_account_'+id+suffix);if(raw)out.device_backups[suffix]=JSON.parse(raw);}
  for(const section of sections){
   notice('accountToolsMessage','Exporting '+section.replaceAll('_',' ')+'…');out.records[section]=[];
   let page=0;
   do{same(id);const result=await rpc('export_account_page',{section,page_offset:page});same(id);out.records[section].push(...result.rows);page=result.next_offset;}while(page!==null);
  }
  out.finished_at=new Date().toISOString();same(id);download(out,'physiqueos-account-'+started.slice(0,10)+'.json');
  notice('accountToolsMessage','Account export downloaded. Photo files are separate; download them from the galleries. This is a record export, not an importable device backup.');
 }catch(e){notice('accountToolsMessage','Export failed: '+e.message);}finally{b.disabled=false;}
}
async function requestDeletion(){
 if(!confirm('Request deletion of your PhysiqueOS account? The owner must process the request and confirm any subscription cancellation and required record retention. Submitting this request does not immediately erase data or stop billing.'))return;
 const b=$('deleteAccountRequestBtn');b.disabled=true;
 try{const user=account().user.id;const id=await rpc('request_account_deletion');same(user);notice('accountToolsMessage','Deletion request saved: '+id+'. Your account remains active until the owner processes the request.');await deletionStatus();}
 catch(e){notice('accountToolsMessage',e.message);}finally{b.disabled=false;}
}
async function deletionStatus(){
 const version=++deletionGeneration;deletionRequest=null;$('withdrawDeletionRequestBtn').disabled=true;
 try{
  const c=account(),id=c.user.id;
  const {data,error}=await c.client.from('account_deletion_requests').select('id,status,requested_at').eq('user_id',id).in('status',['pending','in_progress']).order('requested_at',{ascending:false}).limit(1).maybeSingle();
  if(error)throw error;same(id);if(version!==deletionGeneration)return;
  deletionRequest=data?{...data,user:id}:null;
  notice('deletionRequestStatus',data?(data.status==='pending'?'Your deletion request is pending. You can withdraw it below.':'Your deletion request is under review. Contact support to change it.'):'You have no open deletion request.');
  $('withdrawDeletionRequestBtn').disabled=data?.status!=='pending';
 }catch(e){if(version===deletionGeneration)notice('deletionRequestStatus',e.message);}
}
async function withdrawDeletion(){
 const b=$('withdrawDeletionRequestBtn');b.disabled=true;
 try{
  const request=deletionRequest;if(!request||request.status!=='pending')throw new Error('Check your deletion request first.');same(request.user);
  await rpc('withdraw_account_deletion',{request_id:request.id});same(request.user);
  notice('accountToolsMessage','Your deletion request was withdrawn. Your account and billing remain unchanged.');await deletionStatus();
 }catch(e){notice('accountToolsMessage',e.message);await deletionStatus();}
}
async function uploadPhotos(){
 const b=$('uploadCloudPhotosBtn');b.disabled=true;
 try{
  const c=account(),id=c.user.id;if(c.plan==='none')throw new Error('Claim your membership before uploading photos.');
  const files=['front','side','back'].map(pose=>({pose,file:$('photo'+pose[0].toUpperCase()+pose.slice(1)).files[0]})).filter(x=>x.file);
  if(!files.length)throw new Error('Choose at least one progress photo above.');
  const types={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
  for(const {file} of files)if(!types[file.type]||file.size>10*1024*1024)throw new Error('Cloud photos must be JPEG, PNG, or WebP, up to 10 MB each.');
  const date=$('photoDate').value||new Date().toISOString().slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date)))throw new Error('Choose a valid photo date.');
  const {data:members,error:memberError}=await c.client.from('memberships').select('organization_id').eq('user_id',id).eq('status','active').order('created_at').limit(1);
  if(memberError)throw memberError;if(!members?.length)throw new Error('Your account needs an organization membership.');
  let saved=0;
  for(const {pose,file} of files){
   same(id);const photoId=crypto.randomUUID(),path=id+'/'+photoId+'.'+types[file.type];
   notice('cloudPhotoMessage','Uploading '+pose+' photo…');
   const {error:uploadError}=await c.client.storage.from(bucket).upload(path,file,{contentType:file.type,upsert:false});if(uploadError)throw uploadError;
   const {error:rowError}=await c.client.from('progress_photos').insert({id:photoId,user_id:id,organization_id:members[0].organization_id,storage_path:path,pose,captured_at:date+'T12:00:00Z'});
   if(rowError){const {error:cleanupError}=await c.client.storage.from(bucket).remove([path]);throw new Error(rowError.message+(cleanupError?' The uploaded file could not be cleaned up; contact support.':''));}
   same(id);saved++;
  }
  offset=0;await gallery();notice('cloudPhotoMessage',saved+' photo(s) saved privately to your account. Device photos remain separate.');
 }catch(e){notice('cloudPhotoMessage',e.message+' Any earlier successful uploads are retained. Refresh the gallery to review.');}finally{b.disabled=false;}
}
async function gallery(){
 const gen=++generation,holder=$('cloudPhotoGallery');holder.replaceChildren();
 try{
  const c=account(),id=c.user.id;
  const {data:rows,error}=await c.client.from('progress_photos').select('*').eq('user_id',id).order('captured_at',{ascending:false}).order('id').range(offset,offset+11);
  if(error)throw error;same(id);if(gen!==generation)return;
  for(const row of rows||[]){
   const {data,error:signError}=await c.client.storage.from(bucket).createSignedUrl(row.storage_path,300);same(id);if(gen!==generation)return;
   const tile=document.createElement('article');tile.className='photoTile';
   const label=document.createElement('p');label.textContent=row.captured_at.slice(0,10)+' • '+row.pose;tile.append(label);
   if(!signError&&data?.signedUrl){const image=document.createElement('img');image.src=data.signedUrl;image.alt=row.pose+' progress photo';image.loading='lazy';tile.append(image);}
   else {const msg=document.createElement('p');msg.textContent='Photo unavailable. Refresh or contact support.';tile.append(msg);}
   const save=document.createElement('button');save.textContent='Download photo';save.onclick=async()=>{
    save.disabled=true;try{same(id);const {data:blob,error}=await c.client.storage.from(bucket).download(row.storage_path);if(error)throw error;same(id);const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=row.storage_path.split('/').pop();a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}catch(e){notice('cloudPhotoMessage',e.message);}finally{save.disabled=false;}
   };tile.append(save);
   const remove=document.createElement('button');remove.textContent='Delete cloud photo';remove.onclick=async()=>{
    if(!confirm('Permanently delete this photo from your account? Any device copy stays on this device.'))return;
    remove.disabled=true;try{same(id);const {error}=await c.client.storage.from(bucket).remove([row.storage_path]);if(error)throw error;same(id);const {error:metadataError}=await c.client.from('progress_photos').delete().eq('id',row.id).eq('user_id',id);if(metadataError)throw metadataError;await gallery();}catch(e){notice('cloudPhotoMessage','Deletion failed: '+e.message);remove.disabled=false;}
   };tile.append(remove);holder.append(tile);
  }
  if(!rows?.length)holder.textContent=offset?'No more photos.':'No cloud photos saved yet.';
  $('cloudPhotosPrev').disabled=offset===0;$('cloudPhotosNext').disabled=(rows?.length||0)<12;
  notice('cloudPhotoMessage','Private account gallery. Refresh to renew previews after five minutes.');
 }catch(e){notice('cloudPhotoMessage',e.message);}
}
function init(){
 if(!$('accountToolsMessage'))return;
 $('exportAccountBtn').onclick=exportAccount;$('deleteAccountRequestBtn').onclick=requestDeletion;
 $('checkDeletionRequestBtn').onclick=deletionStatus;$('withdrawDeletionRequestBtn').onclick=withdrawDeletion;
 $('uploadCloudPhotosBtn').onclick=uploadPhotos;$('refreshCloudPhotosBtn').onclick=()=>{offset=0;gallery();};
 $('cloudPhotosPrev').onclick=()=>{offset=Math.max(0,offset-12);gallery();};$('cloudPhotosNext').onclick=()=>{offset+=12;gallery();};
 const dialog=document.createElement('dialog');dialog.className='membershipDialog';dialog.id='accountNotificationsDialog';
 dialog.innerHTML='<div class="sectionHead"><h2>Account notifications</h2><button id="closeAccountNotifications" aria-label="Close account notifications">✕</button></div><p id="accountNotificationsMessage" role="status"></p><div id="accountNotificationsList"></div><hr><h3>Communication preferences</h3><label><input id="coachingNudgesPreference" type="checkbox"> Helpful coaching reminders in the app</label><p>Account and billing notices stay available. Optional marketing emails are not enabled in this release.</p><button id="saveCommunicationPreferences">Save preference</button>';
 document.body.append(dialog);
 $('closeAccountNotifications').onclick=()=>dialog.close();
 async function notifications(){
  if(!dialog.open)dialog.showModal();
  const list=$('accountNotificationsList');list.replaceChildren();
  try{
   const c=account(),id=c.user.id;
   const {data:notes,error}=await c.client.from('account_notifications').select('*').eq('user_id',id).order('created_at',{ascending:false}).limit(50);if(error)throw error;same(id);
   for(const note of notes||[]){
    const item=document.createElement('article');item.className='tierCard';const title=document.createElement('h3');title.textContent=note.title;const body=document.createElement('p');body.textContent=note.body;const date=document.createElement('small');date.textContent=new Date(note.created_at).toLocaleString();item.append(title,body,date);
    if(!note.read_at){const read=document.createElement('button');read.textContent='Mark read';read.onclick=async()=>{read.disabled=true;try{same(id);await rpc('read_account_notification',{notification_id:note.id});read.textContent='Read';}catch(e){read.disabled=false;notice('accountNotificationsMessage',e.message);}};item.append(read);}
    list.append(item);
   }
   if(!notes?.length)list.textContent='No account notifications yet.';
   const {data:prefs,error:prefError}=await c.client.from('communication_preferences').select('*').eq('user_id',id).maybeSingle();if(prefError)throw prefError;same(id);
   $('coachingNudgesPreference').checked=prefs?.coaching_nudges??true;
   notice('accountNotificationsMessage','Latest 50 account messages. Use Get support for help or Manage billing to change your membership.');
  }catch(e){notice('accountNotificationsMessage',e.message);}
 }
 $('accountNotificationsBtn').onclick=notifications;
 $('saveCommunicationPreferences').onclick=async()=>{
  const b=$('saveCommunicationPreferences');b.disabled=true;
  try{await rpc('set_communication_preferences',{nudges:$('coachingNudgesPreference').checked,marketing:false});notice('accountNotificationsMessage','Communication preference saved.');}catch(e){notice('accountNotificationsMessage',e.message);}finally{b.disabled=false;}
 };
 document.addEventListener('physique:account-ready',async()=>{
  deletionGeneration++;deletionRequest=null;$('withdrawDeletionRequestBtn').disabled=true;notice('deletionRequestStatus','Check your current account’s deletion request above.');
  try{const c=account(),id=c.user.id;const {data,error}=await c.client.from('account_notifications').select('id').eq('user_id',id).eq('event_key','welcome').is('read_at',null).limit(1);if(error)throw error;same(id);if(data?.length&&!$('membershipDialog')?.open)await notifications();}catch{/* Notifications remain available from the account menu when offline. */}
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
