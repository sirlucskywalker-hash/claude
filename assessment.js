/* Optional local video preview plus cloud-synced written starting assessment. */
(()=>{
 'use strict';
 const E=window.PhysiqueAssessment,$=id=>document.getElementById(id);
 const host=$('startingAssessment');if(!host)return;
 const choices={experience:['Training history',[['new','Never lifted consistently'],['returning','Returning after time away'],['consistent','Training consistently']]],breakLength:['Time away',[['none','No recent break'],['short','Less than six weeks'],['long','Six weeks or more']]],pain:['Pain during everyday movement or exercise',[['no','No'],['yes','Yes'],['unsure','Unsure']]],injury:['Injury / surgery status',[['none','None to report'],['resolved','Previous issue; no current restrictions or symptoms'],['restricted','Current clinician restrictions or rehabilitation'],['unreviewed','Current issue not yet reviewed']]],mobility:['Movement and accessibility',[['comfortable','Everyday movements feel comfortable'],['limited','Some movements or positions are limited'],['assisted','I need assistance or feel unstable']]],symptoms:['Chest discomfort, unusual breathlessness, fainting or unexplained weakness',[['no','None reported'],['yes','Yes'],['unsure','Unsure']]],condition:['Heart, metabolic, kidney or other condition needing exercise guidance',[['no','None reported'],['yes','Yes'],['unsure','Unsure']]]};
 host.innerHTML='<span class="kicker">YOUR STARTING POINT</span><h2>A plan that meets you where you are</h2><p>Complete this alongside your profile. Your answers guide starter volume, effort and schedule. This is a fitness screening, not a medical examination or clearance. <a href="safety.html" target="_blank" rel="noopener">Read health and AI disclosures</a>.</p><form id="startingAssessmentForm"><div class="grid">'+Object.entries(choices).map(([key,[label,options]])=>'<label>'+label+'<select name="'+key+'" required><option value="">Choose…</option>'+options.map(([v,t])=>'<option value="'+v+'">'+t+'</option>').join('')+'</select></label>').join('')+'<label>Available days each week<input name="days" type="number" min="1" max="6" required></label><label>Comfortable time per session · minutes<input name="minutes" type="number" min="15" max="90" required></label></div><fieldset><legend>Areas that limit exercise choice</legend>'+['shoulder','elbow','wrist','low back','hip','knee','ankle'].map(a=>'<label><input type="checkbox" name="area" value="'+a+'"> '+a+'</label>').join('')+'</fieldset><label>Goals, current abilities, access needs and clinician restrictions<textarea name="notes" maxlength="3000" rows="3" placeholder="What do you want to improve? What is comfortable? What support or equipment do you need?"></textarea></label><p>Your written answers are saved with your account when cloud synchronization is available. Avoid unnecessary medical identifiers. Injury restrictions need qualified review.</p><button type="submit" class="primary">Save starting assessment</button></form><p id="startingAssessmentStatus" role="status"></p><div id="startingAssessmentResult"></div><button id="applyStartingPlan" type="button" disabled>Apply starter settings and generate program</button><details id="guidedPosingAssessment"><summary>Guided posing checkpoint · Pro / Founding and above</summary><p>Use relaxed front, side and back views at a consistent distance and lighting. Stand or sit comfortably, breathe normally, and use support if needed. Skip painful positions and forced flexing. These are self-reported posing checkpoints, not AI analysis or a mobility test. You can use your existing private photo gallery separately.</p><form id="posingCheckpointForm"><fieldset><legend>Views practiced comfortably</legend><label><input name="poseview" type="checkbox" value="front"> Front</label><label><input name="poseview" type="checkbox" value="side"> Side</label><label><input name="poseview" type="checkbox" value="back"> Back</label></fieldset><label>Practice notes<textarea name="posenotes" maxlength="3000" rows="2"></textarea></label><button type="submit" disabled>Save posing checkpoint</button></form><p id="posingCheckpointStatus" role="status"></p></details><details id="premiumVideoAssessment"><summary>Premium AI movement video · awaiting activation</summary><p id="premiumVideoAccess">Elite and Concierge premium option. Provider setup and launch validation are still pending.</p><p>Record up to 15 seconds of a movement you already perform comfortably. Use a clear, fixed camera, one person in frame, and clothing you feel comfortable in. Skip anything painful, unstable, restricted or unfamiliar; a seated movement is an option. Do not attempt maximum loads, balance challenges or forced stretches for this clip.</p><label class="fileBtn">Record / choose video<input id="assessmentVideoFile" type="file" accept="video/mp4,video/webm,video/quicktime" capture="environment"></label><label>Camera view<select id="assessmentVideoView"><option value="side">Side view</option><option value="front">Front / other view</option></select></label><video id="assessmentVideoPreview" controls playsinline muted preload="metadata" style="width:100%;max-height:320px" hidden></video><label><input id="assessmentVideoConsent" type="checkbox"> I understand this experimental AI processes my clip on this device. Downloading the model contacts Google and jsDelivr; the app does not upload my clip. It cannot diagnose an injury, establish safe loads or give medical clearance.</label><div class="buttons"><button id="analyzeAssessmentVideo" type="button">Analyze on this device</button><button id="clearAssessmentVideo" type="button">Clear local clip</button><button id="saveAssessmentVideoSummary" type="button" disabled>Save summary with my assessment</button></div><label><input id="premiumProviderConsent" type="checkbox"> I consent to sending six sampled video frames and my synchronized written assessment to OpenAI through PhysiqueOS for preliminary AI coaching feedback. OpenAI may retain data for abuse monitoring; this is not a zero-retention or medical service. The report is stored in my account for authorized staff review.</label><button id="requestPremiumVideoReport" type="button" disabled>Request premium AI report</button><p id="assessmentVideoStatus" role="status"></p><pre id="assessmentVideoResult" style="white-space:pre-wrap;overflow-wrap:anywhere"></pre><p>Only the numeric summary is saved when you choose Save summary. It may sync to your account and be visible to authorized staff. Raw clips and landmarks are not stored in account records. A poor recording yields no finding; observations never override written restrictions or automatically change a program.</p></details>';
 host.insertAdjacentHTML('beforeend','<details><summary>Saved assessment reports and feedback</summary><p>Only your signed-in account records appear here. Owner feedback is a service review, not medical clearance.</p><button id="refreshAssessmentHistory" type="button">Refresh my reports</button><p id="assessmentHistoryStatus" role="status"></p><div id="assessmentHistory"></div></details>');
 let historyVersion=0;
 let generation=0,clipUrl=null,worker=null,summary=null,providerFrames=[],providerDuration=0,ownerPreview=false,analyzing=false,premiumBusy=false,pending=new Map(),requestNumber=0;
 const identity=()=>window.physiqueCloud?.user?.id||'device';
 const status=t=>{$('assessmentVideoStatus').textContent=t;};
 const premium=()=>ownerPreview||!!window.hasPhysiqueFeature?.('ai_video_assessment');
 const posing=()=>!!window.hasPhysiqueFeature?.('guided_posing');
 function render(){
  const current=state.startingAssessment,plan=E.evaluate(current?.answers,state.profile);
  const result=$('startingAssessmentResult');result.replaceChildren();$('applyStartingPlan').disabled=!plan||plan.paused;
  $('analyzeAssessmentVideo').disabled=!premium()||analyzing||premiumBusy;$('requestPremiumVideoReport').disabled=!premium()||premiumBusy||analyzing||providerFrames.length!==6||summary?.quality!=='preliminary';
  $('posingCheckpointForm').querySelector('button').disabled=!posing();
  if(!plan)return;
  const title=document.createElement('h3');title.textContent=plan.label;result.append(title);
  const p=document.createElement('p');p.textContent=plan.paused?plan.reasons.join(' '):`${plan.days} day(s) per week, up to ${plan.minutes} minutes, up to ${plan.maxSets} sets per movement, at least ${plan.minRir} reps in reserve. ${plan.reviewAfter}`;result.append(p);
  if(current.videoSummary){const note=document.createElement('p');note.textContent='Saved video preview: '+current.videoSummary.quality+'. '+current.videoSummary.limitations;result.append(note);}
 }
 function loadForm(){const f=$('startingAssessmentForm'),a=state.startingAssessment?.answers||{};f.reset();for(const key of [...Object.keys(choices),'days','minutes','notes'])f.elements[key].value=a[key]??'';f.querySelectorAll('[name="area"]').forEach(x=>x.checked=(a.areas||[]).includes(x.value));render();}
 $('startingAssessmentForm').onsubmit=e=>{
  e.preventDefault();const f=e.target;
  try{
   const answers=E.validate(Object.fromEntries([...Object.keys(choices),'days','minutes','notes'].map(k=>[k,f.elements[k].value]).concat([['areas',[...f.querySelectorAll('[name="area"]:checked')].map(x=>x.value)]])));
   if(state.startingAssessment)state.startingAssessmentHistory=[...(state.startingAssessmentHistory||[]).slice(-9),state.startingAssessment];
   state.startingAssessment={version:1,recordedAt:new Date().toISOString(),answers};save();renderAll();render();
   $('startingAssessmentStatus').textContent='Written assessment saved. Video is optional. Your answers determine whether automated programming can proceed.';
   clearClip();
  }catch(error){$('startingAssessmentStatus').textContent=error.message;}
 };
 $('applyStartingPlan').onclick=()=>{
  const plan=E.evaluate(state.startingAssessment?.answers,state.profile);if(!plan||plan.paused)return;
  if(state.guidedSession&&['ready','active'].includes(state.guidedSession.status)){ $('startingAssessmentStatus').textContent='Finish or end your current guided session before replacing the program.';return;}
  if(!state.profile.age){$('startingAssessmentStatus').textContent='Save your profile below first.';return;}
  if(!confirm('Replace your planned program using these starter settings? Completed workout history stays saved.'))return;
  state.profile.days=plan.days;state.profile.sessionLength=plan.minutes;save();generateTraining();loadProfile();render();
 };
 function clearClip(){
  generation++;analyzing=false;premiumBusy=false;summary=null;providerFrames=[];providerDuration=0;worker?.terminate();worker=null;
  for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Video analysis canceled.'));}pending.clear();
  const v=$('assessmentVideoPreview');v.pause();v.removeAttribute('src');v.hidden=true;
  if(clipUrl)URL.revokeObjectURL(clipUrl);clipUrl=null;$('assessmentVideoFile').value='';$('assessmentVideoConsent').checked=false;$('premiumProviderConsent').checked=false;
  $('assessmentVideoResult').textContent='';$('saveAssessmentVideoSummary').disabled=true;$('requestPremiumVideoReport').disabled=true;$('analyzeAssessmentVideo').disabled=!premium();status('Local clip cleared.');
 }
 $('clearAssessmentVideo').onclick=clearClip;
 $('assessmentVideoView').onchange=()=>{clearClip();status('Camera view changed. Choose your clip again before analysis.');};
 $('assessmentVideoFile').onchange=()=>{
  const file=$('assessmentVideoFile').files?.[0];clearClip();if(!file)return;
  if(!file.type.startsWith('video/')||file.size>40*1024*1024){status('Choose a video up to 40 MB and 15 seconds.');return;}
  clipUrl=URL.createObjectURL(file);const v=$('assessmentVideoPreview');v.src=clipUrl;v.hidden=false;status('Preview your clip, complete screening and review the consent above before analysis.');
 };
 function ask(type,extra={},transfer=[]){
  return new Promise((resolve,reject)=>{const id=++requestNumber,timer=setTimeout(()=>{pending.delete(id);reject(Error('AI processing timed out. Clear the clip and retry, or continue with the written assessment.'));},45000);pending.set(id,{resolve,reject,timer});worker.postMessage({id,type,...extra},transfer);});
 }
 async function seek(v,t){
  if(Math.abs(v.currentTime-t)<.001&&v.readyState>=2)return;
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>done(Error('Video could not be decoded. Try a short MP4 clip.')),10000);function done(e){clearTimeout(timer);v.removeEventListener('seeked',ok);v.removeEventListener('error',bad);e?reject(e):resolve();}const ok=()=>done(),bad=()=>done(Error('Video could not be decoded.'));v.addEventListener('seeked',ok,{once:true});v.addEventListener('error',bad,{once:true});v.currentTime=t;});
 }
 $('analyzeAssessmentVideo').onclick=async()=>{
  if(analyzing||premiumBusy)return;
  if(!premium()){status('Premium AI video is planned for Elite and Concierge. Written assessment and eligible posing options remain available.');return;}
  const plan=E.evaluate(state.startingAssessment?.answers,state.profile);
  if(!plan||!plan.videoAllowed){status('Complete screening first. Review flagged symptoms or restrictions before a movement video.');return;}
  if(!$('assessmentVideoConsent').checked||!clipUrl){status('Choose a clip and confirm the video consent first.');return;}
  if(!window.Worker||!window.createImageBitmap||!window.OffscreenCanvas){status('AI video is unsupported on this device. Your written assessment still works.');return;}
  const v=$('assessmentVideoPreview');if(!Number.isFinite(v.duration)||v.duration<2||v.duration>15||!v.videoWidth){status('Choose a readable clip between 2 and 15 seconds. Wait for its preview to load first.');return;}
  analyzing=true;const token=++generation,user=identity(),view=$('assessmentVideoView').value,frames=[];summary=null;providerFrames=[];providerDuration=v.duration;$('saveAssessmentVideoSummary').disabled=true;$('analyzeAssessmentVideo').disabled=true;
  const same=()=>{if(token!==generation||user!==identity())throw Error('Account or clip changed. Analysis discarded.');};
  try{
   worker?.terminate();worker=new Worker(new URL('assessment-worker.js',location.href));
   worker.onmessage=({data})=>{const p=pending.get(data.id);if(!p)return;clearTimeout(p.timer);pending.delete(data.id);data.error?p.reject(Error(data.error)):p.resolve(data);};
   worker.onerror=()=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('AI video failed on this device. Continue with the written assessment.'));}pending.clear();};
   status('Downloading the AI model… your clip remains on this device.');await ask('init');same();v.pause();
   const count=Math.min(30,Math.max(10,Math.floor(v.duration*2)));
   for(let i=0;i<count;i++){same();await seek(v,(i+.5)*v.duration/count);same();const bitmap=await createImageBitmap(v);same();const data=await ask('frame',{bitmap},[bitmap]);same();frames.push(data.landmarks);
    if(Array.from({length:6},(_,j)=>Math.floor(j*(count-1)/5)).includes(i)){const canvas=document.createElement('canvas');canvas.width=Math.min(512,v.videoWidth);canvas.height=Math.max(1,Math.round(canvas.width*v.videoHeight/v.videoWidth));canvas.getContext('2d').drawImage(v,0,0,canvas.width,canvas.height);providerFrames.push({time:v.currentTime,image:canvas.toDataURL('image/jpeg',.65)});}status(`Analyzing frame ${i+1} of ${count}…`);}
   summary=E.summarize(frames,v.videoWidth,v.videoHeight,view);summary.recordedAt=new Date().toISOString();summary.account=user;
   $('assessmentVideoResult').textContent=JSON.stringify({...summary,account:undefined},null,2);
   status(summary.quality==='insufficient'?'No reliable finding. Use a clearer recording or continue with the written assessment.':'Preliminary movement observations ready. Review them before choosing whether to save.');$('saveAssessmentVideoSummary').disabled=false;$('requestPremiumVideoReport').disabled=summary.quality!=='preliminary';
  }catch(error){if(token===generation)status(error.message);}finally{if(token===generation){worker?.terminate();worker=null;analyzing=false;$('analyzeAssessmentVideo').disabled=!premium();}}
 };
 $('saveAssessmentVideoSummary').onclick=()=>{
  if(!summary||summary.account!==identity()||!state.startingAssessment)return;
  const {account,...report}=summary;state.startingAssessment.videoSummary=report;save();render();status('Summary saved with your assessment. Raw video remains local.');
 };
 
 $('posingCheckpointForm').onsubmit=async event=>{
  event.preventDefault();const f=event.target,b=f.querySelector('button'),user=identity();b.disabled=true;
  try{
   const c=window.physiqueCloud;if(!c?.ready||!posing())throw Error('Pro posing access is required.');
   const views=[...f.querySelectorAll('[name="poseview"]:checked')].map(x=>x.value);
   const {error}=await c.client.rpc('record_posing_assessment',{views,notes:f.elements.posenotes.value});if(error)throw error;
   if(user!==identity())return;$('posingCheckpointStatus').textContent='Posing checkpoint saved to your account. No body composition or injury assessment was inferred.';
  }catch(e){if(user===identity())$('posingCheckpointStatus').textContent=e.message;}finally{if(user===identity())b.disabled=!posing();}
 };
 $('requestPremiumVideoReport').onclick=async()=>{
  const user=identity(),token=generation,b=$('requestPremiumVideoReport');
  if(analyzing||premiumBusy||!premium()||summary?.quality!=='preliminary'||providerFrames.length!==6||!$('premiumProviderConsent').checked){status('Premium access, a prepared clip and provider-processing consent are required.');return;}
  const c=window.physiqueCloud;if(!c?.ready){status('Sign in and synchronize your written assessment first.');return;}
  premiumBusy=true;b.disabled=true;status('Requesting your premium AI report… it will require review before programming.');
  try{
   const requestId=crypto.randomUUID();
   const {data,error}=await c.client.functions.invoke('analyze-video-assessment',{body:{requestId,view:$('assessmentVideoView').value,duration:providerDuration,frames:providerFrames,consent:'ai-video-v1',poseSummary:summary}});
   if(user!==identity()||token!==generation)return;
   if(error)throw Error('Premium report is unavailable. Provider activation or access may still be pending.');if(data?.error)throw Error(data.error);
   $('assessmentVideoResult').textContent='AI report · needs review\n'+JSON.stringify(data.report,null,2);status('Report saved for authorized review. Your training program was not automatically changed.');loadHistory();
  }catch(e){if(user===identity()&&token===generation)status(e.message);}finally{if(user===identity()&&token===generation){premiumBusy=false;b.disabled=!premium();}}
 };

 async function loadHistory(){
  const version=++historyVersion,user=identity(),c=window.physiqueCloud,output=$('assessmentHistory'),message=$('assessmentHistoryStatus');output.replaceChildren();
  if(!c?.ready||!c.user?.id){message.textContent='Sign in to view your saved account reports.';return;}
  message.textContent='Loading your reports…';
  try{
   const {data,error}=await c.client.from('assessment_records').select('*').eq('user_id',c.user.id).order('created_at',{ascending:false}).limit(20);
   if(version!==historyVersion||user!==identity())return;if(error)throw error;
   const rows=data||[];message.textContent=rows.length===20?'Showing your 20 most recent records. Account export includes the full history.':`${rows.length} saved assessment record(s).`;
   for(const record of rows){
    const article=document.createElement('article'),title=document.createElement('h4'),content=document.createElement('pre');
    title.textContent=`${record.kind==='ai_video'?'AI report':'Posing checkpoint'} · ${record.created_at}`;content.style.whiteSpace='pre-wrap';
    content.textContent=JSON.stringify({status:record.status,report:record.report,posing:record.kind==='posing'?record.input:undefined,review_outcome:record.review_outcome,review_note:record.review_note,reviewed_at:record.reviewed_at},null,2);
    article.append(title,content);output.append(article);
   }
  }catch(e){if(version===historyVersion&&user===identity())message.textContent=e.message;}
 }
 $('refreshAssessmentHistory').onclick=loadHistory;
 document.addEventListener('physique:render',render);
 document.addEventListener('physique:account-ready',async()=>{clearClip();ownerPreview=false;loadForm();loadHistory();const user=identity(),c=window.physiqueCloud;if(c?.client){const {data,error}=await c.client.rpc('is_physiqueos_owner');if(user!==identity())return;ownerPreview=!error&&Boolean(data);render();}});
 window.addEventListener('pagehide',clearClip);loadForm();loadHistory();
})();
