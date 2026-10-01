/* Focused execution, persistent sessions and connected daily guidance. */
(()=>{
  'use strict';
  const E=window.PhysiqueCoachEngine,H=escapeHtml;
  let modal,previousFocus=null,visibleSessionId=null;
  const status=message=>{const out=document.getElementById('guidedMessage');if(out)out.textContent=message;};
  const permitted=()=>!window.physiqueCloud||(window.physiqueCloud.ready&&window.physiqueCloud.plan!=='none');
  const adaptiveAllowed=()=>!!window.hasPhysiqueFeature?.('adaptive_coach');
  const unit=()=>state.guidedSession?.unit||(state.profile.units==='metric'?'kg':'lb');
  function blocked(item){
    const recovery=activeRecoveryPlan(),mode=recoveryTrainingMode(recovery).mode;
    return trainingBlocked(state.profile)||['stop','rest'].includes(mode)||!!(recovery&&recoveryExerciseAffected(item,recovery));
  }
  function active(){return state.guidedSession&&state.guidedSession.status==='active'?state.guidedSession:null;}
  function saveSession(){save();renderDailyCompanion();}
  function mount(){
    modal=document.createElement('dialog');modal.id='guidedWorkout';modal.className='guidedWorkout';
    modal.setAttribute('aria-labelledby','guidedTitle');document.body.appendChild(modal);
    modal.addEventListener('cancel',()=>{visibleSessionId=null;});
    modal.addEventListener('close',()=>{visibleSessionId=null;previousFocus?.focus?.();});
    modal.addEventListener('input',event=>{
      const s=active();if(!s||visibleSessionId!==s.id)return;
      const fields=['guidedWeight','guidedReps','guidedRir','guidedPain','guidedNotes','guidedRpe'];
      if(!fields.includes(event.target.id))return;
      if(['guidedWeight','guidedReps','guidedRir'].includes(event.target.id)){
        s.input??={};s.input[{guidedWeight:'weight',guidedReps:'reps',guidedRir:'rir'}[event.target.id]]=event.target.value;
      }else s[{guidedPain:'pain',guidedNotes:'notes',guidedRpe:'sessionRpe'}[event.target.id]]=event.target.value;
      saveSession();
    });
  }
  function open(){
    if(!permitted())return;
    previousFocus=document.activeElement;
    if(!modal.open)modal.showModal();visibleSessionId=state.guidedSession?.id||null;renderSession();
  }
  window.startGuidedWorkout=function(di){
    if(!permitted())return;
    if(active()){open();return;}
    const day=state.trainingPlan[di];if(!day?.items?.length)return;
    if(trainingBlocked(state.profile)||['stop','rest'].includes(recoveryTrainingMode().mode))return alert('Training is paused by your current safety screening or recovery plan. Review that plan first.');
    saveWorkoutDraft(di);
    state.guidedSession={id:Date.now()+'_'+Math.random().toString(36).slice(2),status:'ready',date:today(),di,workout:day.name,
      unit:state.profile.units==='metric'?'kg':'lb',items:JSON.parse(JSON.stringify(day.items)),results:{},skipped:[],actions:[],
      readiness:readinessAdvice(),pain:0,notes:'',sessionRpe:'',duration:Number(state.profile.sessionLength)||60,startedAt:null,input:{}};
    saveSession();open();
  };
  window.resumeGuidedWorkout=()=>{if(state.guidedSession&&permitted())open();};
  window.beginGuidedSession=function(short=false){
    const s=state.guidedSession;if(!s||s.status!=='ready')return;
    const pain=Number(document.getElementById('guidedStartPain').value);
    if(!Number.isFinite(pain)||pain<0||pain>10)return status('Enter discomfort from 0 to 10.');
    if(pain>0)return status('Pause training that causes discomfort. Record and review it in the recovery planner before starting.');
    s.duration=Math.max(10,Math.min(180,Number(document.getElementById('guidedMinutes').value)||60));
    s.skipped=s.items.map((item,i)=>blocked(item)?i:null).filter(i=>i!=null);
    if(short)for(let i=3;i<s.items.length;i++)if(!s.skipped.includes(i))s.skipped.push(i);
    if(s.skipped.length===s.items.length)return status('All planned movements are protected by your current restriction. Choose recovery today.');
    s.status='active';s.startedAt=Date.now();s.short=short;saveSession();renderSession();
  };
  function currentInput(slot){
    const s=active();if(Object.keys(s.input||{}).length)return s.input;
    const previous=(s.results[slot.ei]||[]).filter(Boolean).at(-1);
    const oldLog=[...state.workoutLogs].reverse().find(x=>x.unit===s.unit&&x.exercises?.some(e=>e.name===slot.item.name));
    const historic=oldLog?.exercises.find(e=>e.name===slot.item.name)?.results?.[slot.si];
    const draft=state.trainingDrafts[s.date+'|'+s.workout]?.sets?.[slot.ei]?.[slot.si];
    // Existing set logs are displayed in the units originally entered; never silently convert history.
    return draft&&draft.reps?draft:{weight:previous?.weight??(historic?.weight??''),reps:'',rir:''};
  }
  function field(label,id,value,min,max,step='1'){
    return '<label>'+label+'<input id="'+id+'" type="number" inputmode="decimal" min="'+min+'" max="'+max+'" step="'+step+'" value="'+H(value??'')+'"></label>';
  }
  function renderSession(){
    const s=state.guidedSession;if(!s||!modal.open)return;
    const head='<header class="guidedHeader"><div><span class="kicker">COACH WITH ME</span><h2 id="guidedTitle">'+H(s.workout)+'</h2></div><button onclick="document.getElementById(\'guidedWorkout\').close()" aria-label="Close and keep session">×</button></header>';
    if(s.status==='ready'){
      modal.innerHTML=head+'<div class="guidedBody"><div class="guidedNotice"><strong>'+H(s.readiness.title)+'</strong><p>'+H(s.readiness.text)+'</p></div><p>A focused view of your existing program. Warm up before working sets. Your choices and completed sets are saved as you go.</p><div class="guidedInputs">'+field('Available minutes','guidedMinutes',s.duration,10,180)+field('Discomfort now · 0–10','guidedStartPain',0,0,10)+'</div><ol>'+s.items.map(x=>'<li>'+H(x.name)+' · '+x.sets+' sets'+(blocked(x)?' · protected':'')+'</li>').join('')+'</ol><p>The shorter option keeps the first three programmed movements. Protected movements stay excluded; omitted work is not made up automatically.</p><div class="guidedActions"><button class="primary" onclick="beginGuidedSession(false)">Begin planned session</button><button onclick="beginGuidedSession(true)">First 3 movements</button></div><p id="guidedMessage" role="status"></p></div>';return;
    }
    if(s.status==='complete'){
      const sum=E.summary(s);
      modal.innerHTML=head+'<div class="guidedBody"><span class="kicker">SESSION SAVED</span><h3>'+sum.sets+' working sets recorded</h3><p>'+sum.exercises.length+' movements · '+Math.round(sum.volume).toLocaleString()+' '+H(s.unit)+' total load × reps</p><p>'+H(s.notes||'Your completed work is saved in workout history.')+'</p><div class="guidedNotice"><strong>Next step</strong><p>'+(Number(s.pain)>0?'Review the discomfort you recorded before progressing this movement.':'Keep your planned food and recovery targets. The next session can build from the sets you actually completed.')+'</p></div><button class="primary" onclick="document.getElementById(\'guidedWorkout\').close()">Back to my day</button></div>';return;
    }
    const slot=E.next(s),sum=E.summary(s);
    const elapsed=Math.floor((Date.now()-s.startedAt)/60000),remaining=Math.max(0,s.duration-elapsed);
    let content='<div class="guidedProgress"><span>'+sum.sets+' / '+sum.plannedSets+' sets completed</span><span>'+remaining+' min in your time budget</span></div><progress max="'+sum.plannedSets+'" value="'+sum.sets+'" aria-label="Completed working sets"></progress><div id="guidedRestStatus" class="guidedRestStatus"></div>';
    if(slot){
      const item=slot.item,input=currentInput(slot),last=(s.results[slot.ei]||[]).filter(Boolean).at(-1),guide=exerciseGuide(item),protectedNow=blocked(item);
      content+='<span class="kicker">MOVEMENT '+(slot.ei+1)+' · SET '+(slot.si+1)+' OF '+item.sets+'</span><h3>'+H(item.name)+'</h3><p>'+item.minReps+'–'+item.maxReps+' reps · target '+item.rir+' RIR · load in '+H(s.unit)+'</p>'+
        '<p class="guidedPrevious">Previous logged load (units as entered): '+H(previousSetText(item.name,slot.si))+'</p>'+
        (protectedNow?'<div class="guidedNotice">This movement conflicts with your current screening or restriction. Skip it or end the session.</div>':'')+
        '<div class="guidedInputs">'+field('Load · '+s.unit,'guidedWeight',input.weight,0,2000,'.5')+field('Completed reps','guidedReps',input.reps,1,200)+field('RIR · optional','guidedRir',input.rir,0,9,'.5')+'</div>'+
        '<div class="guidedNotice"><strong>Next-set guidance</strong><p>'+H(adaptiveAllowed()?E.cue(item,last,Number(s.pain)):('Stay within '+item.minReps+'–'+item.maxReps+' reps at the prescribed effort. Rest until you are ready.'))+'</p></div>'+
        '<details><summary>Setup & execution</summary><p>'+H(guide.setup)+'</p><p>'+H(guide.execute)+'</p><ul>'+guide.cues.map(x=>'<li>'+H(x)+'</li>').join('')+'</ul></details>'+
        '<details><summary>Barbell plate helper</summary><p>Enter total load and bar weight in '+H(s.unit)+'. Results are per side using the listed plate sizes; check what your gym has.</p><div class="guidedInputs">'+field('Total load','plateTotal',input.weight,0,2000,'.5')+field('Bar weight','plateBar',s.unit==='kg'?20:45,0,1000,'.5')+'<label>Plate sizes<input id="plateSizes" value="'+(s.unit==='kg'?'25,20,15,10,5,2.5,1.25':'45,35,25,10,5,2.5')+'"></label></div><button onclick="guidedPlateHelp()">Calculate per side</button><p id="plateResult" role="status"></p></details>'+
        '<details><summary>Equipment occupied? Choose a substitute</summary><p>Choose from the same muscle group and check the setup and equipment. Swap before the first set to keep performance history accurate.</p><select id="guidedSwap">'+EXERCISES.filter(x=>x.m===exerciseMuscle(item)&&x.name!==item.name&&!blocked(x)&&!x.avoid.some(z=>(state.profile.injuries||'').toLowerCase().includes(z))).map(x=>'<option value="'+H(x.name)+'">'+H(x.name)+' · '+H(x.eq.join(', '))+'</option>').join('')+'</select><button onclick="swapGuidedMovement()" '+(last?'disabled':'')+'>Use this movement</button></details>'+
        '<label>Rest after this set<select id="guidedRest"><option value="60">1 minute</option><option value="90">90 seconds</option><option value="120" selected>2 minutes</option><option value="180">3 minutes</option><option value="240">4 minutes</option></select></label>'+
        '<div class="guidedActions"><button class="primary" onclick="completeGuidedSet()" '+(protectedNow?'disabled':'')+'>Complete set & rest</button><button onclick="skipGuidedMovement()">Skip movement</button><button onclick="undoGuidedSet()" '+(!s.actions.length?'disabled':'')+'>Undo last set</button></div>';
    }else content+='<h3>Your planned work is complete</h3><p>Review and save the session below.</p><button onclick="undoGuidedSet()">Undo last set</button>';
    content+='<details '+(!slot?'open':'')+'><summary>Session review & finish</summary><div class="guidedInputs">'+field('Session RPE · optional','guidedRpe',s.sessionRpe,1,10,'.5')+field('Discomfort · 0–10','guidedPain',s.pain,0,10)+'</div><label>What should carry forward?<textarea id="guidedNotes" maxlength="2000">'+H(s.notes)+'</textarea></label><button class="primary" onclick="finishGuidedSession()">Save '+(slot?'partial ':'')+'session</button></details><p id="guidedMessage" role="status"></p>';
    modal.innerHTML=head+'<div class="guidedBody">'+content+'</div>';modal.scrollTop=0;updateGuidedRest();
  }
  window.completeGuidedSet=function(){
    const s=active(),slot=s&&E.next(s);if(!slot||!permitted()||visibleSessionId!==s.id)return;
    if(blocked(slot.item)||Number(s.pain)>0)return status('Pause this movement and review the restriction or discomfort before recording more sets.');
    try{state.guidedSession=E.complete(s,{weight:el('guidedWeight').value,reps:el('guidedReps').value,rir:el('guidedRir').value});}
    catch(error){status(error.message);return;}
    state.guidedSession.input={};const seconds=Number(el('guidedRest').value)||120;
    saveSession();startRestTimer(seconds);renderSession();
  };
  window.undoGuidedSet=function(){const s=active();if(!s||visibleSessionId!==s.id)return;state.guidedSession=E.undo(s);state.guidedSession.input={};stopRestTimer();saveSession();renderSession();};
  window.skipGuidedMovement=function(){
    const s=active(),slot=s&&E.next(s);if(!slot)return;
    if(!confirm('Skip the remaining sets of '+slot.item.name+'? Completed sets will stay saved.'))return;
    s.skipped.push(slot.ei);s.input={};stopRestTimer();saveSession();renderSession();
  };
  window.swapGuidedMovement=function(){
    const s=active(),slot=s&&E.next(s),name=el('guidedSwap')?.value,item=EXERCISES.find(x=>x.name===name);
    if(!slot||!item||(s.results[slot.ei]||[]).some(Boolean)||blocked(item)||item.m!==exerciseMuscle(slot.item))return status('No compatible swap available before this movement’s first set.');
    s.swaps??=[];s.swaps.push({from:slot.item.name,to:item.name});slot.item.name=item.name;slot.item.muscle=item.m;s.input={};saveSession();renderSession();
  };
  window.guidedPlateHelp=function(){
    const total=Number(el('plateTotal').value),bar=Number(el('plateBar').value),sizes=el('plateSizes').value.split(',').map(Number);
    if(total>2000||bar>1000||sizes.some(x=>!Number.isFinite(x)||x<.25||x>100))return el('plateResult').textContent='Enter valid plate sizes from 0.25 to 100 and a total no greater than 2,000.';
    const result=E.plates(total,bar,sizes);el('plateResult').textContent=result?(result.length?'Each side: '+result.map(x=>x+' '+unit()).join(' + '):'Bar only.'):'That load cannot be assembled from these plate sizes. Adjust the total or sizes.';
  };
  window.finishGuidedSession=function(){
    const s=active();if(!s||visibleSessionId!==s.id||!permitted())return;
    const sum=E.summary(s);if(!sum.sets)return status('Complete at least one working set before saving. Close to keep the session for later.');
    const pain=Number(s.pain),rpe=s.sessionRpe===''?null:Number(s.sessionRpe);
    if(!Number.isFinite(pain)||pain<0||pain>10||rpe!=null&&(!Number.isFinite(rpe)||rpe<1||rpe>10))return status('Check session RPE (1–10) and discomfort (0–10).');
    if(E.next(s)&&!confirm('Save the completed sets as a partial session? Remaining work will not be added automatically.'))return;
    if(!state.workoutLogs.some(x=>x.guidedSessionId===s.id))state.workoutLogs.push({id:s.id,guidedSessionId:s.id,date:s.date,workout:s.workout,
      status:sum.sets<sum.plannedSets?'partial':'completed',sessionRpe:rpe,notes:s.notes,unit:s.unit,volume:sum.volume,readiness:s.readiness.score,
      skippedMovements:s.skipped.map(i=>s.items[i].name),swaps:s.swaps||[],plannedSets:sum.plannedSets,
      pre:{},post:{severity:pain,notes:s.notes},exercises:sum.exercises,startedAt:s.startedAt,endedAt:Date.now()});
    if(pain>0){state.trainingFlags??=[];state.trainingFlags.push({id:s.id+'_pain',date:s.date,workout:s.workout,phase:'post',severity:pain,notes:s.notes||'Discomfort recorded in guided session.'});}
    s.status='complete';s.endedAt=Date.now();delete state.trainingDrafts[s.date+'|'+s.workout];stopRestTimer();saveSession();renderTraining();renderSession();
  };
  function updateGuidedRest(){
    const out=el('guidedRestStatus');if(!out)return;
    const t=state.activeTimer,left=E.remaining(t);
    if(!t){out.innerHTML='';return;}
    if(!el('guidedRestTime'))out.innerHTML='<span id="guidedRestTime"></span><div class="guidedActions"><button id="guidedPauseRest" onclick="pauseRestTimer()">Pause rest</button><button onclick="extendRestTimer()">Extend rest +30s</button><button onclick="stopRestTimer()">Dismiss rest</button></div>';
    el('guidedRestTime').textContent=(t.paused?'Rest paused · ':left?'Rest · ':'Rest target reached · ')+Math.floor(left/60)+':'+String(left%60).padStart(2,'0')+' · extend it if needed.';
    el('guidedPauseRest').textContent=t.paused?'Resume rest':'Pause rest';el('guidedPauseRest').disabled=!left;
  }
  function renderDailyCompanion(){
    let card=el('dailyCompanion');if(!card){card=document.createElement('div');card.id='dailyCompanion';card.className='dailyCompanion';el('dashboard')?.insertBefore(card,el('dashboard')?.children[1]||null);}
    const s=active(),r=readinessAdvice(),task=adherenceTasks().find(x=>!x.done),last=state.workoutLogs.filter(x=>x.date===today()).at(-1);
    card.innerHTML='<div><span class="kicker">YOUR NEXT STEP</span><h3>'+H(s?'Your workout is ready to resume':task?.title||'Your logged priorities are covered')+'</h3><p>'+H(s?(E.summary(s).sets+' completed sets saved · '+s.workout):task?.detail||'Keep the rest of your day flexible. Review recovery before adding more work.')+'</p></div><button class="primary" '+(s?'onclick="resumeGuidedWorkout()"':'onclick="showTab(\''+H(task?.tab||'dailylog')+'\')"')+'>'+(s?'Resume session':'Open next step')+'</button>'+(last?.guidedSessionId?'<p class="companionFoot">Today’s session saved · '+last.exercises.reduce((n,x)=>n+x.results.length,0)+' sets. '+(last.post?.severity?'Review recorded discomfort before progressing.':'Keep your planned recovery and nutrition targets.')+'</p>':'')+'<details><summary>Daily coaching preferences</summary><p>'+H(r.text)+'</p><label>Coaching style<select id="companionTone" onchange="saveCompanionPreferences()"><option value="calm">Calm and concise</option><option value="direct">Direct and practical</option><option value="encouraging">Encouraging</option></select></label><label>One commitment for today<input id="companionCommitment" maxlength="180" placeholder="Example: prepare tomorrow’s lunch" value="'+H(state.dailyCommitment?.date===today()?state.dailyCommitment.text:'')+'" onchange="saveCompanionPreferences()"></label><button onclick="markCompanionCommitment()">Mark commitment done</button>'+(state.dailyCommitment?.date===today()&&state.dailyCommitment.done?'<p>Commitment completed. Build from that tomorrow.</p>':'')+'</details>';
    el('companionTone').value=state.coachingPreferences?.tone||'calm';
  }
  window.saveCompanionPreferences=function(){state.coachingPreferences={...state.coachingPreferences,tone:el('companionTone').value};state.dailyCommitment={date:today(),text:el('companionCommitment').value.trim(),done:false};save();};
  window.markCompanionCommitment=function(){if(!el('companionCommitment').value.trim())return;saveCompanionPreferences();state.dailyCommitment.done=true;save();renderDailyCompanion();};
  function synchronize(){
    if(modal.open&&visibleSessionId!==state.guidedSession?.id)modal.close();
    renderDailyCompanion();renderFloatingTimer();if(modal.open)renderSession();
    const work=todaysWorkout(),di=state.trainingPlan.indexOf(work),button=document.querySelector('#trainingSpotlight .trainingStartBtn');
    if(button&&di>=0)button.onclick=()=>startGuidedWorkout(di);
    document.querySelectorAll('#trainingPlan .workout').forEach((box,i)=>{if(box.querySelector('.guidedLaunch'))return;const b=document.createElement('button');b.className='guidedLaunch';b.textContent='Coach With Me';b.onclick=()=>startGuidedWorkout(i);box.prepend(b);});
  }
  mount();
  document.addEventListener('physique:render',synchronize);
  document.addEventListener('visibilitychange',()=>{renderFloatingTimer();updateGuidedRest();});
  const baseTraining=renderTraining;renderTraining=function(){baseTraining();synchronize();};
  const baseLog=logWorkout;logWorkout=function(di){if(active()?.workout===state.trainingPlan[di]?.name){open();status('Finish the guided session here so it is recorded once.');return;}baseLog(di);renderDailyCompanion();};
  const baseReply=coachReply;coachReply=function(question){
    if(!adaptiveAllowed())return 'Personalized adaptive coaching is available with an eligible membership. Your plan, logging and rest controls remain available.';
    const q=String(question).toLowerCase(),s=active(),slot=s&&E.next(s);
    let reply;
    if(slot&&(/next set|rest|current workout/.test(q))){const last=(s.results[slot.ei]||[]).filter(Boolean).at(-1);reply='You are on '+slot.item.name+', set '+(slot.si+1)+' of '+slot.item.sets+'. '+E.cue(slot.item,last,Number(s.pain));}
    else if(/commitment|habit/.test(q)&&state.dailyCommitment?.date===today())reply='Today’s commitment is '+state.dailyCommitment.text+'. '+(state.dailyCommitment.done?'You marked it done; keep the next step realistic.':'Choose a specific time and keep the first action small.');
    else reply=baseReply(question);
    const tone=state.coachingPreferences?.tone||'calm';return tone==='encouraging'?'One useful step at a time. '+reply:tone==='direct'?'Next action: '+reply:reply;
  };
  synchronize();setInterval(()=>{renderFloatingTimer();updateGuidedRest();},1000);
})();
