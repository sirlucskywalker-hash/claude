import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
const files={};for(const name of ['index.html','data.js','app.js','coach-engine.js','coaching.js'])files[name]=await readFile(new URL('../'+name,import.meta.url),'utf8');
const coreContext=vm.createContext({});vm.runInContext(files['coach-engine.js'],coreContext);const E=coreContext.PhysiqueCoachEngine;
const item={name:'Leg Press',sets:2,minReps:8,maxReps:12,rir:2,muscle:'quads'};
const fixture=()=>({id:'session',date:'2026-10-01',status:'active',items:[item,{...item,name:'Seated Leg Curl'}],results:{},actions:[],skipped:[]});
test('rest reconstructs from timestamps after suspension and remains paused across reload',()=>{
 const start=E.rest(120,1000);assert.equal(E.remaining(start,61000),60);
 const paused=E.pause(start,61000);assert.equal(E.remaining(JSON.parse(JSON.stringify(paused)),300000),60);
 const resumed=E.pause(paused,300000);assert.equal(E.remaining(resumed,330000),30);
 assert.equal(E.remaining(start,400000),0);assert.equal(E.remaining(start,-10000),120);
});
test('extending rest preserves paused time and can restart an expired target',()=>{
 assert.equal(E.remaining(E.extend(E.pause(E.rest(60,0),10000),30,300000),400000),80);
 assert.equal(E.remaining(E.extend(E.rest(60,0),30,100000),100000),30);
});
test('set validation permits bodyweight, rejects impossible input and does not mutate on failure',()=>{
 assert.equal(E.validateSet({weight:0,reps:12,rir:''}).rir,null);
 for(const x of [{weight:'',reps:10},{weight:20,reps:0},{weight:20,reps:2.5},{weight:20,reps:8,rir:10}])assert.throws(()=>E.complete(fixture(),x));
 assert.equal(E.summary(fixture()).sets,0);
});
test('complete, skip and undo preserve prior movement names and results',()=>{
 let s=E.complete(fixture(),{weight:100,reps:10,rir:2});assert.equal(E.next(s).si,1);
 s.skipped=[0];assert.equal(E.next(s).ei,1);s=E.undo(s);assert.equal(E.next(s).ei,0);
 assert.equal(E.summary(s).sets,0);assert.equal(E.summary(E.complete(s,{weight:100,reps:10,rir:2})).volume,1000);
});
test('pain overrides a progression cue and unknown effort never invents RIR',()=>{
 assert.match(E.cue(item,{weight:100,reps:12,rir:3},3),/Pause/);
 assert.match(E.cue(item,{weight:100,reps:12,rir:null}),/Log RIR/);
});
test('plate helper handles asymmetric leftovers and requires an exactly reachable load',()=>{
 assert.equal(JSON.stringify(E.plates(135,45,[45,25,10,5,2.5])),'[45]');
 assert.equal(E.plates(136,45,[45,25,10,5,2.5]),null);
 assert.equal(E.plates(20,45,[5]),null);
});
function mount(seed={}){
 const dom=new JSDOM(files['index.html'],{url:'https://example.com/app/',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;w.alert=()=>{};w.confirm=()=>true;w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:()=>()=>{}});
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 w.indexedDB={open(){const r={};queueMicrotask(()=>{r.result={objectStoreNames:{contains:()=>true},close(){},transaction(){return{objectStore(){return{get(){const q={result:null};queueMicrotask(()=>q.onsuccess?.());return q;},getAll(){const q={result:[]};queueMicrotask(()=>q.onsuccess?.());return q;}}}}}};r.onsuccess?.();});return r;}};
 w.localStorage.setItem('physiqueOS' ,JSON.stringify({profile:{age:34,units:'imperial',sessionLength:60},trainingPlan:[{name:'Lower A',items:[item,{...item,name:'Seated Leg Curl'}]}],...seed}));
 const context=dom.getInternalVMContext();for(const name of ['coach-engine.js','data.js','app.js','coaching.js'])vm.runInContext(files[name],context,{filename:name});
 w.hasPhysiqueFeature=()=>true;
 const state=()=>vm.runInContext('state',context),run=code=>vm.runInContext(code,context);
 return {dom,w,state,run};
}
async function close(t){await new Promise(resolve=>setImmediate(resolve));t.dom.window.close();}
function begin(t){t.w.startGuidedWorkout(0);t.w.beginGuidedSession(false);}
function set(t,weight='100',reps='10'){t.w.document.getElementById('guidedWeight').value=weight;t.w.document.getElementById('guidedReps').value=reps;t.w.document.getElementById('guidedRir').value='2';t.w.completeGuidedSet();}
test('real app boots into guided mode; complete sets persist, timer starts and finish is idempotent',async()=>{
 const t=mount();try{begin(t);set(t);assert.equal(t.state().guidedSession.results[0][0].reps,10);assert.equal(t.state().activeTimer.version,2);
 assert.equal(JSON.parse(t.w.localStorage.getItem('physiqueOS')).guidedSession.results[0][0].weight,100);
 t.w.finishGuidedSession();t.w.finishGuidedSession();assert.equal(t.state().workoutLogs.length,1);assert.equal(t.state().workoutLogs[0].status,'partial');assert.equal(t.state().workoutLogs[0].unit,'lb');
 }finally{await close(t);}
});
test('reload restores an interrupted session and unsaved input without duplicating completed sets',async()=>{
 const first=mount();begin(first);set(first);const seed=JSON.parse(first.w.localStorage.getItem('physiqueOS'));await close(first);
 const t=mount(seed);try{t.w.resumeGuidedWorkout();assert.ok(t.w.document.getElementById('guidedWorkout').open);assert.match(t.w.document.getElementById('guidedWorkout').textContent,/SET 2 OF 2/);assert.equal(t.state().guidedSession.results[0].filter(Boolean).length,1);}finally{await close(t);}
});
test('preflight and mid-session restrictions block exercise logging',async()=>{
 const t=mount();try{t.w.startGuidedWorkout(0);t.w.document.getElementById('guidedStartPain').value='2';t.w.beginGuidedSession();assert.equal(t.state().guidedSession.status,'ready');
 t.w.document.getElementById('guidedStartPain').value='0';t.w.beginGuidedSession();t.run('state.profile.acuteInjury=true');set(t);assert.equal(E.summary(t.state().guidedSession).sets,0);
 }finally{await close(t);}
});
test('account state replacement closes an old session rather than exposing it to another member',async()=>{
 const t=mount();try{begin(t);t.run('state={profile:{},logs:[],trainingPlan:[],workoutLogs:[],recoveryLogs:[],activityLogs:[],foodLogs:[],mealPlan:[],trainingDrafts:{},schedule:{}}');
 t.w.document.dispatchEvent(new t.w.Event('physique:render'));assert.equal(t.w.document.getElementById('guidedWorkout').open,false);assert.equal(t.w.document.getElementById('dailyCompanion').textContent.includes('Lower A'),false);
 }finally{await close(t);}
});
test('standard logging redirects to the active guided session and daily commitment is account state',async()=>{
 const t=mount();try{begin(t);set(t);t.w.logWorkout(0);assert.equal(t.state().workoutLogs.length,0);
 t.w.document.getElementById('companionCommitment').value='Prepare lunch';t.w.markCompanionCommitment();assert.equal(t.state().dailyCommitment.done,true);assert.equal(t.state().dailyCommitment.text,'Prepare lunch');
 }finally{await close(t);}
});
