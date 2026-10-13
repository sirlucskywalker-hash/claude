import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
import {validateVideoRequest,validateReport,providerPayload} from '../supabase/functions/_shared/video-assessment-logic.mjs';
import {createVideoAssessmentHandler} from '../supabase/functions/_shared/video-assessment-handler.mjs';
const root=new URL('../',import.meta.url),context=vm.createContext({});
vm.runInContext(await readFile(new URL('assessment-engine.js',root),'utf8'),context);const E=context.PhysiqueAssessment;
const answers=(extra={})=>({experience:'new',breakLength:'none',pain:'no',injury:'none',mobility:'comfortable',symptoms:'no',condition:'no',days:4,minutes:30,areas:[],notes:'Build consistency',...extra});
test('novice and returning baselines cap volume, effort and schedule without treating camera data as clearance',()=>{
 const p=E.evaluate(answers(),{days:5,sessionLength:60});assert.equal(p.days,3);assert.equal(p.maxSets,2);assert.equal(p.minRir,4);
 assert.equal(E.evaluate(answers({experience:'consistent',breakLength:'long'})).maxSets,2);
 assert.equal(E.evaluate(answers({experience:'consistent'})).maxSets,4);
 assert.equal(E.evaluate(answers({days:1})).days,1);assert.equal(E.evaluate(null),null);
});
test('symptoms, injury restrictions, assistance and incomplete answers stop automatic programming',()=>{
 for(const a of [answers({symptoms:'yes'}),answers({pain:'unsure'}),answers({condition:'yes'}),answers({injury:'restricted'}),answers({mobility:'assisted'}),{}]){const p=E.evaluate(a);assert.equal(p.paused,true);assert.equal(p.videoAllowed,false);}
 assert.equal(E.evaluate(answers(),{acuteInjury:true}).paused,true);
 assert.throws(()=>E.validate(answers({areas:['anything']})));assert.throws(()=>E.validate(answers({minutes:0})));
});
function pose(){const p=Array.from({length:33},()=>({x:.5,y:.5,visibility:1}));for(const [i,x,y] of [[11,.3,.2],[13,.3,.4],[15,.3,.6],[12,.7,.2],[14,.7,.4],[16,.7,.6],[23,.4,.5],[25,.4,.7],[27,.4,.9],[24,.6,.5],[26,.6,.7],[28,.6,.9]])p[i]={x,y,visibility:1};return p;}
test('pose summary refuses poor and multiple-person frames and corrects angle aspect ratio',()=>{
 const p=pose(),good=E.summarize(Array.from({length:12},()=>[p]),1920,1080,'side');assert.equal(good.quality,'preliminary');assert.equal(good.jointMotion.leftKnee.projectedAngleSpanDegrees,0);
 assert.equal(E.summarize(Array.from({length:12},()=>[p,p]),1920,1080).quality,'insufficient');
 assert.equal(Object.keys(E.summarize(Array.from({length:12},()=>[p]),1920,1080,'front').jointMotion).length,0);
 assert.equal(E.summarize([[]],100,100).quality,'insufficient');assert.ok(E.angle({x:0,y:0},{x:1,y:1},{x:2,y:0},2,1)>120);
});
const request=()=>({requestId:'10000000-0000-4000-8000-000000000007',consent:'ai-video-v1',duration:10,view:'side',poseSummary:{sampledFrames:12,usableFrames:12,quality:'preliminary',multiplePersonFrames:0,view:'side',jointMotion:{}},frames:Array.from({length:6},(_,i)=>({time:i+1,image:'data:image/jpeg;base64,/9j/AA=='}))});
const report=()=>({summary:'Preliminary observations only',observations:['Visible posture at sampled moments'],uncertainties:['Camera perspective and unobserved moments'],follow_up_questions:['What is comfortable?'],program_suggestions:['Discuss technique practice with your coach']});
test('premium request validation prevents arbitrary URLs, overlong clips, missing consent and unreliable observations',()=>{
 assert.equal(validateVideoRequest(request()).frames.length,6);
 for(const changes of [{consent:'no'},{duration:16},{poseSummary:{quality:'insufficient'}},{frames:[{time:0,image:'https://example.com/private'}]}])assert.throws(()=>validateVideoRequest({...request(),...changes}));
 assert.throws(()=>validateReport({...report(),diagnosis:'invented'}));
 const payload=providerPayload('configured-model',validateVideoRequest(request()),answers());assert.equal(payload.store,false);assert.equal(payload.input[0].content.filter(x=>x.type==='input_image').length,6);assert.equal(payload.tools,undefined);
});
const source={};for(const name of ['index.html','data.js','app.js','assessment-engine.js','assessment.js'])source[name]=await readFile(new URL(name,root),'utf8');
function mount(seed={}){
 const dom=new JSDOM(source['index.html'],{url:'https://example.com/app/',runScripts:'outside-only'}),w=dom.window;
 w.alert=()=>{};w.confirm=()=>true;w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:()=>()=>{}});w.HTMLMediaElement.prototype.pause=()=>{};w.URL.createObjectURL=()=> 'blob:local';w.URL.revokeObjectURL=()=>{};w.hasPhysiqueFeature=()=>false;
 w.indexedDB={open(){const r={};queueMicrotask(()=>{r.result={objectStoreNames:{contains:()=>true},close(){},transaction(){return{objectStore(){return{get(){const q={result:null};queueMicrotask(()=>q.onsuccess?.());return q;},getAll(){const q={result:[]};queueMicrotask(()=>q.onsuccess?.());return q;}}}}}};r.onsuccess?.();});return r;}};
 w.localStorage.setItem('physiqueOS',JSON.stringify({profile:{age:34,days:4,sessionLength:60,experience:'advanced',trainingGoal:'strength',equipment:['bodyweight','machines','dumbbells','bench']},...seed}));
 const c=dom.getInternalVMContext();for(const name of ['assessment-engine.js','data.js','app.js','assessment.js'])vm.runInContext(source[name],c,{filename:name});
 return {dom,w,run:code=>vm.runInContext(code,c),state:()=>vm.runInContext('state',c)};
}
test('real program generator honors written starter caps and retains assessment through profile edits',async()=>{
 const t=mount({startingAssessment:{answers:answers({days:1})}});try{
  t.run('generateTraining()');assert.equal(t.state().trainingPlan.length,1);assert.ok(t.state().trainingPlan[0].items.every(x=>x.sets===2&&x.rir===4&&x.minReps===8));
  t.run('loadProfile()');t.w.document.getElementById('age').value='35';t.run('saveProfile()');assert.equal(t.state().startingAssessment.answers.days,1);
 }finally{await new Promise(r=>setImmediate(r));t.dom.window.close();}
});
test('blocked screening suppresses existing plans; low tiers cannot start premium inference',async()=>{
 const t=mount({startingAssessment:{answers:answers({pain:'yes'})},trainingPlan:[{name:'Old plan',items:[]}]});try{
  assert.equal(t.run('trainingBlocked(state.profile)'),true);assert.match(t.w.document.getElementById('startingAssessmentResult').textContent,/review/i);
  await t.w.document.getElementById('analyzeAssessmentVideo').onclick();assert.match(t.w.document.getElementById('assessmentVideoStatus').textContent,/planned/);
  assert.equal(t.w.document.getElementById('posingCheckpointForm').querySelector('button').disabled,true);
 }finally{await new Promise(r=>setImmediate(r));t.dom.window.close();}
});
test('written form rejects missing answers and renders hostile notes as plain text',async()=>{
 const t=mount();try{
  const f=t.w.document.getElementById('startingAssessmentForm');f.onsubmit({preventDefault(){},target:f});assert.equal(t.state().startingAssessment,undefined);
  for(const [k,v] of Object.entries(answers()))if(f.elements[k])f.elements[k].value=v;
  f.elements.notes.value='<script>bad()</script>';f.onsubmit({preventDefault(){},target:f});assert.equal(t.state().startingAssessment.answers.notes,'<script>bad()</script>');assert.equal(t.w.document.querySelector('#startingAssessmentResult script'),null);
 }finally{await new Promise(r=>setImmediate(r));t.dom.window.close();}
});
function server({allowed=true,owner=false,enabled=true,providerOk=true,existing=null}={}){
 const calls=[],writes=[],env=k=>({SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'public-placeholder',SUPABASE_SERVICE_ROLE_KEY:'private-placeholder',SITE_URL:'https://example.com',AI_VIDEO_ENABLED:enabled?'true':'false',OPENAI_API_KEY:'test-placeholder',AI_VIDEO_MODEL:'test-model'}[k]);
 globalThis.Deno={env:{get:env}};
 const client={auth:{getUser:async()=>({data:{user:{id:'member',email_confirmed_at:'2026-10-13'}}})},rpc:async(name)=>{calls.push(name);return {data:name==='has_feature'?allowed:name==='is_physiqueos_owner'?owner:existing||{created:true}};},from:table=>{const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:{state:{profile:{},startingAssessment:{answers:answers()}}}}),update:data=>{writes.push({table,data});return q;},then:resolve=>Promise.resolve({}).then(resolve)};return q;}};
 const handler=createVideoAssessmentHandler({env,createClient:()=>client,engine:E,fetch:async(_url,opts)=>{calls.push('provider');const payload=JSON.parse(opts.body);assert.equal(payload.store,false);return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(report())}]}]},{status:providerOk?200:503});}});
 const call=(authorization=true)=>handler(new Request('https://example.com/function',{method:'POST',headers:authorization?{Authorization:'Bearer authenticated-placeholder'}:{},body:JSON.stringify(request())}));return {call,calls,writes};
}
test('real handler rejects anonymous and non-premium callers before any provider request',async()=>{
 let s=server();assert.equal((await s.call(false)).status,401);assert.equal(s.calls.length,0);
 s=server({allowed:false});assert.equal((await s.call()).status,403);assert.equal(s.calls.includes('provider'),false);
 s=server({enabled:false,owner:true});assert.equal((await s.call()).status,503);assert.equal(s.calls.includes('reserve_ai_video_assessment'),false);
});
test('premium handler saves a review-required report, marks failures and serves idempotent results without another charge',async()=>{
 let s=server();assert.equal((await s.call()).status,200);assert.equal(s.writes[0].data.status,'needs_review');assert.equal(s.calls.filter(x=>x==='provider').length,1);
 s=server({providerOk:false});assert.equal((await s.call()).status,503);assert.equal(s.writes[0].data.status,'failed');
 s=server({existing:{created:false,status:'needs_review',report:report()}});assert.equal((await s.call()).status,200);assert.equal(s.calls.includes('provider'),false);
 delete globalThis.Deno;
});

test('member report history uses account ownership and renders feedback as text',async()=>{
 const t=mount();try{
  let ownerFilter;const query={select:()=>query,eq:(key,value)=>{ownerFilter={key,value};return query;},order:()=>query,limit:async()=>({data:[{kind:'ai_video',created_at:'today',report:{summary:'<img src=x onerror=alert(1)>'},review_note:'<script>bad()</script>'}]})};
  t.w.physiqueCloud={ready:true,user:{id:'member'},client:{from:table=>{assert.equal(table,'assessment_records');return query;}}};
  await t.w.document.getElementById('refreshAssessmentHistory').onclick();assert.deepEqual(ownerFilter,{key:'user_id',value:'member'});
  assert.match(t.w.document.getElementById('assessmentHistory').textContent,/bad/);assert.equal(t.w.document.querySelector('#assessmentHistory script'),null);assert.equal(t.w.document.querySelector('#assessmentHistory img'),null);
 }finally{await new Promise(r=>setImmediate(r));t.dom.window.close();}
});
test('a response from a previous account cannot reappear in assessment history',async()=>{
 const t=mount();try{
  let resolve;const pending=new Promise(r=>resolve=r);const query={select:()=>query,eq:()=>query,order:()=>query,limit:()=>pending};
  t.w.physiqueCloud={ready:true,user:{id:'previous'},client:{from:()=>query}};
  const read=t.w.document.getElementById('refreshAssessmentHistory').onclick();
  t.w.physiqueCloud={ready:false,user:null};await t.w.document.getElementById('refreshAssessmentHistory').onclick();
  resolve({data:[{kind:'ai_video',report:{summary:'PREVIOUS_ACCOUNT_PRIVATE_REPORT'}}]});await read;
  assert.doesNotMatch(t.w.document.getElementById('assessmentHistory').textContent,/PREVIOUS_ACCOUNT/);
  assert.match(t.w.document.getElementById('assessmentHistoryStatus').textContent,/Sign in/);
 }finally{await new Promise(r=>setImmediate(r));t.dom.window.close();}
});
