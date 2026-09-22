const el=id=>document.getElementById(id);
const today=()=>new Date().toISOString().slice(0,10);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const avg=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:0;
const fmt=n=>Number.isFinite(n)?Math.round(n):'—';

let state=JSON.parse(localStorage.getItem('physiqueOS')||'null')||{};
state.profile=state.profile||{};
state.macro=state.macro||null;
state.logs=Array.isArray(state.logs)?state.logs:[];
state.mealPlan=Array.isArray(state.mealPlan)?state.mealPlan:[];
state.trainingPlan=Array.isArray(state.trainingPlan)?state.trainingPlan:[];
state.workoutLogs=Array.isArray(state.workoutLogs)?state.workoutLogs:[];
state.pendingAdjustment=state.pendingAdjustment||null;

function save(){localStorage.setItem('physiqueOS',JSON.stringify(state))}
function showTab(id){
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('active',x.dataset.tab===id));
  const target=document.querySelector('section#'+id+'.tab'); if(target) target.classList.add('active');
  renderAll();
}
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>showTab(b.dataset.tab));

el('logDate').value=today(); el('photoDate').value=today();
el('equipment').innerHTML=EQUIPMENT.map(e=>'<label><input type="checkbox" class="eq" value="'+e+'"> '+e+'</label>').join(' ');

function toggleUnits(){
  const metric=el('units').value==='metric';
  el('imperialHeight').classList.toggle('hidden',metric);
  el('metricHeight').classList.toggle('hidden',!metric);
  el('weightUnit').textContent=metric?'kg':'lb'; el('goalWeightUnit').textContent=metric?'kg':'lb';
}
function safetyBlockers(p){
  const out=[];
  if(p.pregnant)out.push('Pregnancy requires individualized guidance; automated calorie-restriction changes are disabled.');
  if(p.edRisk)out.push('Automated calorie restriction is disabled because eating-disorder/disordered-eating support should be individualized.');
  if(p.redFlag)out.push('Training/nutrition automation is paused for potentially serious symptoms. Seek appropriate medical evaluation.');
  return out;
}
function trainingBlocked(p){return !!(p.redFlag||p.acuteInjury)}
function calcMacro(p){
  const kg=p.weight/2.20462,cm=p.heightCm;
  let bmr=10*kg+6.25*cm-5*p.age+(p.sex==='male'?5:-161);
  if(p.bf){const lbm=kg*(1-p.bf/100); bmr=(bmr+(370+21.6*lbm))/2}
  const tdee=bmr*p.activity;
  let factor=1;
  if(p.goal==='fatloss')factor={conservative:.85,moderate:.80,aggressive:.75}[p.aggr]||.8;
  if(p.goal==='recomp')factor=.95;
  if(p.goal==='gain')factor={conservative:1.05,moderate:1.08,aggressive:1.12}[p.aggr]||1.08;
  let cal=tdee*factor;
  const floor=Math.max(p.sex==='male'?1600:1300,bmr*1.05);
  cal=Math.max(floor,cal);
  let protein=Math.round((p.goalWeight||p.weight)*1.0);
  if(p.bf){const lbmLb=p.weight*(1-p.bf/100);protein=Math.max(protein,Math.round(lbmLb*.9))}
  let fat=Math.round(Math.max((p.goalWeight||p.weight)*.3,cal*.22/9));
  let carbs=Math.max(40,Math.round((cal-protein*4-fat*9)/4));
  cal=Math.round(protein*4+carbs*4+fat*9);
  return{bmr:Math.round(bmr),tdee:Math.round(tdee),floor:Math.round(floor),calories:cal,protein,carbs,fat};
}
function saveProfile(){
  const metric=el('units').value==='metric';
  const heightCm=metric?+el('heightCm').value:((+el('ft').value||0)*12+(+el('inch').value||0))*2.54;
  const weight=metric?(+el('weightInput').value||0)*2.20462:+el('weightInput').value;
  const goalWeight=metric?(+el('goalWeightInput').value||0)*2.20462:+el('goalWeightInput').value;
  const p={
    name:el('name').value.trim(),age:+el('age').value,sex:el('sex').value,units:el('units').value,heightCm,
    ft:+el('ft').value||0,inch:+el('inch').value||0,weight,goalWeight:goalWeight||weight,bf:+el('bf').value||null,
    activity:+el('activity').value,goal:el('goal').value,aggr:el('aggr').value,trainingGoal:el('trainingGoal').value,
    days:+el('days').value,experience:el('experience').value,sessionLength:+el('sessionLength').value,
    trainingEnvironment:el('trainingEnvironment').value,preferredDays:el('preferredDays').value,cardioPreference:el('cardioPreference').value,
    meals:+el('mealsPerDay').value,mealStyle:el('mealStyle').value,mealVariety:el('mealVariety').value,cookingSkill:el('cookingSkill').value,
    prepTolerance:el('prepTolerance').value,mealsOut:+el('mealsOut').value||0,budget:+el('budget').value||0,zip:el('zip').value.trim(),
    stores:el('stores').value.trim(),groceryPriority:el('groceryPriority').value,cuisines:el('cuisines').value,diet:el('diet').value,
    allergies:el('allergies').value,exclude:el('exclude').value,preferredFoods:el('preferredFoods').value,injuries:el('injuries').value,
    pregnant:el('pregnant').checked,edRisk:el('edRisk').checked,redFlag:el('redFlag').checked,acuteInjury:el('acuteInjury').checked,
    equipment:[...document.querySelectorAll('.eq:checked')].map(x=>x.value)
  };
  if(!p.age||!p.weight||!p.heightCm)return alert('Enter age, height and weight.');
  state.profile=p;
  const blockers=safetyBlockers(p);
  state.macro=blockers.length?null:calcMacro(p);
  if(blockers.length){state.mealPlan=[];state.pendingAdjustment=null}
  save();renderAll();
  alert(blockers.length?'Assessment saved. Some automation is paused for safety.':'Assessment saved and targets calculated.');
}
function loadProfile(){
  const p=state.profile;if(!p.age){toggleUnits();return}
  const simple=['name','age','sex','units','bf','activity','goal','aggr','trainingGoal','days','experience','sessionLength','trainingEnvironment','preferredDays','cardioPreference','mealStyle','mealVariety','cookingSkill','prepTolerance','mealsOut','budget','zip','stores','groceryPriority','cuisines','diet'];
  simple.forEach(k=>{if(el(k)&&p[k]!=null)el(k).value=p[k]});
  if(el('mealsPerDay'))el('mealsPerDay').value=p.meals||4;
  if(p.units==='metric'){el('heightCm').value=p.heightCm||'';el('weightInput').value=(p.weight/2.20462).toFixed(1);el('goalWeightInput').value=(p.goalWeight/2.20462).toFixed(1)}
  else{el('ft').value=p.ft||Math.floor((p.heightCm/2.54)/12);el('inch').value=p.inch||Math.round((p.heightCm/2.54)%12);el('weightInput').value=p.weight?p.weight.toFixed(1):'';el('goalWeightInput').value=p.goalWeight?p.goalWeight.toFixed(1):''}
  el('allergies').value=p.allergies||'';el('exclude').value=p.exclude||'';el('preferredFoods').value=p.preferredFoods||'';el('injuries').value=p.injuries||'';
  ['pregnant','edRisk','redFlag','acuteInjury'].forEach(k=>el(k).checked=!!p[k]);
  document.querySelectorAll('.eq').forEach(x=>x.checked=(p.equipment||[]).includes(x.value));
  toggleUnits();
}
function trend(){
  const a=state.logs.filter(x=>x.weight).sort((x,y)=>x.date.localeCompare(y.date));if(a.length<2)return null;
  const first=a[0],last=a[a.length-1],days=Math.max(1,(new Date(last.date)-new Date(first.date))/86400000),weekly=(first.weight-last.weight)/(days/7);
  const recent=state.logs.slice(-7);
  const vals=k=>recent.map(x=>x[k]).filter(x=>Number.isFinite(x));
  return{weekly,pct:weekly/first.weight*100,days,adh:avg(vals('adherence')),steps:avg(vals('steps')),sleep:avg(vals('sleep')),hunger:avg(vals('hunger')),energy:avg(vals('energy')),stress:avg(vals('stress')),recovery:avg(vals('recovery')),soreness:avg(vals('soreness'))};
}
function getAdjustment(){
  if(!state.macro||safetyBlockers(state.profile).length)return null;
  const t=trend(),p=state.profile;if(!t||t.days<14||!t.adh||t.adh<85)return null;
  let delta=0,reason='';
  if(p.goal==='fatloss'){
    const target={conservative:.5,moderate:.75,aggressive:1}[p.aggr]||.75;
    if(t.pct<target-.25){delta=-125;reason='Weight trend is slower than target with high adherence.'}
    if(t.pct>target+.35||t.hunger>=8||t.recovery&&t.recovery<=4){delta=125;reason='Loss/recovery signals suggest the current deficit may be too aggressive.'}
  }else if(p.goal==='gain'){
    if(t.weekly<=0){delta=125;reason='Bodyweight is not rising despite high adherence.'}
    if(t.pct>0.6){delta=-100;reason='Rate of gain is faster than the beta target.'}
  }
  if(!delta)return null;
  const next=Math.max(state.macro.floor||0,state.macro.calories+delta);
  if(next===state.macro.calories)return null;
  return{delta:next-state.macro.calories,next,reason};
}
function applyAdjustment(){
  const a=getAdjustment()||state.pendingAdjustment;if(!a)return alert('No eligible adjustment right now.');
  const m=state.macro,delta=a.next-m.calories;
  let carbs=Math.round(m.carbs+delta/4);carbs=Math.max(40,carbs);
  m.carbs=carbs;m.calories=Math.round(m.protein*4+m.carbs*4+m.fat*9);
  state.pendingAdjustment=null;state.mealPlan=[];save();renderAll();alert('New target applied. Regenerate the meal plan to match it.');
}
function adaptive(){
  const blockers=safetyBlockers(state.profile);if(blockers.length)return blockers.join(' ');
  if(!state.macro)return'Complete onboarding first.';
  const t=trend();if(!t||t.days<7)return'Starting target: '+state.macro.calories+' kcal. Log at least 7–14 days before making a meaningful adjustment.';
  let s='Observed trend: '+Math.abs(t.weekly).toFixed(2)+' lb/week '+(t.weekly>=0?'down':'up')+'. Recent adherence: '+(t.adh?t.adh.toFixed(0):'—')+'%. ';
  if(t.adh&&t.adh<80)s+='Execution is the priority before changing calories. ';
  else{s+=getAdjustment()?'A target adjustment is available below. ':'Current data does not justify a calorie change yet. '}
  if(t.steps&&t.steps<7000)s+='Steps are averaging '+Math.round(t.steps)+'; daily movement is an available lever. ';
  if(t.sleep&&t.sleep<6.5)s+='Sleep is averaging '+t.sleep.toFixed(1)+' h; recovery may be limiting progress. ';
  if(t.hunger>=8)s+='Hunger is elevated. ';if(t.stress>=8)s+='Stress is elevated. ';if(t.recovery&&t.recovery<=4)s+='Recovery is low. ';
  return s;
}
function renderNutrition(){
  const blockers=safetyBlockers(state.profile);
  if(blockers.length){el('nutritionOut').innerHTML='<div class="notice dangerNotice"><strong>Automation paused.</strong><br>'+blockers.join('<br>')+'</div>';return}
  if(!state.macro){el('nutritionOut').innerHTML='<div class="notice">Complete onboarding first.</div>';return}
  const m=state.macro;
  el('nutritionOut').innerHTML='<div class="metrics"><div class="card"><small>BMR estimate</small><strong>'+m.bmr+'</strong></div><div class="card"><small>TDEE estimate</small><strong>'+m.tdee+'</strong></div><div class="card"><small>Daily calories</small><strong>'+m.calories+'</strong></div></div><div class="card"><table><tr><th>Protein</th><th>Carbs</th><th>Fat</th></tr><tr><td>'+m.protein+'g</td><td>'+m.carbs+'g</td><td>'+m.fat+'g</td></tr></table></div><div class="notice">'+adaptive()+'</div>';
}

function tokens(v){return(v||'').toLowerCase().split(/[,;\n]/).map(x=>x.trim()).filter(Boolean)}
function dietAllowed(f){
  const d=(state.profile.diet||'').toLowerCase();
  if(d.includes('vegan')&&!f.tags.includes('vegan'))return false;
  if(d.includes('vegetarian')&&!f.tags.includes('vegetarian'))return false;
  if(d.includes('pescatarian')&&f.tags.includes('meat'))return false;
  if(d.includes('dairy-free')&&f.allergens.includes('dairy'))return false;
  if(d.includes('gluten-free')&&(f.allergens.includes('gluten')||f.allergens.includes('gluten-risk')))return false;
  return true;
}
function excluded(f){
  if(!dietAllowed(f))return true;
  const allergy=tokens(state.profile.allergies),avoid=tokens(state.profile.exclude),name=f.name.toLowerCase();
  if(allergy.some(a=>name.includes(a)||f.allergens.some(x=>x.includes(a)||a.includes(x))))return true;
  return avoid.some(a=>name.includes(a));
}
function preferred(f){return tokens(state.profile.preferredFoods).some(x=>f.name.toLowerCase().includes(x))}
function costEfficiency(f,cat){
  const primary=cat==='protein'?f.p:cat==='carb'?f.c:cat==='fat'?f.f:Math.max(1,f.k/10);
  return f.price/Math.max(primary,1);
}
function pool(cat){
  let a=FOOD_DB.filter(x=>x.cat===cat&&!excluded(x));
  const pri=state.profile.groceryPriority||'balanced';
  a.sort((x,y)=>{
    const pref=Number(preferred(y))-Number(preferred(x));if(pref)return pref*100;
    if(pri==='budget')return costEfficiency(x,cat)-costEfficiency(y,cat);
    if(pri==='premium')return y.price-x.price;
    return (costEfficiency(x,cat)*.7+x.price*.03)-(costEfficiency(y,cat)*.7+y.price*.03);
  });
  return a;
}
function gramsFor(f,key,target){if(!f||!f[key])return 0;return Math.max(0,Math.round((target/(f[key]/100))/5)*5)}
function macro(f,g){const q=g/100;return{p:f.p*q,c:f.c*q,f:f.f*q,k:f.k*q}}
function sumMeal(items){return items.map(x=>{const f=FOOD_DB.find(z=>z.name===x.name);return f?macro(f,x.g):{p:0,c:0,f:0,k:0}}).reduce((a,x)=>({p:a.p+x.p,c:a.c+x.c,f:a.f+x.f,k:a.k+x.k}),{p:0,c:0,f:0,k:0})}
function primaryKey(cat){return cat==='protein'?'p':cat==='carb'?'c':cat==='fat'?'f':null}
function foodChoice(list,d,i){
  const variety=state.profile.mealVariety||'balanced';
  const span=variety==='simple'?Math.min(2,list.length):variety==='balanced'?Math.min(4,list.length):list.length;
  return list[(d+i)%Math.max(1,span)];
}
function buildMeal(d,i,n){
  const m=state.macro,ps=pool('protein'),cs=pool('carb'),vs=pool('veg'),fs=pool('fat');
  if(!ps.length||!cs.length||!vs.length||!fs.length)throw new Error('Your restrictions leave an empty food category. Adjust preferences or exclusions.');
  const pf=foodChoice(ps,d,i),cf=foodChoice(cs,d,i+1),vf=foodChoice(vs,d,i+2),ff=foodChoice(fs,d,i+3);
  const pg=gramsFor(pf,'p',m.protein/n),cg=gramsFor(cf,'c',m.carbs/n);
  const usedFat=macro(pf,pg).f+macro(cf,cg).f;
  const fg=gramsFor(ff,'f',Math.max(3,m.fat/n-usedFat));
  const items=[pf&&{name:pf.name,g:pg,cat:'protein',price:pf.price},cf&&{name:cf.name,g:cg,cat:'carb',price:cf.price},vf&&{name:vf.name,g:100,cat:'veg',price:vf.price},ff&&{name:ff.name,g:fg,cat:'fat',price:ff.price}].filter(Boolean);
  return{items,sum:sumMeal(items)};
}
function planCost(plan,rounded){
  const totals={};plan.forEach(d=>d.meals.forEach(m=>m.items.forEach(x=>{totals[x.name]=(totals[x.name]||0)+x.g})));
  return Object.entries(totals).reduce((s,[name,g])=>{const f=FOOD_DB.find(x=>x.name===name);if(!f)return s;const q=rounded?Math.ceil(g/f.packageG)*f.packageG:g;return s+q/1000*f.price},0);
}
function cheaperEquivalent(item){
  const old=FOOD_DB.find(x=>x.name===item.name),key=primaryKey(item.cat);if(!old||!key)return null;
  const target=old[key]*item.g/100;
  const opts=pool(item.cat).filter(x=>x.name!==old.name&&x[key]>0).map(x=>({f:x,g:gramsFor(x,key,target)})).sort((a,b)=>(a.g/1000*a.f.price)-(b.g/1000*b.f.price));
  return opts[0]||null;
}
function optimizeBudget(plan){
  const budget=Number(state.profile.budget)||0;if(!budget)return plan;
  let guard=0;
  while(planCost(plan,true)>budget&&guard<120){
    guard++;
    let best=null;
    plan.forEach((d,di)=>d.meals.forEach((m,mi)=>m.items.forEach((it,ii)=>{
      const alt=cheaperEquivalent(it);if(!alt)return;
      const oldCost=it.g/1000*it.price,newCost=alt.g/1000*alt.f.price,saving=oldCost-newCost;
      if(saving>0&&(!best||saving>best.saving))best={di,mi,ii,alt,saving};
    })));
    if(!best)break;
    const meal=plan[best.di].meals[best.mi],a=best.alt;
    meal.items[best.ii]={name:a.f.name,g:a.g,cat:a.f.cat,price:a.f.price};meal.sum=sumMeal(meal.items);
  }
  return plan;
}
function generateMeals(){
  try{
    if(safetyBlockers(state.profile).length)return alert('Meal-plan automation is paused by the safety screening.');
    if(!state.macro)return alert('Complete onboarding first.');
    const n=Number(state.profile.meals)||4,days=[];
    for(let d=0;d<7;d++){const meals=[];for(let i=0;i<n;i++)meals.push(buildMeal(d,i,n));days.push({day:d+1,meals})}
    state.mealPlan=optimizeBudget(days);save();renderMeals();
  }catch(e){console.error(e);el('mealPlan').innerHTML='<div class="notice dangerNotice">Meal generator error: '+String(e.message||e)+'</div>'}
}
function swapIngredient(di,mi,ii){
  const meal=state.mealPlan[di]?.meals?.[mi],item=meal?.items?.[ii];if(!meal||!item)return;
  const old=FOOD_DB.find(x=>x.name===item.name),key=primaryKey(item.cat),options=pool(item.cat).filter(x=>x.name!==item.name);
  if(!options.length)return alert('No compatible alternative is available.');
  const currentIndex=Number(item.swapIndex)||0,next=options[currentIndex%options.length];
  let g=item.g;if(key&&old&&next[key]>0){const target=old[key]*item.g/100;g=gramsFor(next,key,target)}
  meal.items[ii]={name:next.name,g,cat:next.cat,price:next.price,swapIndex:currentIndex+1};meal.sum=sumMeal(meal.items);save();renderMeals();
}
function replaceMeal(di,mi){
  const old=state.mealPlan[di]?.meals?.[mi];if(!old)return;
  let fresh=buildMeal(di+mi+3,mi+2,state.profile.meals||4);
  fresh.items.forEach((x,ii)=>{if(old.items[ii]&&x.name===old.items[ii].name){const opts=pool(x.cat).filter(z=>z.name!==x.name);if(opts.length){const oldF=FOOD_DB.find(z=>z.name===x.name),key=primaryKey(x.cat),n=opts[0];let g=x.g;if(key&&oldF&&n[key]>0)g=gramsFor(n,key,oldF[key]*x.g/100);fresh.items[ii]={name:n.name,g,cat:n.cat,price:n.price}}}});
  fresh.sum=sumMeal(fresh.items);state.mealPlan[di].meals[mi]=fresh;save();renderMeals();
}
function groceryTotals(){
  const totals={};state.mealPlan.forEach(d=>d.meals.forEach(m=>m.items.forEach(x=>{totals[x.name]=(totals[x.name]||0)+x.g})));return totals;
}
function storeNames(){const typed=(state.profile.stores||'').split(',').map(x=>x.trim()).filter(Boolean);return typed.length?typed:['Aldi','Walmart','Publix']}
function storeMultiplier(name){const key=Object.keys(STORE_MULTIPLIERS).find(k=>k.toLowerCase()===name.toLowerCase());return key?STORE_MULTIPLIERS[key]:1}
function storeSearchUrl(store){return'https://www.google.com/maps/search/'+encodeURIComponent(store+' grocery store near '+(state.profile.zip||''))}
function renderMeals(){
  if(!state.mealPlan.length){
    el('mealPlan').innerHTML='<div class="notice">Generate a plan first.</div>';
    el('grocery').innerHTML='<div class="notice">The grocery list will use your generated plan, budget, ZIP and preferred stores.</div>';
    el('swaps').innerHTML='<div class="notice">Ingredient and meal replacements appear after generation.</div>';return;
  }
  el('mealPlan').innerHTML=state.mealPlan.map((d,di)=>'<details class="meal" '+(d.day===1?'open':'')+'><summary>Day '+d.day+'</summary>'+d.meals.map((m,mi)=>'<div class="meal"><div class="row"><strong>Meal '+(mi+1)+'</strong><button onclick="replaceMeal('+di+','+mi+')">Replace meal</button></div><small>'+m.sum.k.toFixed(0)+' kcal • '+m.sum.p.toFixed(0)+'P '+m.sum.c.toFixed(0)+'C '+m.sum.f.toFixed(0)+'F</small>'+m.items.map((x,ii)=>'<div class="row"><span>'+x.g+'g '+x.name+'</span><button onclick="swapIngredient('+di+','+mi+','+ii+')">Swap</button></div>').join('')+'</div>').join('')+'</details>').join('');
  const totals=groceryTotals(),rows=Object.entries(totals);
  let roundedCost=0;
  const qtyRows=rows.map(([name,g])=>{const f=FOOD_DB.find(x=>x.name===name);const packs=Math.ceil(g/f.packageG),buy=packs*f.packageG,cost=buy/1000*f.price;roundedCost+=cost;return'<tr><td>'+name+'</td><td>'+Math.round(g)+'g needed</td><td>'+packs+' × '+Math.round(f.packageG)+'g</td></tr>'}).join('');
  const budget=Number(state.profile.budget)||0;
  const budgetMsg=budget?(roundedCost<=budget?'<div class="notice success">Estimated basket fits the entered budget.</div>':'<div class="notice warning">Estimated packaged basket is about $'+(roundedCost-budget).toFixed(2)+' over budget. The generator has already prioritized cheaper macro-equivalent foods where possible.</div>'):'';
  const cards=storeNames().map(s=>{const est=roundedCost*storeMultiplier(s);return'<div class="meal"><strong>'+s+'</strong><div>Planning estimate: $'+est.toFixed(2)+'</div><button onclick="window.open(\''+storeSearchUrl(s)+'\',\'_blank\')">Find near '+(state.profile.zip||'ZIP')+'</button></div>'}).join('');
  el('grocery').innerHTML='<p><strong>ZIP:</strong> '+(state.profile.zip||'Not set')+' • <strong>Budget:</strong> '+(budget?'$'+budget:'Not set')+'</p>'+budgetMsg+'<h4>Shopping quantities</h4><table>'+qtyRows+'</table><h4>Store options</h4><small>Estimates are not live retailer prices or inventory.</small>'+cards;
  el('swaps').innerHTML=['protein','carb','fat','veg'].map(cat=>'<div class="meal"><strong>'+cat+'</strong><div>'+pool(cat).map(x=>x.name).join(' • ')+'</div></div>').join('');
}
function openStores(){window.open('https://www.google.com/maps/search/'+encodeURIComponent((state.profile.stores||'grocery stores')+' near '+(state.profile.zip||'')),'_blank')}

function split(days){
  if(days<=2)return[['Full Body A',['quads','chest','back','hamstrings','delts','core']],['Full Body B',['glutes','back','chest','hamstrings','biceps','triceps']]];
  if(days===3)return[['Full A',['quads','chest','back','hamstrings','delts']],['Full B',['glutes','back','chest','biceps','triceps']],['Full C',['quads','chest','back','glutes','calves']]];
  if(days===4)return[['Upper A',['chest','back','delts','biceps','triceps']],['Lower A',['quads','hamstrings','glutes','calves','core']],['Upper B',['back','chest','delts','biceps','triceps']],['Lower B',['glutes','quads','hamstrings','calves','core']]];
  return[['Push',['chest','delts','triceps']],['Pull',['back','biceps','delts']],['Legs',['quads','hamstrings','glutes','calves']],['Upper',['chest','back','delts','biceps','triceps']],['Lower',['quads','hamstrings','glutes','calves','core']],['Full Body',['quads','chest','back','hamstrings','delts','core']]].slice(0,days);
}
function chooseEx(m,i){
  const s=(state.profile.injuries||'').toLowerCase(),owned=state.profile.equipment||[];
  let a=EXERCISES.filter(x=>x.m===m&&x.eq.some(e=>owned.includes(e))&&!x.avoid.some(z=>s.includes(z)));
  if(!a.length)a=EXERCISES.filter(x=>x.m===m&&!x.avoid.some(z=>s.includes(z)));return a[i%a.length]?.name||('Pain-free '+m+' movement');
}
function generateTraining(){
  if(trainingBlocked(state.profile))return alert('Training generation is paused by the safety screening until the acute issue is evaluated/resolved.');
  if(!state.profile.age)return alert('Complete onboarding first.');
  const exp=state.profile.experience,goal=state.profile.trainingGoal,baseSets=exp==='beginner'?2:exp==='advanced'?4:3;
  const limit=state.profile.sessionLength<=30?4:state.profile.sessionLength<=45?5:state.profile.sessionLength<=60?6:7;
  state.trainingPlan=split(state.profile.days||4).map((d,di)=>({name:d[0],preferredDay:(state.profile.preferredDays||'').split(',')[di]?.trim()||'',items:d[1].slice(0,limit).map((m,i)=>{
    const compound=['chest','back','quads','hamstrings','glutes'].includes(m),range=goal==='strength'&&compound?[4,8]:goal==='performance'&&compound?[5,10]:compound?[6,12]:[10,20];
    return{name:chooseEx(m,di+i),sets:baseSets,minReps:range[0],maxReps:range[1],rir:exp==='advanced'?2:3};
  })
}));
  save();renderTraining();
}
function lastExerciseLogs(name){return state.workoutLogs.flatMap(w=>w.exercises||[]).filter(x=>x.name===name).slice(-2)}
function progression(name,min,max,targetRir){
  const a=lastExerciseLogs(name);if(!a.length)return'Log this exercise to establish a baseline.';
  const x=a[a.length-1];
  if(x.reps>=max&&x.rir>=targetRir)return'Next time: add ~2.5–5% load and return toward the lower end of the rep range.';
  if(x.reps<min||x.rir<=0)return'Next time: hold or reduce load slightly and rebuild clean reps inside the target range.';
  if(a.length>=2&&x.reps>a[a.length-2].reps)return'Progressing. Keep the load and add reps until you reach the top of the range.';
  return'Hold load and aim to beat reps or execution quality next session.';
}
function logWorkout(di){
  const day=state.trainingPlan[di];if(!day)return;
  const exercises=day.items.map((x,ei)=>({name:x.name,weight:+el('w_'+di+'_'+ei).value||0,reps:+el('r_'+di+'_'+ei).value||0,rir:+el('rir_'+di+'_'+ei).value||0})).filter(x=>x.reps>0);
  if(!exercises.length)return alert('Enter at least one exercise result.');
  state.workoutLogs.push({date:today(),workout:day.name,exercises});save();renderTraining();alert('Workout logged. Progression guidance updated.');
}
function renderTraining(){
  if(trainingBlocked(state.profile)){el('trainingPlan').innerHTML='<div class="notice dangerNotice">Training automation is paused by the safety screening.</div>';return}
  if(!state.trainingPlan.length){el('trainingPlan').innerHTML='<div class="notice">Generate a program first.</div>';el('workoutHistory').innerHTML='';return}
  el('trainingPlan').innerHTML=state.trainingPlan.map((d,di)=>'<div class="workout"><div class="row"><h3>'+d.name+'</h3><span class="pill">'+(d.preferredDay||'Session '+(di+1))+'</span></div>'+d.items.map((x,ei)=>'<div class="exerciseLog"><div class="exName"><strong>'+x.name+'</strong><br><small>'+x.sets+' sets • '+x.minReps+'–'+x.maxReps+' reps • target '+x.rir+' RIR</small><br><small>'+progression(x.name,x.minReps,x.maxReps,x.rir)+'</small></div><label>Load<input id="w_'+di+'_'+ei+'" type="number" step=".5"></label><label>Reps<input id="r_'+di+'_'+ei+'" type="number"></label><label>RIR<input id="rir_'+di+'_'+ei+'" type="number" min="0" max="6"></label></div>').join('')+'<button class="primary" onclick="logWorkout('+di+')">Log '+d.name+'</button></div>').join('');
  el('workoutHistory').innerHTML=state.workoutLogs.length?[...state.workoutLogs].reverse().slice(0,12).map(w=>'<div class="meal"><strong>'+w.date+' • '+w.workout+'</strong><div>'+w.exercises.map(x=>x.name+': '+x.weight+' × '+x.reps+' @ '+x.rir+' RIR').join('<br>')+'</div></div>').join(''):'<div class="notice">No workouts logged yet.</div>';
}

function saveLog(){
  const x={date:el('logDate').value||today(),weight:+el('logWeight').value||null,waist:+el('logWaist').value||null,chest:+el('logChest').value||null,arm:+el('logArm').value||null,thigh:+el('logThigh').value||null,steps:+el('logSteps').value||null,water:+el('logWater').value||null,sleep:+el('logSleep').value||null,calories:+el('logCalories').value||null,adherence:+el('logAdherence').value||null,hunger:+el('logHunger').value||null,energy:+el('logEnergy').value||null,stress:+el('logStress').value||null,recovery:+el('logRecovery').value||null,soreness:+el('logSoreness').value||null,digestion:+el('logDigestion').value||null,performance:el('logPerformance').value,notes:el('logNotes').value};
  state.logs=state.logs.filter(a=>a.date!==x.date);state.logs.push(x);state.logs.sort((a,b)=>a.date.localeCompare(b.date));save();renderAll();
}
function renderHistory(){
  el('history').innerHTML='<table><tr><th>Date</th><th>Weight</th><th>Waist</th><th>Steps</th><th>Sleep</th><th>Adh.</th><th>Hunger</th><th>Recovery</th></tr>'+[...state.logs].reverse().map(x=>'<tr><td>'+x.date+'</td><td>'+(x.weight||'—')+'</td><td>'+(x.waist||'—')+'</td><td>'+(x.steps||'—')+'</td><td>'+(x.sleep||'—')+'</td><td>'+(x.adherence!=null?x.adherence+'%':'—')+'</td><td>'+(x.hunger||'—')+'</td><td>'+(x.recovery||'—')+'</td></tr>').join('')+'</table>';
}
function draw(id,key,label){
  const c=el(id),ctx=c.getContext('2d'),a=state.logs.filter(x=>x[key]).slice(-30),w=c.width,h=c.height;ctx.clearRect(0,0,w,h);ctx.fillStyle='#0b1325';ctx.fillRect(0,0,w,h);
  if(a.length<2){ctx.fillStyle='#9eabc3';ctx.fillText('Log more data to see trend',20,30);return}
  const v=a.map(x=>x[key]),lo=Math.min(...v),hi=Math.max(...v),span=hi-lo||1;ctx.strokeStyle='#38bdf8';ctx.lineWidth=3;ctx.beginPath();v.forEach((y,i)=>{const px=20+i*(w-40)/(v.length-1),py=h-20-(y-lo)/span*(h-40);i?ctx.lineTo(px,py):ctx.moveTo(px,py)});ctx.stroke();ctx.fillStyle='#f4f7fb';ctx.fillText(label+': '+v[v.length-1],20,18);
}

function openPhotoDB(){return new Promise((res,rej)=>{const r=indexedDB.open('PhysiqueOSPhotos',1);r.onupgradeneeded=()=>r.result.createObjectStore('photos',{keyPath:'id'});r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function savePhotos(){
  const date=el('photoDate').value||today(),files={front:el('photoFront').files[0],side:el('photoSide').files[0],back:el('photoBack').files[0]};
  if(!files.front&&!files.side&&!files.back)return alert('Choose at least one photo.');
  const db=await openPhotoDB(),tx=db.transaction('photos','readwrite'),store=tx.objectStore('photos');
  for(const [pose,file] of Object.entries(files)){if(file)store.put({id:date+'_'+pose,date,pose,blob:file})}
  tx.oncomplete=()=>{db.close();renderPhotoGallery();alert('Progress photos saved on this device.')};
}
async function renderPhotoGallery(){
  try{const db=await openPhotoDB(),tx=db.transaction('photos','readonly'),req=tx.objectStore('photos').getAll();req.onsuccess=()=>{const items=req.result.sort((a,b)=>b.date.localeCompare(a.date)),groups={};items.forEach(x=>(groups[x.date]??=[]).push(x));el('photoGallery').innerHTML=Object.entries(groups).map(([date,arr])=>'<div class="photoSet"><strong>'+date+'</strong><div class="photoRow">'+arr.map(x=>'<div><small>'+x.pose+'</small><img src="'+URL.createObjectURL(x.blob)+'"></div>').join('')+'</div></div>').join('');db.close()}}catch(e){console.warn(e)}
}

function renderGettingStarted(){
  const steps=[
    ['Complete assessment',!!state.profile.age,'onboarding'],
    ['Review nutrition targets',!!state.macro,'nutrition'],
    ['Generate meal plan',state.mealPlan.length>0,'meals'],
    ['Generate training plan',state.trainingPlan.length>0,'training'],
    ['Log first check-in',state.logs.length>0,'progress'],
    ['Log first workout',state.workoutLogs.length>0,'training']
  ];
  el('gettingStarted').innerHTML=steps.map(s=>'<div class="stepItem '+(s[1]?'stepDone':'')+' row"><span>'+s[0]+'</span><button onclick="showTab(\''+s[2]+'\')">'+(s[1]?'View':'Do this')+'</button></div>').join('');
}
function todaysWorkout(){
  if(!state.trainingPlan.length)return null;
  const names=['sun','mon','tue','wed','thu','fri','sat'],day=names[new Date().getDay()];
  const pref=(state.profile.preferredDays||'').toLowerCase().split(',').map(x=>x.trim().slice(0,3));
  const idx=pref.indexOf(day);return idx>=0?state.trainingPlan[idx%state.trainingPlan.length]:state.trainingPlan[(new Date().getDay()+6)%state.trainingPlan.length];
}
function renderToday(){
  if(!state.profile.age){el('todayPanel').innerHTML='<div class="notice">Start with onboarding. Once your assessment is saved, this becomes your daily command center.</div>';return}
  const log=state.logs.find(x=>x.date===today()),work=todaysWorkout(),dayIdx=(new Date().getDay()+6)%7,mealDay=state.mealPlan[dayIdx%Math.max(1,state.mealPlan.length)];
  const meal=mealDay?.meals?.[0];
  el('todayPanel').innerHTML='<div class="grid2"><div class="todayItem"><strong>Nutrition</strong><div>'+(state.macro?state.macro.calories+' kcal • '+state.macro.protein+'P '+state.macro.carbs+'C '+state.macro.fat+'F':'Complete onboarding')+'</div></div><div class="todayItem"><strong>Training</strong><div>'+(work?work.name+(work.preferredDay?' • '+work.preferredDay:''):'Generate a program')+'</div></div><div class="todayItem"><strong>Movement / recovery</strong><div>Steps: '+(log?.steps||'—')+' • Water: '+(log?.water||'—')+' oz • Sleep: '+(log?.sleep||'—')+' h</div></div><div class="todayItem"><strong>Next meal</strong><div>'+(meal?meal.items.map(x=>x.g+'g '+x.name).join(' • '):'Generate a meal plan')+'</div></div></div><div class="buttons"><button onclick="showTab(\'progress\')">'+(log?'Update today’s check-in':'Log today’s check-in')+'</button><button onclick="showTab(\'training\')">Open training</button><button onclick="showTab(\'meals\')">Open meals</button></div>';
}
function renderAdjustment(){
  const a=getAdjustment();state.pendingAdjustment=a;save();
  const html=a?'<div class="notice warning"><strong>Suggested target change:</strong> '+(a.delta>0?'+':'')+a.delta+' kcal/day → '+a.next+' kcal.<br>'+a.reason+'<div class="buttons"><button class="primary" onclick="applyAdjustment()">Apply adjustment</button></div></div>':'';
  el('adjustmentPanel').innerHTML=html;el('coachAdjustment').innerHTML=html;
}
function renderDashboard(){
  const latest=[...state.logs].reverse().find(x=>x.weight),t=trend();
  el('welcome').textContent=state.profile.name?'Welcome, '+state.profile.name+'.':'Build your baseline';
  el('dashCalories').textContent=state.macro?state.macro.calories:'—';el('dashWeight').textContent=latest?latest.weight+' lb':state.profile.weight?state.profile.weight.toFixed(1)+' lb':'—';el('dashAdherence').textContent=t&&t.adh?t.adh.toFixed(0)+'%':'—';
  el('homeCoach').textContent=adaptive();renderGettingStarted();renderToday();renderAdjustment();draw('weightChart','weight','Weight');draw('waistChart','waist','Waist');
}
function coach(mode){
  const map={
    review:adaptive(),
    hungry:'Check protein, fiber/produce, meal volume, fluids, sleep and meal timing first. If hunger remains high for several days alongside strong adherence, the adaptive review will treat that as a recovery signal.',
    stall:'Use 7–14 day averages, waist, adherence and steps. A single scale reading is not a plateau. If adherence is high and trend is truly slow, PhysiqueOS can propose a small target change.',
    missed:'Do not double up as punishment. Move the highest-priority session forward and resume the sequence. If the week is compressed, remove lower-priority isolation work first.',
    travel:'Prioritize protein, calories, steps and simple estimable meals. Use a short full-body session if equipment is available; otherwise preserve movement and resume the plan afterward.'
  };
  el('coachOut').textContent=map[mode]||map.review;renderAdjustment();
}
function exportData(){const b=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download='physiqueos-'+today()+'.json';a.click();URL.revokeObjectURL(u)}
function importData(inp){const f=inp.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{state=JSON.parse(r.result);state.profile=state.profile||{};state.logs=state.logs||[];state.mealPlan=state.mealPlan||[];state.trainingPlan=state.trainingPlan||[];state.workoutLogs=state.workoutLogs||[];save();renderAll();alert('Backup imported.')}catch(e){alert('Invalid backup.')}};r.readAsText(f)}
function resetAll(){if(confirm('Erase all local coaching data? Progress photos stored in IndexedDB are not erased by this button.')){localStorage.removeItem('physiqueOS');location.reload()}}
function renderAll(){loadProfile();renderDashboard();renderNutrition();renderMeals();renderTraining();renderHistory();coach('review');renderPhotoGallery()}
renderAll();
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js?v=10').catch(()=>{});