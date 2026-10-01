/* Deterministic session and timer logic; independent of conversational services. */
(function(root){
  'use strict';
  const copy=x=>JSON.parse(JSON.stringify(x));
  const bounded=(n,min,max)=>Math.max(min,Math.min(max,n));
  function rest(seconds,now=Date.now()){
    const duration=bounded(Math.round(Number(seconds)||120),15,900);
    return {version:2,duration,endsAt:now+duration*1000,paused:false,remaining:duration,alerted:false};
  }
  function remaining(timer,now=Date.now()){
    if(!timer||timer.version!==2)return 0;
    return bounded(timer.paused?timer.remaining:Math.ceil((timer.endsAt-now)/1000),0,timer.duration);
  }
  function pause(timer,now=Date.now()){
    if(!timer)return null;const t=copy(timer);
    t.remaining=remaining(t,now);t.paused=!t.paused;
    if(!t.paused)t.endsAt=now+t.remaining*1000;
    return t;
  }
  function extend(timer,seconds=30,now=Date.now()){
    const r=bounded(remaining(timer,now)+seconds,0,900);
    const t=rest(r||15,now);t.duration=r;t.remaining=r;t.endsAt=now+r*1000;t.paused=!!timer?.paused;
    return t;
  }
  function validateSet(input){
    const weight=Number(input.weight),reps=Number(input.reps),rir=input.rir===''||input.rir==null?null:Number(input.rir);
    if(input.weight===''||!Number.isFinite(weight)||weight<0||weight>2000)throw Error('Enter load from 0 to 2,000. Use 0 for bodyweight.');
    if(!Number.isInteger(reps)||reps<1||reps>200)throw Error('Enter completed reps from 1 to 200.');
    if(rir!=null&&(!Number.isFinite(rir)||rir<0||rir>9))throw Error('Reps in reserve must be 0 to 9.');
    return {weight,reps,rir,rpe:rir==null?null:Math.max(1,10-rir)};
  }
  function next(session){
    for(let ei=0;ei<session.items.length;ei++){
      if(session.skipped?.includes(ei))continue;
      for(let si=0;si<session.items[ei].sets;si++)if(!session.results[ei]?.[si])return{ei,si,item:session.items[ei]};
    }
    return null;
  }
  function complete(session,input,now=Date.now()){
    const slot=next(session);if(!slot)return session;
    const result=validateSet(input),out=copy(session);out.results[slot.ei]??=[];
    out.results[slot.ei][slot.si]={...result,set:slot.si+1,completedAt:now};
    out.actions??=[];out.actions.push({ei:slot.ei,si:slot.si});return out;
  }
  function undo(session){
    const out=copy(session),a=out.actions?.pop();if(a){out.results[a.ei][a.si]=null;out.skipped=(out.skipped||[]).filter(i=>i!==a.ei);}return out;
  }
  function summary(session){
    const exercises=session.items.map((item,ei)=>({name:item.name,results:(session.results[ei]||[]).filter(Boolean),issue:{pain:Number(session.pain)||0,mod:session.skipped?.includes(ei)?'skipped':'as prescribed',note:session.notes||''}})).filter(x=>x.results.length);
    return {exercises,sets:exercises.reduce((n,x)=>n+x.results.length,0),volume:exercises.reduce((n,x)=>n+x.results.reduce((v,r)=>v+r.weight*r.reps,0),0),plannedSets:session.items.reduce((n,x)=>n+x.sets,0)};
  }
  function cue(item,result,pain=0){
    if(pain>0)return 'Pause this movement if it hurts. Do not increase load through pain; record what changed and seek appropriate review.';
    if(!result||result.rir==null)return 'Use controlled technique and the prescribed effort. Log RIR to make the next suggestion more useful.';
    if(result.reps<item.minReps)return 'Below the prescribed range. Consider a small load reduction after adequate rest; you choose the change.';
    if(result.rir<Math.max(0,item.rir-1))return 'Harder than the target effort. Keep or reduce load and protect later-set quality.';
    if(result.reps>=item.maxReps&&result.rir>=item.rir)return 'Top of the range at the target effort. Consider a small increase only if technique remains controlled.';
    return 'Keep the load and aim for controlled reps within the target range. Extend rest if you need it.';
  }
  function plates(total,bar,available){
    total=Number(total);bar=Number(bar);if(!Number.isFinite(total)||!Number.isFinite(bar)||bar<0||total<bar)return null;
    let target=Math.round((total-bar)*50); // per-side hundredths, exact bounded search
    const sizes=[...new Set(available.map(Number).filter(x=>x>0))].sort((a,b)=>b-a);
    const reachable=new Map([[0,[]]]);
    for(let n=0;n<=target;n++)if(reachable.has(n))for(const size of sizes){const k=n+Math.round(size*100);if(k<=target&&!reachable.has(k))reachable.set(k,[...reachable.get(n),size]);}
    return reachable.get(target)||null;
  }
  root.PhysiqueCoachEngine={rest,remaining,pause,extend,validateSet,next,complete,undo,summary,cue,plates};
})(globalThis);
