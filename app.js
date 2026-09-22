const $=id=>document.getElementById(id);const today=()=>new Date().toISOString().slice(0,10);let state=JSON.parse(localStorage.getItem('physiqueOS')||'null')||{profile:{},macro:null,logs:[],mealPlan:[],trainingPlan:[]};state.profile=state.profile||{};state.logs=Array.isArray(state.logs)?state.logs:[];state.mealPlan=Array.isArray(state.mealPlan)?state.mealPlan:[];state.trainingPlan=Array.isArray(state.trainingPlan)?state.trainingPlan:[];function save(){localStorage.setItem('physiqueOS',JSON.stringify(state))}document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('nav button').forEach(x=>x.classList.remove('active'));const target=document.querySelector('section#'+b.dataset.tab+'.tab');if(target)target.classList.add('active');b.classList.add('active');renderAll()});$('logDate').value=today();$('equipment').innerHTML=EQUIPMENT.map(e=>`<label><input type="checkbox" class="eq" value="${e}"> ${e}</label>`).join(' ');
function calcMacro(p){const kg=p.weight/2.20462,cm=(p.ft*12+p.inch)*2.54;let bmr=10*kg+6.25*cm-5*p.age+(p.sex==='male'?5:-161);if(p.bf){const lbm=kg*(1-p.bf/100);bmr=(bmr+(370+21.6*lbm))/2}const tdee=bmr*p.activity;let factor=1;if(p.goal==='fatloss')factor={conservative:.85,moderate:.80,aggressive:.75}[p.aggr];if(p.goal==='recomp')factor=.95;if(p.goal==='gain')factor={conservative:1.05,moderate:1.08,aggressive:1.12}[p.aggr];let cal=Math.max(p.sex==='male'?1600:1300,tdee*factor),protein=Math.round((p.goalWeight||p.weight)*1),fat=Math.round(Math.max((p.goalWeight||p.weight)*.3,cal*.22/9)),carbs=Math.max(40,Math.round((cal-protein*4-fat*9)/4));cal=Math.round(protein*4+carbs*4+fat*9);return{bmr:Math.round(bmr),tdee:Math.round(tdee),calories:cal,protein,carbs,fat}}
function saveProfile(){const p={name:$('name').value,age:+$('age').value,sex:$('sex').value,ft:+$('ft').value,inch:+$('inch').value,weight:+$('weight').value,goalWeight:+$('goalWeight').value,bf:+$('bf').value||null,activity:+$('activity').value,goal:$('goal').value,aggr:$('aggr').value,meals:+$('mealsPerDay').value,days:+$('days').value,experience:$('experience').value,budget:+$('budget').value||0,zip:$('zip').value,stores:$('stores').value,groceryPriority:$('groceryPriority').value,diet:$('diet').value,allergies:$('allergies').value,exclude:$('exclude').value,preferredFoods:$('preferredFoods').value,injuries:$('injuries').value,equipment:[...document.querySelectorAll('.eq:checked')].map(x=>x.value)};if(!p.age||!p.weight||!p.ft)return alert('Enter age, height and weight.');state.profile=p;state.macro=calcMacro(p);save();renderAll();alert('Assessment saved.')}
function loadProfile(){const p=state.profile;if(!p.age)return;['name','age','sex','ft','inch','weight','goalWeight','bf','activity','goal','aggr','days','experience','budget','zip','stores','groceryPriority','diet'].forEach(k=>{if($(k)&&p[k]!=null)$(k).value=p[k]});if($('mealsPerDay')&&p.meals!=null)$('mealsPerDay').value=p.meals;$('allergies').value=p.allergies||'';$('exclude').value=p.exclude||'';$('preferredFoods').value=p.preferredFoods||'';$('injuries').value=p.injuries||'';document.querySelectorAll('.eq').forEach(x=>x.checked=(p.equipment||[]).includes(x.value))}
function trend(){const a=state.logs.filter(x=>x.weight).sort((x,y)=>x.date.localeCompare(y.date));if(a.length<2)return null;const first=a[0],last=a[a.length-1],days=Math.max(1,(new Date(last.date)-new Date(first.date))/86400000),weekly=(first.weight-last.weight)/(days/7),recent=a.slice(-7),adh=recent.filter(x=>x.adherence!=null).reduce((s,x)=>s+x.adherence,0)/Math.max(1,recent.filter(x=>x.adherence!=null).length),steps=recent.filter(x=>x.steps).reduce((s,x)=>s+x.steps,0)/Math.max(1,recent.filter(x=>x.steps).length),sleep=recent.filter(x=>x.sleep).reduce((s,x)=>s+x.sleep,0)/Math.max(1,recent.filter(x=>x.sleep).length);return{weekly,pct:weekly/first.weight*100,adh,steps,sleep,days}}
function adaptive(){if(!state.macro)return'Complete onboarding first.';const t=trend(),p=state.profile;if(!t||t.days<7)return`Starting target: ${state.macro.calories} kcal. Log at least 7–14 days before making a major adjustment.`;let s=`Observed trend: ${Math.abs(t.weekly).toFixed(2)} lb/week ${t.weekly>=0?'down':'up'}. Recent adherence: ${isFinite(t.adh)?t.adh.toFixed(0):'—'}%. `;if(p.goal==='fatloss'){const target={conservative:.5,moderate:.75,aggressive:1}[p.aggr];if(t.adh<80)s+='Hold calories and improve adherence before cutting food.';else if(t.pct<target-.2)s+='Loss is slower than target. Consider 100–150 fewer calories per day or add activity if recovery is good.';else if(t.pct>target+.25)s+='Loss is faster than target. If strength, hunger or recovery are worsening, add 100–150 calories.';else s+='Rate is close to target. Hold the plan.'}if(t.steps&&t.steps<7000)s+=` Steps average ${t.steps.toFixed(0)}; daily movement is an available lever.`;if(t.sleep&&t.sleep<6.5)s+=` Sleep averages ${t.sleep.toFixed(1)} h; recovery is a constraint.`;return s}
function renderNutrition(){if(!state.macro){$('nutritionOut').innerHTML='<div class="notice">Complete onboarding first.</div>';return}const m=state.macro;$('nutritionOut').innerHTML=`<div class="metrics"><div class="card"><small>BMR</small><strong>${m.bmr}</strong></div><div class="card"><small>TDEE</small><strong>${m.tdee}</strong></div><div class="card"><small>Calories</small><strong>${m.calories}</strong></div></div><div class="card"><table><tr><th>Protein</th><th>Carbs</th><th>Fat</th></tr><tr><td>${m.protein}g</td><td>${m.carbs}g</td><td>${m.fat}g</td></tr></table></div><div class="notice">${adaptive()}</div>`}
function grams(f,key,target){return Math.max(0,Math.round(target/(f[key]/100)/5)*5)}
function macro(f,g){const q=g/100;return{p:f.p*q,c:f.c*q,f:f.f*q,k:f.k*q}}
function tokens(v){return(v||'').toLowerCase().split(/[,;\n]/).map(x=>x.trim()).filter(Boolean)}
function excluded(f){const block=[...tokens(state.profile.allergies),...tokens(state.profile.exclude)];return block.some(x=>f.name.toLowerCase().includes(x))}
function preferred(f){return tokens(state.profile.preferredFoods).some(x=>f.name.toLowerCase().includes(x))}
function pool(cat){return FOOD_DB.filter(x=>x.cat===cat&&!excluded(x)).sort((a,b)=>Number(preferred(b))-Number(preferred(a)))}
function itemMacroKey(cat){return cat==='protein'?'p':cat==='carb'?'c':cat==='fat'?'f':null}
function recalcMeal(meal){meal.sum=meal.items.map(x=>{const f=FOOD_DB.find(z=>z.name===x.name);return f?macro(f,x.g):{p:0,c:0,f:0,k:0}}).reduce((a,x)=>({p:a.p+x.p,c:a.c+x.c,f:a.f+x.f,k:a.k+x.k}),{p:0,c:0,f:0,k:0})}
function swapIngredient(dayIndex,mealIndex,itemIndex){
  const meal=state.mealPlan[dayIndex]?.meals?.[mealIndex],item=meal?.items?.[itemIndex];if(!meal||!item)return;
  const options=pool(item.cat);if(options.length<2)return alert('No other compatible option is available for this category.');
  const current=options.findIndex(x=>x.name===item.name),next=options[(current+1+options.length)%options.length];
  const old=FOOD_DB.find(x=>x.name===item.name),key=itemMacroKey(item.cat);
  let g=item.g;
  if(key&&old&&old[key]>0&&next[key]>0){const target=old[key]*item.g/100;g=grams(next,key,target)}
  if(item.cat==='veg')g=item.g||100;
  meal.items[itemIndex]={name:next.name,g,cat:next.cat,price:next.price};
  recalcMeal(meal);save();renderMeals();
}
function replaceMeal(dayIndex,mealIndex){
  const meal=state.mealPlan[dayIndex]?.meals?.[mealIndex];if(!meal)return;
  meal.items.forEach((_,i)=>swapIngredient(dayIndex,mealIndex,i));save();renderMeals();
}
function storeNames(){const typed=(state.profile.stores||'').split(',').map(x=>x.trim()).filter(Boolean);return typed.length?typed:['Aldi','Walmart','Publix']}
function storeMultiplier(name){const key=Object.keys(STORE_MULTIPLIERS||{}).find(k=>k.toLowerCase()===name.toLowerCase());return key?STORE_MULTIPLIERS[key]:1}
function storeSearchUrl(store){return 'https://www.google.com/maps/search/'+encodeURIComponent(store+' grocery store near '+(state.profile.zip||''))}
function budgetSuggestions(cost){
  const b=Number(state.profile.budget)||0;if(!b||cost<=b)return '';
  const over=cost-b;
  return '<div class="notice"><strong>Over budget by about 
function generateMeals(){
  try{
    if(!state.macro)return alert('Complete onboarding first.');
    const m=state.macro,n=Number(state.profile.meals)||4;
    const proteins=pool('protein'),carbs=pool('carb'),vegs=pool('veg'),fats=pool('fat');
    if(!proteins.length||!carbs.length||!vegs.length||!fats.length){
      throw new Error('One or more food categories have no available foods. Check your Foods to avoid list.');
    }
    const plan=[];
    for(let d=0;d<7;d++){
      const meals=[];
      for(let i=0;i<n;i++){
        const pf=proteins[(d+i)%proteins.length],cf=carbs[(d+i)%carbs.length],vf=vegs[(d+i)%vegs.length],ff=fats[(d+i)%fats.length];
        const pg=grams(pf,'p',m.protein/n);
        const cg=grams(cf,'c',m.carbs/n);
        const proteinFat=macro(pf,pg).f;
        const carbFat=macro(cf,cg).f;
        const fg=grams(ff,'f',Math.max(3,m.fat/n-proteinFat-carbFat));
        const items=[[pf,pg],[cf,cg],[vf,100],[ff,fg]];
        const sum=items.map(([f,g])=>macro(f,g)).reduce((a,x)=>({p:a.p+x.p,c:a.c+x.c,f:a.f+x.f,k:a.k+x.k}),{p:0,c:0,f:0,k:0});
        meals.push({items:items.map(([f,g])=>({name:f.name,g,cat:f.cat,price:f.price})),sum});
      }
      plan.push({day:d+1,meals});
    }
    state.mealPlan=plan;
    save();
    renderMeals();
  }catch(err){
    console.error('Meal generation failed',err);
    $('mealPlan').innerHTML='<div class="notice">Meal generator error: '+String(err.message||err)+'. Review onboarding and Foods to avoid, then try again.</div>';
  }
}
function renderMeals(){
  if(!state.mealPlan.length){
    $('mealPlan').innerHTML='<div class="notice">Generate a plan first.</div>';
    $('grocery').innerHTML='<div class="notice">Your grocery list will be generated from the meal plan and compared with your weekly budget.</div>';
    $('swaps').innerHTML='<div class="notice">Ingredient and full-meal replacement controls appear after a plan is generated.</div>';
    return;
  }
  $('mealPlan').innerHTML=state.mealPlan.map((d,di)=>`<details class="meal" ${d.day===1?'open':''}><summary>Day ${d.day}</summary>${d.meals.map((m,mi)=>`<div class="meal"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><strong>Meal ${mi+1}</strong><button onclick="replaceMeal(${di},${mi})">Replace meal</button></div><small>${m.sum.k.toFixed(0)} kcal • ${m.sum.p.toFixed(0)}P ${m.sum.c.toFixed(0)}C ${m.sum.f.toFixed(0)}F</small>${m.items.map((x,ii)=>`<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-top:6px"><span>${x.g}g ${x.name}</span><button onclick="swapIngredient(${di},${mi},${ii})">Swap</button></div>`).join('')}</div>`).join('')}</details>`).join('');
  const totals={};
  state.mealPlan.forEach(d=>d.meals.forEach(m=>m.items.forEach(x=>{totals[x.name]??={g:0,price:x.price};totals[x.name].g+=x.g})));
  const rows=Object.entries(totals),baseCost=rows.reduce((s,[,x])=>s+x.g/1000*x.price,0);
  const stores=storeNames();
  const storeCards=stores.map(s=>{const est=baseCost*storeMultiplier(s),budget=Number(state.profile.budget)||0,status=budget?(est<=budget?'Within budget':'Over budget'):'No budget entered';return `<div class="meal"><strong>${s}</strong><div>Estimated basket: $${est.toFixed(2)} • ${status}</div><button onclick="window.open('${storeSearchUrl(s)}','_blank')">Find near ${state.profile.zip||'ZIP'}</button></div>`}).join('');
  $('grocery').innerHTML=`<p><strong>ZIP:</strong> ${state.profile.zip||'Not set'} • <strong>Weekly budget:</strong> ${state.profile.budget?'$'+state.profile.budget:'Not set'} • <strong>Priority:</strong> ${state.profile.groceryPriority||'balanced'}</p>${budgetSuggestions(baseCost)}<h4>Weekly quantities</h4><table>${rows.map(([n,x])=>`<tr><td>${n}</td><td>${x.g>=1000?(x.g/1000).toFixed(2)+' kg':Math.round(x.g)+' g'}</td></tr>`).join('')}</table><h4>Store options near your ZIP</h4><small>Price estimates are planning estimates, not live retailer inventory or checkout prices.</small>${storeCards}`;
  $('swaps').innerHTML=['protein','carb','fat','veg'].map(cat=>`<div class="meal"><strong>${cat}</strong><div>${pool(cat).map(x=>x.name).join(' • ')}</div></div>`).join('');
}
function openStores(){const q=(state.profile.stores||'grocery stores')+' near '+(state.profile.zip||'');window.open('https://www.google.com/maps/search/'+encodeURIComponent(q),'_blank')}
function split(days){if(days<=2)return[['Full Body A',['quads','chest','back','hamstrings','delts','core']],['Full Body B',['glutes','back','chest','hamstrings','biceps','triceps']]];if(days===3)return[['Full A',['quads','chest','back','hamstrings','delts']],['Full B',['glutes','back','chest','biceps','triceps']],['Full C',['quads','chest','back','glutes','calves']]];if(days===4)return[['Upper A',['chest','back','delts','biceps','triceps']],['Lower A',['quads','hamstrings','glutes','calves','core']],['Upper B',['back','chest','delts','biceps','triceps']],['Lower B',['glutes','quads','hamstrings','calves','core']]];return[['Push',['chest','delts','triceps']],['Pull',['back','biceps','delts']],['Legs',['quads','hamstrings','glutes','calves']],['Upper',['chest','back','delts','biceps','triceps']],['Lower',['quads','hamstrings','glutes','calves','core']]].slice(0,days)}function chooseEx(m,i){const p=state.profile,s=(p.injuries||'').toLowerCase(),owned=p.equipment||[];let a=EXERCISES.filter(x=>x.m===m&&x.eq.some(e=>owned.includes(e))&&!x.avoid.some(a=>s.includes(a)));if(!a.length)a=EXERCISES.filter(x=>x.m===m&&!x.avoid.some(a=>s.includes(a)));return a[i%a.length]?.name||`Pain-free ${m} movement`}
function generateTraining(){if(!state.profile.age)return alert('Complete onboarding first.');const sets=state.profile.experience==='beginner'?2:state.profile.experience==='advanced'?4:3;state.trainingPlan=split(state.profile.days||4).map((d,di)=>({name:d[0],items:d[1].map((m,i)=>({name:chooseEx(m,di+i),sets,reps:['chest','back','quads','hamstrings','glutes'].includes(m)?'6–12':'10–20',rir:state.profile.experience==='advanced'?'1–2':'2–3'}))}));save();renderTraining()}
function renderTraining(){$('trainingPlan').innerHTML=state.trainingPlan.length?state.trainingPlan.map(d=>`<div class="workout"><h3>${d.name}</h3><table><tr><th>Exercise</th><th>Sets</th><th>Reps</th><th>RIR</th></tr>${d.items.map(x=>`<tr><td>${x.name}</td><td>${x.sets}</td><td>${x.reps}</td><td>${x.rir}</td></tr>`).join('')}</table></div>`).join(''):'<div class="notice">Generate a program first.</div>'}
function saveLog(){const x={date:$('logDate').value||today(),weight:+$('logWeight').value||null,waist:+$('logWaist').value||null,chest:+$('logChest').value||null,arm:+$('logArm').value||null,thigh:+$('logThigh').value||null,steps:+$('logSteps').value||null,water:+$('logWater').value||null,sleep:+$('logSleep').value||null,calories:+$('logCalories').value||null,adherence:+$('logAdherence').value||null,notes:$('logNotes').value};state.logs=state.logs.filter(a=>a.date!==x.date);state.logs.push(x);state.logs.sort((a,b)=>a.date.localeCompare(b.date));save();renderAll()}
function renderHistory(){$('history').innerHTML=`<table><tr><th>Date</th><th>Weight</th><th>Waist</th><th>Steps</th><th>Sleep</th><th>Adherence</th></tr>${[...state.logs].reverse().map(x=>`<tr><td>${x.date}</td><td>${x.weight||'—'}</td><td>${x.waist||'—'}</td><td>${x.steps||'—'}</td><td>${x.sleep||'—'}</td><td>${x.adherence!=null?x.adherence+'%':'—'}</td></tr>`).join('')}</table>`}
function draw(id,key,label){const c=$(id),ctx=c.getContext('2d'),a=state.logs.filter(x=>x[key]).slice(-30),w=c.width,h=c.height;ctx.clearRect(0,0,w,h);ctx.fillStyle='#0b1325';ctx.fillRect(0,0,w,h);if(a.length<2){ctx.fillStyle='#9eabc3';ctx.fillText('Log more data to see trend',20,30);return}const v=a.map(x=>x[key]),lo=Math.min(...v),hi=Math.max(...v),span=hi-lo||1;ctx.strokeStyle='#38bdf8';ctx.lineWidth=3;ctx.beginPath();v.forEach((y,i)=>{const px=20+i*(w-40)/(v.length-1),py=h-20-(y-lo)/span*(h-40);i?ctx.lineTo(px,py):ctx.moveTo(px,py)});ctx.stroke();ctx.fillStyle='#f4f7fb';ctx.fillText(`${label}: ${v[v.length-1]}`,20,18)}
function coach(mode){const t={review:adaptive(),hungry:'Check meal volume, protein, vegetables, fluids and sleep before cutting more calories. If calories remain today, choose a high-protein, high-volume meal.',stall:'Use 7–14 day averages, waist, adherence and steps. If adherence is low, fix execution first. If adherence is high and the trend is truly slow, make a small adjustment.',missed:'Do not double up as punishment. Move the highest-priority session forward and resume the sequence. Cut lower-priority isolation work first if the week is compressed.',travel:'Hit protein, stay near calories, keep steps high, choose simple estimable meals, and use a short full-body workout if equipment is available.'};$('coachOut').textContent=t[mode]}
function exportData(){const b=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=`physiqueos-${today()}.json`;a.click();URL.revokeObjectURL(u)}function importData(inp){const f=inp.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{state=JSON.parse(r.result);save();renderAll();alert('Backup imported.')}catch(e){alert('Invalid backup.')}};r.readAsText(f)}function resetAll(){if(confirm('Erase all local data?')){localStorage.removeItem('physiqueOS');location.reload()}}
function renderDashboard(){const latest=[...state.logs].reverse().find(x=>x.weight),t=trend();$('welcome').textContent=state.profile.name?`Welcome, ${state.profile.name}.`:'Build your baseline';$('dashCalories').textContent=state.macro?state.macro.calories:'—';$('dashWeight').textContent=latest?latest.weight+' lb':state.profile.weight?state.profile.weight+' lb':'—';$('dashAdherence').textContent=t&&isFinite(t.adh)?t.adh.toFixed(0)+'%':'—';$('homeCoach').textContent=adaptive();draw('weightChart','weight','Weight');draw('waistChart','waist','Waist')}
function renderAll(){loadProfile();renderDashboard();renderNutrition();renderMeals();renderTraining();renderHistory();coach('review')}renderAll();if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});+over.toFixed(2)+'.</strong><br>Lower-cost substitutions to prioritize: chicken breast, tuna or egg whites for premium proteins; jasmine rice, oats or potatoes for higher-cost carb choices; olive oil for premium fat sources.</div>';
}
function generateMeals(){
  try{
    if(!state.macro)return alert('Complete onboarding first.');
    const m=state.macro,n=Number(state.profile.meals)||4;
    const proteins=pool('protein'),carbs=pool('carb'),vegs=pool('veg'),fats=pool('fat');
    if(!proteins.length||!carbs.length||!vegs.length||!fats.length){
      throw new Error('One or more food categories have no available foods. Check your Foods to avoid list.');
    }
    const plan=[];
    for(let d=0;d<7;d++){
      const meals=[];
      for(let i=0;i<n;i++){
        const pf=proteins[(d+i)%proteins.length],cf=carbs[(d+i)%carbs.length],vf=vegs[(d+i)%vegs.length],ff=fats[(d+i)%fats.length];
        const pg=grams(pf,'p',m.protein/n);
        const cg=grams(cf,'c',m.carbs/n);
        const proteinFat=macro(pf,pg).f;
        const carbFat=macro(cf,cg).f;
        const fg=grams(ff,'f',Math.max(3,m.fat/n-proteinFat-carbFat));
        const items=[[pf,pg],[cf,cg],[vf,100],[ff,fg]];
        const sum=items.map(([f,g])=>macro(f,g)).reduce((a,x)=>({p:a.p+x.p,c:a.c+x.c,f:a.f+x.f,k:a.k+x.k}),{p:0,c:0,f:0,k:0});
        meals.push({items:items.map(([f,g])=>({name:f.name,g,cat:f.cat,price:f.price})),sum});
      }
      plan.push({day:d+1,meals});
    }
    state.mealPlan=plan;
    save();
    renderMeals();
  }catch(err){
    console.error('Meal generation failed',err);
    $('mealPlan').innerHTML='<div class="notice">Meal generator error: '+String(err.message||err)+'. Review onboarding and Foods to avoid, then try again.</div>';
  }
}
function renderMeals(){if(!state.mealPlan.length){$('mealPlan').innerHTML='<div class="notice">Generate a plan first.</div>';$('grocery').innerHTML='';return}$('mealPlan').innerHTML=state.mealPlan.map(d=>`<details class="meal" ${d.day===1?'open':''}><summary>Day ${d.day}</summary>${d.meals.map((m,i)=>`<div class="meal"><strong>Meal ${i+1}</strong><small> ${m.sum.k.toFixed(0)} kcal • ${m.sum.p.toFixed(0)}P ${m.sum.c.toFixed(0)}C ${m.sum.f.toFixed(0)}F</small>${m.items.map(x=>`<div>${x.g}g ${x.name}</div>`).join('')}</div>`).join('')}</details>`).join('');const totals={};state.mealPlan.forEach(d=>d.meals.forEach(m=>m.items.forEach(x=>{totals[x.name]??={g:0,price:x.price};totals[x.name].g+=x.g})));const rows=Object.entries(totals),cost=rows.reduce((s,[,x])=>s+x.g/1000*x.price,0);$('grocery').innerHTML=`<p>Estimated weekly cost: <strong>$${cost.toFixed(2)}</strong>${state.profile.budget?` • budget $${state.profile.budget}`:''}</p><table>${rows.map(([n,x])=>`<tr><td>${n}</td><td>${x.g>=1000?(x.g/1000).toFixed(2)+' kg':Math.round(x.g)+' g'}</td></tr>`).join('')}</table>`;$('swaps').innerHTML=['protein','carb','fat'].map(cat=>`<div class="meal"><strong>${cat}</strong><div>${pool(cat).map(x=>x.name).join(' • ')}</div></div>`).join('')}
function openStores(){window.open(`https://www.google.com/maps/search/grocery+stores+near+${encodeURIComponent(state.profile.zip||'')}`,'_blank')}
function split(days){if(days<=2)return[['Full Body A',['quads','chest','back','hamstrings','delts','core']],['Full Body B',['glutes','back','chest','hamstrings','biceps','triceps']]];if(days===3)return[['Full A',['quads','chest','back','hamstrings','delts']],['Full B',['glutes','back','chest','biceps','triceps']],['Full C',['quads','chest','back','glutes','calves']]];if(days===4)return[['Upper A',['chest','back','delts','biceps','triceps']],['Lower A',['quads','hamstrings','glutes','calves','core']],['Upper B',['back','chest','delts','biceps','triceps']],['Lower B',['glutes','quads','hamstrings','calves','core']]];return[['Push',['chest','delts','triceps']],['Pull',['back','biceps','delts']],['Legs',['quads','hamstrings','glutes','calves']],['Upper',['chest','back','delts','biceps','triceps']],['Lower',['quads','hamstrings','glutes','calves','core']]].slice(0,days)}function chooseEx(m,i){const p=state.profile,s=(p.injuries||'').toLowerCase(),owned=p.equipment||[];let a=EXERCISES.filter(x=>x.m===m&&x.eq.some(e=>owned.includes(e))&&!x.avoid.some(a=>s.includes(a)));if(!a.length)a=EXERCISES.filter(x=>x.m===m&&!x.avoid.some(a=>s.includes(a)));return a[i%a.length]?.name||`Pain-free ${m} movement`}
function generateTraining(){if(!state.profile.age)return alert('Complete onboarding first.');const sets=state.profile.experience==='beginner'?2:state.profile.experience==='advanced'?4:3;state.trainingPlan=split(state.profile.days||4).map((d,di)=>({name:d[0],items:d[1].map((m,i)=>({name:chooseEx(m,di+i),sets,reps:['chest','back','quads','hamstrings','glutes'].includes(m)?'6–12':'10–20',rir:state.profile.experience==='advanced'?'1–2':'2–3'}))}));save();renderTraining()}
function renderTraining(){$('trainingPlan').innerHTML=state.trainingPlan.length?state.trainingPlan.map(d=>`<div class="workout"><h3>${d.name}</h3><table><tr><th>Exercise</th><th>Sets</th><th>Reps</th><th>RIR</th></tr>${d.items.map(x=>`<tr><td>${x.name}</td><td>${x.sets}</td><td>${x.reps}</td><td>${x.rir}</td></tr>`).join('')}</table></div>`).join(''):'<div class="notice">Generate a program first.</div>'}
function saveLog(){const x={date:$('logDate').value||today(),weight:+$('logWeight').value||null,waist:+$('logWaist').value||null,chest:+$('logChest').value||null,arm:+$('logArm').value||null,thigh:+$('logThigh').value||null,steps:+$('logSteps').value||null,water:+$('logWater').value||null,sleep:+$('logSleep').value||null,calories:+$('logCalories').value||null,adherence:+$('logAdherence').value||null,notes:$('logNotes').value};state.logs=state.logs.filter(a=>a.date!==x.date);state.logs.push(x);state.logs.sort((a,b)=>a.date.localeCompare(b.date));save();renderAll()}
function renderHistory(){$('history').innerHTML=`<table><tr><th>Date</th><th>Weight</th><th>Waist</th><th>Steps</th><th>Sleep</th><th>Adherence</th></tr>${[...state.logs].reverse().map(x=>`<tr><td>${x.date}</td><td>${x.weight||'—'}</td><td>${x.waist||'—'}</td><td>${x.steps||'—'}</td><td>${x.sleep||'—'}</td><td>${x.adherence!=null?x.adherence+'%':'—'}</td></tr>`).join('')}</table>`}
function draw(id,key,label){const c=$(id),ctx=c.getContext('2d'),a=state.logs.filter(x=>x[key]).slice(-30),w=c.width,h=c.height;ctx.clearRect(0,0,w,h);ctx.fillStyle='#0b1325';ctx.fillRect(0,0,w,h);if(a.length<2){ctx.fillStyle='#9eabc3';ctx.fillText('Log more data to see trend',20,30);return}const v=a.map(x=>x[key]),lo=Math.min(...v),hi=Math.max(...v),span=hi-lo||1;ctx.strokeStyle='#38bdf8';ctx.lineWidth=3;ctx.beginPath();v.forEach((y,i)=>{const px=20+i*(w-40)/(v.length-1),py=h-20-(y-lo)/span*(h-40);i?ctx.lineTo(px,py):ctx.moveTo(px,py)});ctx.stroke();ctx.fillStyle='#f4f7fb';ctx.fillText(`${label}: ${v[v.length-1]}`,20,18)}
function coach(mode){const t={review:adaptive(),hungry:'Check meal volume, protein, vegetables, fluids and sleep before cutting more calories. If calories remain today, choose a high-protein, high-volume meal.',stall:'Use 7–14 day averages, waist, adherence and steps. If adherence is low, fix execution first. If adherence is high and the trend is truly slow, make a small adjustment.',missed:'Do not double up as punishment. Move the highest-priority session forward and resume the sequence. Cut lower-priority isolation work first if the week is compressed.',travel:'Hit protein, stay near calories, keep steps high, choose simple estimable meals, and use a short full-body workout if equipment is available.'};$('coachOut').textContent=t[mode]}
function exportData(){const b=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=`physiqueos-${today()}.json`;a.click();URL.revokeObjectURL(u)}function importData(inp){const f=inp.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{state=JSON.parse(r.result);save();renderAll();alert('Backup imported.')}catch(e){alert('Invalid backup.')}};r.readAsText(f)}function resetAll(){if(confirm('Erase all local data?')){localStorage.removeItem('physiqueOS');location.reload()}}
function renderDashboard(){const latest=[...state.logs].reverse().find(x=>x.weight),t=trend();$('welcome').textContent=state.profile.name?`Welcome, ${state.profile.name}.`:'Build your baseline';$('dashCalories').textContent=state.macro?state.macro.calories:'—';$('dashWeight').textContent=latest?latest.weight+' lb':state.profile.weight?state.profile.weight+' lb':'—';$('dashAdherence').textContent=t&&isFinite(t.adh)?t.adh.toFixed(0)+'%':'—';$('homeCoach').textContent=adaptive();draw('weightChart','weight','Weight');draw('waistChart','waist','Waist')}
function renderAll(){loadProfile();renderDashboard();renderNutrition();renderMeals();renderTraining();renderHistory();coach('review')}renderAll();if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});