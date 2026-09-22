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
state.coachMessages=Array.isArray(state.coachMessages)?state.coachMessages:[];
state.foodLogs=Array.isArray(state.foodLogs)?state.foodLogs:[];
state.activityLogs=Array.isArray(state.activityLogs)?state.activityLogs:[];
state.recoveryLogs=Array.isArray(state.recoveryLogs)?state.recoveryLogs:[];
state.mealPrefs=state.mealPrefs||{meals:Number(state.profile.meals)||4,snacks:1,distribution:'balanced'};
state.dayMealPrefs=state.dayMealPrefs||{};
state.activeTimer=state.activeTimer||null;

function save(){localStorage.setItem('physiqueOS',JSON.stringify(state))}
function showTab(id){
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('active',x.dataset.tab===id));
  const target=document.querySelector('section#'+id+'.tab'); if(target) target.classList.add('active');
  renderAll();
}
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>showTab(b.dataset.tab));

el('logDate').value=today(); el('photoDate').value=today(); if(el('foodLogDate'))el('foodLogDate').value=today();
el('equipment').innerHTML=EQUIPMENT.map(e=>'<label><input type="checkbox" class="eq" value="'+e+'"> '+e+'</label>').join(' '); if(el('foodSelect'))el('foodSelect').innerHTML=FOOD_DB.map((f,idx)=>'<option value="'+idx+'">'+f.name+'</option>').join('');

function toggleUnits(){
  const metric=el('units').value==='metric';
  el('imperialHeight').classList.toggle('hidden',metric);
  el('metricHeight').classList.toggle('hidden',!metric);
  el('weightUnit').textContent=metric?'kg':'lb'; el('goalWeightUnit').textContent=metric?'kg':'lb'; if(el('waterGoalUnit'))el('waterGoalUnit').textContent=metric?'L':'oz'; if(el('quickWaterUnit'))el('quickWaterUnit').textContent=metric?'L':'oz'; if(el('quickWeightUnit'))el('quickWeightUnit').textContent=metric?'kg':'lb'; if(el('dailyWeightUnit'))el('dailyWeightUnit').textContent=metric?'kg':'lb'; if(el('dailyMeasureUnit'))el('dailyMeasureUnit').textContent=metric?'cm':'in'; if(el('dailyWaterUnit'))el('dailyWaterUnit').textContent=metric?'L':'oz'; if(el('waterGoal')){const v=+el('waterGoal').value||0;if(metric&&v>20)el('waterGoal').value=(v/33.814).toFixed(1);if(!metric&&v>0&&v<20)el('waterGoal').value=Math.round(v*33.814)}
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
    trainingEnvironment:el('trainingEnvironment').value,preferredDays:el('preferredDays').value,cardioPreference:el('cardioPreference').value,stepGoal:+el('stepGoal').value||8000,waterGoalOz:el('units').value==='metric'?(+el('waterGoal').value||3)*33.814:(+el('waterGoal').value||100),sleepGoal:+el('sleepGoal').value||7.5,
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
  const simple=['name','age','sex','units','bf','activity','goal','aggr','trainingGoal','days','experience','sessionLength','trainingEnvironment','preferredDays','cardioPreference','stepGoal','sleepGoal','mealStyle','mealVariety','cookingSkill','prepTolerance','mealsOut','budget','zip','stores','groceryPriority','cuisines','diet'];
  simple.forEach(k=>{if(el(k)&&p[k]!=null)el(k).value=p[k]});
  if(el('mealsPerDay'))el('mealsPerDay').value=p.meals||4;
  if(p.units==='metric'){el('heightCm').value=p.heightCm||'';el('weightInput').value=(p.weight/2.20462).toFixed(1);el('goalWeightInput').value=(p.goalWeight/2.20462).toFixed(1)}
  else{el('ft').value=p.ft||Math.floor((p.heightCm/2.54)/12);el('inch').value=p.inch||Math.round((p.heightCm/2.54)%12);el('weightInput').value=p.weight?p.weight.toFixed(1):'';el('goalWeightInput').value=p.goalWeight?p.goalWeight.toFixed(1):''}
  el('allergies').value=p.allergies||'';el('exclude').value=p.exclude||'';el('preferredFoods').value=p.preferredFoods||'';el('injuries').value=p.injuries||'';
  ['pregnant','edRisk','redFlag','acuteInjury'].forEach(k=>el(k).checked=!!p[k]);
  document.querySelectorAll('.eq').forEach(x=>x.checked=(p.equipment||[]).includes(x.value));
  if(el('waterGoal'))el('waterGoal').value=p.units==='metric'?((p.waterGoalOz||100)/33.814).toFixed(1):(p.waterGoalOz||100);
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
function snackPool(cat){
  const base=pool(cat);
  const names=cat==='protein'?['Greek yogurt','cottage','Whey','Plant protein','Whole eggs','Egg whites','tofu']:
    cat==='carb'?['berries','Banana','Apple','Oats','Cream of rice','bread']:
    cat==='fat'?['Almond butter','Peanut butter','Avocado']:[];
  const filtered=base.filter(f=>names.some(n=>f.name.toLowerCase().includes(n.toLowerCase())));
  return filtered.length?filtered:base;
}
function mealStructure(meals,snacks,distribution='balanced'){
  meals=clamp(Number(meals)||3,2,6);snacks=clamp(Number(snacks)||0,0,3);
  const snackEach=snacks?Math.min(.12,(.30/snacks)):0,totalSnack=snackEach*snacks,mealPool=1-totalSnack;
  let weights=Array.from({length:meals},()=>1);
  if(distribution==='largerDinner')weights[weights.length-1]=1.45;
  if(distribution==='largerBreakfast')weights[0]=1.45;
  if(distribution==='training'&&weights.length>=3){weights[Math.floor(weights.length/2)]=1.25;weights[Math.min(weights.length-1,Math.floor(weights.length/2)+1)]=1.2}
  const sum=weights.reduce((s,x)=>s+x,0);
  const parts=weights.map((w,idx)=>({kind:'meal',label:'Meal '+(idx+1),share:mealPool*w/sum}));
  for(let s=0;s<snacks;s++)parts.push({kind:'snack',label:'Snack '+(s+1),share:snackEach});
  return parts;
}
function previewMealStructure(){
  if(!el('mealStructurePreview'))return;
  const meals=+el('planMealsPerDay').value||4,snacks=+el('planSnacksPerDay').value||0,dist=el('mealDistribution').value||'balanced',parts=mealStructure(meals,snacks,dist),m=state.macro;
  el('mealStructurePreview').innerHTML=parts.map(p=>'<div class="structureChip"><strong>'+p.label+'</strong><span>'+(m?Math.round(m.calories*p.share)+' kcal • '+Math.round(m.protein*p.share)+'P':' '+Math.round(p.share*100)+'% of day')+'</span></div>').join('');
}
function buildMeal(d,i,share,kind='meal',label='Meal'){
  const m=state.macro,ps=kind==='snack'?snackPool('protein'):pool('protein'),cs=kind==='snack'?snackPool('carb'):pool('carb'),vs=pool('veg'),fs=kind==='snack'?snackPool('fat'):pool('fat');
  if(!ps.length||!cs.length||!fs.length||(kind==='meal'&&!vs.length))throw new Error('Your restrictions leave an empty food category. Adjust preferences or exclusions.');
  const pf=foodChoice(ps,d,i),cf=foodChoice(cs,d,i+1),vf=kind==='meal'?foodChoice(vs,d,i+2):null,ff=foodChoice(fs,d,i+3);
  const targetP=m.protein*share,targetC=m.carbs*share,targetF=m.fat*share;
  const pg=gramsFor(pf,'p',targetP),cg=gramsFor(cf,'c',targetC);
  const usedFat=macro(pf,pg).f+macro(cf,cg).f;
  const fg=gramsFor(ff,'f',Math.max(2,targetF-usedFat));
  const items=[pf&&{name:pf.name,g:pg,cat:'protein',price:pf.price},cf&&{name:cf.name,g:cg,cat:'carb',price:cf.price},vf&&{name:vf.name,g:kind==='meal'?100:0,cat:'veg',price:vf.price},ff&&{name:ff.name,g:fg,cat:'fat',price:ff.price}].filter(x=>x&&x.g>0);
  return{kind,label,share,items,sum:sumMeal(items)};
}
function buildMealDay(dayIndex,meals,snacks,distribution){
  const parts=mealStructure(meals,snacks,distribution);
  return{day:dayIndex+1,meals:parts.map((p,i)=>buildMeal(dayIndex,i,p.share,p.kind,p.label)),prefs:{meals:+meals,snacks:+snacks,distribution}};
}
function generateMeals(){
  try{
    if(safetyBlockers(state.profile).length)return alert('Meal-plan automation is paused by the safety screening.');
    if(!state.macro)return alert('Complete onboarding first.');
    const meals=+el('planMealsPerDay').value||Number(state.profile.meals)||4,snacks=+el('planSnacksPerDay').value||0,distribution=el('mealDistribution').value||'balanced';
    state.mealPrefs={meals,snacks,distribution};state.dayMealPrefs={};
    const days=[];for(let d=0;d<7;d++)days.push(buildMealDay(d,meals,snacks,distribution));
    state.mealPlan=optimizeBudget(days);save();renderMeals();
  }catch(e){console.error(e);el('mealPlan').innerHTML='<div class="notice dangerNotice">Meal generator error: '+String(e.message||e)+'</div>'}
}
function rebuildMealDay(di){
  try{
    const meals=+el('dayMeals_'+di).value||3,snacks=+el('daySnacks_'+di).value||0,distribution=el('dayDist_'+di).value||state.mealPrefs.distribution||'balanced';
    state.dayMealPrefs[di]={meals,snacks,distribution};state.mealPlan[di]=buildMealDay(di,meals,snacks,distribution);save();renderMeals();
  }catch(e){alert('Could not rebuild this day: '+e.message)}
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
  const share=old.share||1/Math.max(1,state.mealPlan[di].meals.length),kind=old.kind||'meal',label=old.label||(kind==='snack'?'Snack':'Meal '+(mi+1));
  let fresh=buildMeal(di+mi+3,mi+2,share,kind,label);
  fresh.items.forEach((x,ii)=>{if(old.items[ii]&&x.name===old.items[ii].name){const opts=(kind==='snack'?snackPool(x.cat):pool(x.cat)).filter(z=>z.name!==x.name);if(opts.length){const oldF=FOOD_DB.find(z=>z.name===x.name),key=primaryKey(x.cat),n=opts[0];let g=x.g;if(key&&oldF&&n[key]>0)g=gramsFor(n,key,oldF[key]*x.g/100);fresh.items[ii]={name:n.name,g,cat:n.cat,price:n.price}}}});
  fresh.sum=sumMeal(fresh.items);state.mealPlan[di].meals[mi]=fresh;save();renderMeals();
}
function groceryTotals(){
  const totals={};state.mealPlan.forEach(d=>d.meals.forEach(m=>m.items.forEach(x=>{totals[x.name]=(totals[x.name]||0)+x.g})));return totals;
}
function storeNames(){const typed=(state.profile.stores||'').split(',').map(x=>x.trim()).filter(Boolean);return typed.length?typed:['Aldi','Walmart','Publix']}
function storeMultiplier(name){const key=Object.keys(STORE_MULTIPLIERS).find(k=>k.toLowerCase()===name.toLowerCase());return key?STORE_MULTIPLIERS[key]:1}
function storeSearchUrl(store){return'https://www.google.com/maps/search/'+encodeURIComponent(store+' grocery store near '+(state.profile.zip||''))}
function displayGroceryWeight(g){
  const grams=Number(g)||0;
  if(state.profile.units==='metric'){
    return grams>=1000?(grams/1000).toFixed(2).replace(/\.00$/,'')+' kg':Math.round(grams)+' g';
  }
  const oz=grams/28.3495;
  if(oz>=16){
    const lb=Math.floor(oz/16),rem=oz-lb*16;
    return lb+' lb'+(rem>=0.5?' '+rem.toFixed(1).replace(/\.0$/,'')+' oz':'');
  }
  return oz.toFixed(1).replace(/\.0$/,'')+' oz';
}
function displayPackage(g,packs){
  return packs+' × '+displayGroceryWeight(g);
}
function renderMeals(){
  if(el('planMealsPerDay'))el('planMealsPerDay').value=state.mealPrefs.meals||state.profile.meals||4;
  if(el('planSnacksPerDay'))el('planSnacksPerDay').value=state.mealPrefs.snacks??1;
  if(el('mealDistribution'))el('mealDistribution').value=state.mealPrefs.distribution||'balanced';
  previewMealStructure();
  if(!state.mealPlan.length){
    el('mealPlan').innerHTML='<div class="notice">Choose your meal + snack structure above, then generate a plan.</div>';
    el('grocery').innerHTML='<div class="notice">The grocery list will use your generated plan, budget, ZIP and preferred stores.</div>';
    el('swaps').innerHTML='<div class="notice">Ingredient and meal replacements appear after generation.</div>';return;
  }
  el('mealPlan').innerHTML=state.mealPlan.map((d,di)=>{
    const pref=d.prefs||state.dayMealPrefs[di]||state.mealPrefs,total=d.meals.reduce((s,m)=>({k:s.k+m.sum.k,p:s.p+m.sum.p,c:s.c+m.sum.c,f:s.f+m.sum.f}),{k:0,p:0,c:0,f:0});
    const controls='<div class="dayStructure"><label>Meals<select id="dayMeals_'+di+'">'+[2,3,4,5,6].map(n=>'<option '+(n==pref.meals?'selected':'')+'>'+n+'</option>').join('')+'</select></label><label>Snacks<select id="daySnacks_'+di+'">'+[0,1,2,3].map(n=>'<option '+(n==pref.snacks?'selected':'')+'>'+n+'</option>').join('')+'</select></label><label>Distribution<select id="dayDist_'+di+'"><option value="balanced" '+(pref.distribution==='balanced'?'selected':'')+'>Balanced</option><option value="largerDinner" '+(pref.distribution==='largerDinner'?'selected':'')+'>Larger dinner</option><option value="largerBreakfast" '+(pref.distribution==='largerBreakfast'?'selected':'')+'>Larger breakfast</option><option value="training" '+(pref.distribution==='training'?'selected':'')+'>Training-focused</option></select></label><button onclick="rebuildMealDay('+di+')">Rebuild day</button></div>';
    const cards=d.meals.map((m,mi)=>'<div class="meal '+(m.kind==='snack'?'snackCard':'')+'"><div class="row"><div><span class="mealType">'+(m.kind==='snack'?'SNACK':'MEAL')+'</span><strong>'+(m.label||((m.kind==='snack'?'Snack ':'Meal ')+(mi+1)))+'</strong></div><div class="rowWrap"><button onclick="logPlannedMeal('+di+','+mi+')">Log</button><button onclick="replaceMeal('+di+','+mi+')">Replace</button></div></div><small>'+m.sum.k.toFixed(0)+' kcal • '+m.sum.p.toFixed(0)+'P '+m.sum.c.toFixed(0)+'C '+m.sum.f.toFixed(0)+'F</small>'+m.items.map((x,ii)=>'<div class="row"><span>'+x.g+'g '+x.name+'</span><button onclick="swapIngredient('+di+','+mi+','+ii+')">Swap</button></div>').join('')+'</div>').join('');
    return'<details class="meal dayCard" '+(d.day===1?'open':'')+'><summary><span>Day '+d.day+'</span><small>'+Math.round(total.k)+' kcal • '+Math.round(total.p)+'P '+Math.round(total.c)+'C '+Math.round(total.f)+'F</small></summary>'+controls+cards+'</details>';
  }).join('');
  const totals=groceryTotals(),rows=Object.entries(totals);let roundedCost=0;
  const qtyRows=rows.map(([name,g])=>{const f=FOOD_DB.find(x=>x.name===name);if(!f)return'';const packs=Math.ceil(g/f.packageG),buy=packs*f.packageG,cost=buy/1000*f.price;roundedCost+=cost;return'<tr><td>'+name+'</td><td>'+displayGroceryWeight(g)+' needed</td><td>'+displayPackage(f.packageG,packs)+'</td></tr>'}).join('');
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
    return{name:chooseEx(m,di+i),muscle:m,sets:baseSets,minReps:range[0],maxReps:range[1],rir:exp==='advanced'?2:3};
  })
}));
  save();renderTraining();
}
function lastExerciseLogs(name){return state.workoutLogs.flatMap(w=>w.exercises||[]).filter(x=>x.name===name).slice(-2)}
function exerciseMuscle(item){return item.muscle||EXERCISES.find(e=>e.name===item.name)?.m||''}
function swapExercise(di,ei){
  const item=state.trainingPlan[di]?.items?.[ei];if(!item)return;
  const m=exerciseMuscle(item),inj=(state.profile.injuries||'').toLowerCase(),owned=state.profile.equipment||[];
  let opts=EXERCISES.filter(x=>x.m===m&&x.name!==item.name&&x.eq.some(e=>owned.includes(e))&&!x.avoid.some(z=>inj.includes(z)));
  if(!opts.length)opts=EXERCISES.filter(x=>x.m===m&&x.name!==item.name&&!x.avoid.some(z=>inj.includes(z)));
  if(!opts.length)return alert('No compatible replacement found.');
  const history=item.swapHistory||[],next=opts.find(x=>!history.includes(x.name))||opts[0];
  item.swapHistory=[...history,next.name];item.name=next.name;item.muscle=m;save();renderTraining();
}
function normalizeSetResults(x){
  if(Array.isArray(x.results))return x.results;
  if(Array.isArray(x.setData))return x.setData;
  if(Number.isFinite(x.reps)){const rir=Number(x.rir)||0;return[{weight:Number(x.weight)||0,reps:Number(x.reps)||0,rir,rpe:10-rir}]};
  return[];
}
function progression(name,min,max,targetRir){
  const logs=lastExerciseLogs(name);if(!logs.length)return'Log each set to establish a baseline.';
  const latest=normalizeSetResults(logs[logs.length-1]).filter(s=>s.reps>0);
  if(!latest.length)return'Log each set to establish a baseline.';
  const previous=logs.length>1?normalizeSetResults(logs[logs.length-2]).filter(s=>s.reps>0):[];
  const allTop=latest.every(s=>s.reps>=max&&s.rir>=targetRir);
  const anyLow=latest.some(s=>s.reps<min||s.rir<=0);
  const total=latest.reduce((n,s)=>n+s.reps,0),prevTotal=previous.reduce((n,s)=>n+s.reps,0);
  if(allTop)return'Next time: add ~2.5–5% load, then work back up through the rep range.';
  if(anyLow)return'Next time: hold or slightly reduce load so every working set lands inside the target range with clean execution.';
  if(previous.length&&total>prevTotal)return'Progressing. Keep the load and continue adding total reps across the sets.';
  return'Hold the load and beat total reps, RIR, or execution quality next session.';
}
function readinessScore(){
  const x=currentLog()||{},sleepGoal=state.profile.sleepGoal||7.5;
  const inputs=[
    x.sleep?clamp(x.sleep/sleepGoal*100,0,110):null,
    x.energy?x.energy*10:null,
    x.recovery?x.recovery*10:null,
    x.soreness?110-x.soreness*10:null,
    x.stress?110-x.stress*10:null
  ].filter(v=>v!=null);
  return inputs.length?Math.round(avg(inputs)):null;
}
function readinessAdvice(){
  const score=readinessScore(),x=currentLog()||{},day=dayType(today());
  if(score==null)return{level:'unknown',score:null,title:'Readiness not logged',text:'Log sleep, energy, recovery, soreness and stress in Log for a coach-adjusted session recommendation.'};
  if(score>=82)return{level:'high',score,title:'High readiness',text:day.type==='training'?'Run the programmed session as written. Push progression where technique stays clean and the prescribed RIR is there.':'Recovery is strong. Keep the planned cardio/rest day instead of adding random lifting volume.'};
  if(score>=65)return{level:'medium',score,title:'Moderate readiness',text:day.type==='training'?'Train, but earn the progression. Keep 1 extra rep in reserve on compounds if warm-ups feel unusually heavy.':'Keep cardio moderate and avoid turning recovery work into a hard session.'};
  return{level:'low',score,title:'Low readiness',text:day.type==='training'?'Use a readiness-adjusted session: keep the main lifts, reduce load ~5–10% or remove 1 accessory set, and stay farther from failure. If pain or illness is present, do not force it.':'Choose full rest or easy active recovery. Today is not the day to chase calorie burn.'};
}
function renderReadiness(){
  if(!el('readinessPanel'))return;const r=readinessAdvice();
  el('readinessPanel').innerHTML='<div class="readinessCard '+r.level+'"><div><span class="kicker">COACH READINESS</span><h3>'+r.title+'</h3><p>'+r.text+'</p></div><div class="readinessScore">'+(r.score==null?'—':r.score)+'</div></div>';
}
function lastPerformance(name){
  const logs=lastExerciseLogs(name);if(!logs.length)return null;const last=logs[logs.length-1],sets=normalizeSetResults(last);return{date:last.date||'',sets};
}
function previousSetText(name,si){
  const p=lastPerformance(name);if(!p||!p.sets[si])return'No previous set';
  const s=p.sets[si];return s.weight+' × '+s.reps+(s.rir!=null?' @ '+s.rir+' RIR':'');
}
function fillPrevious(di,ei){
  const item=state.trainingPlan[di]?.items?.[ei],p=item&&lastPerformance(item.name);if(!p)return alert('No previous performance saved for this exercise.');
  p.sets.slice(0,item.sets).forEach((s,si)=>{if(el('w_'+di+'_'+ei+'_'+si))el('w_'+di+'_'+ei+'_'+si).value=s.weight||'';if(el('r_'+di+'_'+ei+'_'+si))el('r_'+di+'_'+ei+'_'+si).value=s.reps||'';if(el('rir_'+di+'_'+ei+'_'+si))el('rir_'+di+'_'+ei+'_'+si).value=s.rir??'';liveSetCue(di,ei,si)});
}
function liveSetCue(di,ei,si){
  const item=state.trainingPlan[di]?.items?.[ei],out=el('cue_'+di+'_'+ei+'_'+si);if(!item||!out)return;
  const reps=+el('r_'+di+'_'+ei+'_'+si).value||0,rir=el('rir_'+di+'_'+ei+'_'+si).value===''?null:+el('rir_'+di+'_'+ei+'_'+si).value;const dr=el('derived_'+di+'_'+ei+'_'+si);if(dr&&rir!=null)dr.textContent=Math.max(1,10-rir).toFixed(rir%1?1:0);
  if(!reps||rir==null){out.textContent='Log reps + RIR for live coaching.';out.className='setCue';return}
  let msg='',cls='setCue';
  if(rir<0||rir>9){msg='RIR should be 0–9.';cls+=' warn'}
  else if(reps>item.maxReps&&rir>=item.rir){msg='Too easy for this range. Add load next set.';cls+=' up'}
  else if(reps>=item.maxReps&&rir>=item.rir){msg='Top of range with room left. Small load increase is appropriate.';cls+=' up'}
  else if(reps<item.minReps&&rir<=1){msg='Load is too aggressive today. Reduce slightly next set.';cls+=' down'}
  else if(rir<Math.max(0,item.rir-1)){msg='Harder than prescribed. Keep load or reduce slightly; protect later-set quality.';cls+=' warn'}
  else if(rir>item.rir+1){msg='Easier than prescribed. Add reps or a small amount of load.';cls+=' up'}
  else{msg='On target. Keep the load and execute the next set.';cls+=' good'}
  out.textContent=msg;out.className=cls;
}
function changeSetCount(di,ei,delta){
  const item=state.trainingPlan[di]?.items?.[ei];if(!item)return;item.sets=clamp((item.sets||3)+delta,1,8);save();renderTraining();
}
let timerInterval=null;
function startRestTimer(seconds){
  clearInterval(timerInterval);let left=seconds;state.activeTimer={seconds,left};renderFloatingTimer();
  timerInterval=setInterval(()=>{left--;state.activeTimer={seconds,left};renderFloatingTimer();if(left<=0){clearInterval(timerInterval);state.activeTimer=null;renderFloatingTimer();if(navigator.vibrate)navigator.vibrate([150,80,150])}},1000);
}
function stopRestTimer(){clearInterval(timerInterval);state.activeTimer=null;renderFloatingTimer()}
function renderFloatingTimer(){
  let box=el('floatingTimer');if(!box){box=document.createElement('div');box.id='floatingTimer';box.className='floatingTimer';document.body.appendChild(box)}
  if(!state.activeTimer){box.classList.remove('show');box.innerHTML='';return}
  const left=Math.max(0,state.activeTimer.left),m=Math.floor(left/60),s=String(left%60).padStart(2,'0');
  box.innerHTML='<div><small>REST</small><strong>'+m+':'+s+'</strong></div><button onclick="stopRestTimer()">×</button>';box.classList.add('show');
}
function workoutVolume(exercises){return exercises.reduce((sum,e)=>sum+e.results.reduce((s,x)=>s+(x.weight||0)*(x.reps||0),0),0)}
function logWorkout(di){
  const day=state.trainingPlan[di];if(!day)return;
  const exercises=day.items.map((x,ei)=>{
    const results=[];
    for(let si=0;si<x.sets;si++){
      const weight=+el('w_'+di+'_'+ei+'_'+si).value||0,reps=+el('r_'+di+'_'+ei+'_'+si).value||0,rir=el('rir_'+di+'_'+ei+'_'+si).value!==''?+el('rir_'+di+'_'+ei+'_'+si).value:null;
      if(reps>0)results.push({set:si+1,weight,reps,rir,rpe:rir!=null?Math.max(1,10-rir):null});
    }
    return{name:x.name,results};
  }).filter(x=>x.results.length);
  if(!exercises.length)return alert('Enter at least one completed set.');
  const sessionRpe=+el('sessionRpe_'+di).value||null;
  if(!sessionRpe&&!confirm('No session RPE entered. Save the workout anyway?'))return;
  state.workoutLogs.push({date:today(),workout:day.name,sessionRpe,notes:el('sessionNotes_'+di).value||'',volume:workoutVolume(exercises),readiness:readinessScore(),exercises});save();renderTraining();renderCoachChat();alert('Workout logged. PhysiqueOS updated your progression history.');
}
function renderTraining(){
  renderReadiness();
  if(trainingBlocked(state.profile)){el('trainingPlan').innerHTML='<div class="notice dangerNotice">Training automation is paused by the safety screening.</div>';return}
  if(!state.trainingPlan.length){el('trainingPlan').innerHTML='<div class="notice">Generate a program first.</div>';el('workoutHistory').innerHTML='';return}
  el('trainingPlan').innerHTML=state.trainingPlan.map((d,di)=>{
    const exercises=d.items.map((x,ei)=>{
      const targetRpe=Math.max(1,10-(x.rir??3)),prev=lastPerformance(x.name);
      const setRows=Array.from({length:x.sets},(_,si)=>'<div class="setBlock"><div class="setRow coachSetRow"><strong>Set '+(si+1)+'</strong><label>Load<input id="w_'+di+'_'+ei+'_'+si+'" type="number" step=".5" inputmode="decimal" placeholder="'+(prev?.sets?.[si]?.weight??'')+'"></label><label>Reps<input id="r_'+di+'_'+ei+'_'+si+'" type="number" inputmode="numeric" placeholder="'+(prev?.sets?.[si]?.reps??'')+'" oninput="liveSetCue('+di+','+ei+','+si+')"></label><label>RIR<input id="rir_'+di+'_'+ei+'_'+si+'" type="number" min="0" max="9" step=".5" inputmode="decimal" placeholder="'+(prev?.sets?.[si]?.rir??x.rir)+'" oninput="liveSetCue('+di+','+ei+','+si+')"></label><div class="derivedRpe">RPE ≈ <span id="derived_'+di+'_'+ei+'_'+si+'">'+targetRpe+'</span></div></div><div id="cue_'+di+'_'+ei+'_'+si+'" class="setCue">Previous: '+previousSetText(x.name,si)+'</div></div>').join('');
      return'<div class="exerciseCard"><div class="row exerciseTitleRow"><div class="exName"><strong>'+x.name+'</strong><br><small>'+x.sets+' working sets • '+x.minReps+'–'+x.maxReps+' reps • target '+x.rir+' RIR (≈ '+targetRpe+' RPE)</small><br><small>'+progression(x.name,x.minReps,x.maxReps,x.rir)+'</small></div><div class="exerciseActions"><button onclick="fillPrevious('+di+','+ei+')">Last workout</button><button onclick="changeSetCount('+di+','+ei+',-1)">− set</button><button onclick="changeSetCount('+di+','+ei+',1)">+ set</button><button onclick="swapExercise('+di+','+ei+')">Swap</button></div></div><div class="restButtons"><span>Rest timer</span><button onclick="startRestTimer(60)">1:00</button><button onclick="startRestTimer(90)">1:30</button><button onclick="startRestTimer(120)">2:00</button><button onclick="startRestTimer(180)">3:00</button></div><div class="setRows">'+setRows+'</div></div>';
    }).join('');
    const finish='<div class="workoutFinish"><div><span class="kicker">POST-WORKOUT</span><h4>How hard was the whole session?</h4><p>Session RPE is separate from set RIR. Rate the overall workout after you finish.</p></div><label><span>Session RPE</span><input id="sessionRpe_'+di+'" type="number" min="1" max="10" step=".5" placeholder="1–10"></label></div><label class="sessionNote">Coach notes<input id="sessionNotes_'+di+'" placeholder="Performance, pain, pumps, technique, energy, anything unusual..."></label>';
    return'<div class="workout"><div class="workoutHeader"><div><h3>'+d.name+'</h3><span class="pill">'+(d.preferredDay||'Session '+(di+1))+'</span></div></div>'+exercises+finish+'<button class="primary fullBtn" onclick="logWorkout('+di+')">Finish & log '+d.name+'</button></div>';
  }).join('');
  el('workoutHistory').innerHTML=state.workoutLogs.length?[...state.workoutLogs].reverse().slice(0,12).map(w=>'<div class="meal"><div class="row"><strong>'+w.date+' • '+w.workout+'</strong><span class="pill">'+(w.sessionRpe?'RPE '+w.sessionRpe:'Logged')+'</span></div>'+(w.volume?'<div class="muted">Volume '+Math.round(w.volume).toLocaleString()+' • readiness '+(w.readiness??'—')+'</div>':'')+(w.notes?'<div class="muted">'+escapeHtml(w.notes)+'</div>':'')+w.exercises.map(x=>'<div class="historyExercise"><strong>'+x.name+'</strong><div>'+normalizeSetResults(x).map((s,i)=>'Set '+(s.set||i+1)+': '+s.weight+' × '+s.reps+(s.rir!=null?' @ '+s.rir+' RIR':'')).join('<br>')+'</div></div>').join('')+'</div>').join(''):'<div class="notice">No workouts logged yet.</div>';
}

function shiftLogDate(delta){
  const d=new Date(selectedFoodDate()+'T12:00:00');d.setDate(d.getDate()+delta);el('foodLogDate').value=d.toISOString().slice(0,10);renderAll();
}
function setLogDateToday(){el('foodLogDate').value=today();renderAll()}
function filterFoodSelect(){
  if(!el('foodSelect'))return;const q=(el('foodSearch')?.value||'').toLowerCase(),current=el('foodSelect').value;
  const matches=FOOD_DB.map((f,idx)=>({f,idx})).filter(x=>x.f.name.toLowerCase().includes(q));
  el('foodSelect').innerHTML=matches.map(x=>'<option value="'+x.idx+'">'+x.f.name+'</option>').join('');
  if(matches.some(x=>String(x.idx)===current))el('foodSelect').value=current;
}
function selectedFoodDate(){return el('foodLogDate')?.value||today()}
function dayFoodEntries(date=selectedFoodDate()){return state.foodLogs.filter(x=>x.date===date)}
function dayFoodTotals(date=selectedFoodDate()){
  return dayFoodEntries(date).reduce((s,x)=>({cal:s.cal+(+x.calories||0),p:s.p+(+x.protein||0),c:s.c+(+x.carbs||0),f:s.f+(+x.fat||0)}),{cal:0,p:0,c:0,f:0});
}
function syncFoodToDailyLog(date=selectedFoodDate()){
  const total=dayFoodTotals(date),existing=state.logs.find(x=>x.date===date)||{date};
  const next={...existing,calories:Math.round(total.cal)};
  if(state.macro?.calories)next.adherence=Math.round(clamp(100-Math.abs(total.cal-state.macro.calories)/state.macro.calories*100,0,100));
  state.logs=state.logs.filter(x=>x.date!==date);state.logs.push(next);state.logs.sort((x,y)=>x.date.localeCompare(y.date));
}
function setFoodLogMode(mode,btn){
  el('foodDbLogger').classList.toggle('hidden',mode!=='database');el('customFoodLogger').classList.toggle('hidden',mode!=='custom');
  document.querySelectorAll('.foodLogTabs button').forEach(x=>x.classList.remove('active'));if(btn)btn.classList.add('active');
}
function addDatabaseFood(){
  const idx=+el('foodSelect').value,f=FOOD_DB[idx],g=+el('foodGrams').value||0;if(!f||g<=0)return alert('Choose a food and enter an amount.');
  const m=macro(f,g);state.foodLogs.push({id:Date.now()+'_'+Math.random(),date:selectedFoodDate(),meal:el('foodMealSlot').value,name:f.name,grams:g,calories:m.k,protein:m.p,carbs:m.c,fat:m.f,source:'database'});
  syncFoodToDailyLog();save();renderFoodDiary();renderAll();
}
function addCustomFood(){
  const name=el('customFoodName').value.trim()||'Custom entry',cal=+el('customCalories').value||0,p=+el('customProtein').value||0,c=+el('customCarbs').value||0,f=+el('customFat').value||0;
  if(!cal&&!p&&!c&&!f)return alert('Enter calories or macros.');
  const derived=cal||p*4+c*4+f*9;state.foodLogs.push({id:Date.now()+'_'+Math.random(),date:selectedFoodDate(),meal:el('customMealSlot').value,name,calories:derived,protein:p,carbs:c,fat:f,source:'custom'});
  ['customFoodName','customCalories','customProtein','customCarbs','customFat'].forEach(id=>el(id).value='');syncFoodToDailyLog();save();renderFoodDiary();renderAll();
}
function logPlannedMeal(di,mi){
  const m=state.mealPlan[di]?.meals?.[mi];if(!m)return;const names=m.items.map(x=>x.name).join(' + ');
  state.foodLogs.push({id:Date.now()+'_'+Math.random(),date:today(),meal:m.kind==='snack'?'Snack':(['Breakfast','Lunch','Dinner'][mi]||'Meal '+(mi+1)),name:names,calories:m.sum.k,protein:m.sum.p,carbs:m.sum.c,fat:m.sum.f,source:'plan'});
  if(el('foodLogDate'))el('foodLogDate').value=today();syncFoodToDailyLog(today());save();renderAll();alert('Planned meal logged to today.');
}
function deleteFoodLog(id){
  state.foodLogs=state.foodLogs.filter(x=>x.id!==id);syncFoodToDailyLog();save();renderAll();
}
function macroBar(label,value,target,unit='g'){
  const pct=target?clamp(value/target*100,0,125):0,over=value>target;
  return'<div class="macroLine"><div class="row"><span>'+label+'</span><strong>'+Math.round(value)+' / '+Math.round(target||0)+' '+unit+'</strong></div><div class="progressTrack"><span class="'+(over?'over':'')+'" style="width:'+Math.min(100,pct)+'%"></span></div></div>';
}
function copyYesterdayFood(){
  const date=selectedFoodDate(),d=new Date(date+'T12:00:00');d.setDate(d.getDate()-1);const prev=d.toISOString().slice(0,10),entries=dayFoodEntries(prev);
  if(!entries.length)return alert('No food entries found for the previous day.');
  entries.forEach(x=>state.foodLogs.push({...x,id:Date.now()+'_'+Math.random(),date}));
  syncFoodToDailyLog(date);save();renderAll();
}
function clearFoodDay(){
  const date=selectedFoodDate();if(!confirm('Clear all food entries for '+date+'?'))return;
  state.foodLogs=state.foodLogs.filter(x=>x.date!==date);syncFoodToDailyLog(date);save();renderAll();
}
function renderRecentFoods(){
  if(!el('recentFoods'))return;const seen=[],recent=[...state.foodLogs].reverse().filter(x=>x.source==='database').filter(x=>{if(seen.includes(x.name))return false;seen.push(x.name);return true}).slice(0,5);
  el('recentFoods').innerHTML=recent.length?'<div class="recentLabel">Recent</div><div class="recentChips">'+recent.map(x=>'<button onclick="quickAddRecent(\''+escapeHtml(x.name).replace(/&#039;/g,"\\'")+'\')">'+escapeHtml(x.name)+'</button>').join('')+'</div>':'';
}
function quickAddRecent(name){
  const idx=FOOD_DB.findIndex(f=>f.name===name);if(idx<0)return;el('foodSelect').value=String(idx);el('foodGrams').focus();
}
function renderFoodDiary(){
  if(!el('foodDiary'))return;const date=selectedFoodDate(),entries=dayFoodEntries(date),tot=dayFoodTotals(date),m=state.macro;
  el('macroProgress').innerHTML=(m?'<div class="nutritionRings"><div><strong>'+Math.round(tot.cal)+'</strong><small>of '+m.calories+' kcal</small></div><div><strong>'+Math.round(Math.max(0,m.calories-tot.cal))+'</strong><small>remaining</small></div></div>'+macroBar('Protein',tot.p,m.protein)+macroBar('Carbs',tot.c,m.carbs)+macroBar('Fat',tot.f,m.fat):'<div class="notice">Complete your profile to see macro targets.</div>')+'<div class="diaryActions"><button onclick="copyYesterdayFood()">Copy yesterday</button><button onclick="clearFoodDay()">Clear day</button></div>';
  const groups={};entries.forEach(x=>(groups[x.meal]??=[]).push(x));
  el('foodDiary').innerHTML=entries.length?Object.entries(groups).map(([meal,arr])=>'<div class="diaryMeal"><div class="row"><h4>'+meal+'</h4><span>'+Math.round(arr.reduce((s,x)=>s+x.calories,0))+' kcal</span></div>'+arr.map(x=>'<div class="diaryEntry"><div><strong>'+escapeHtml(x.name)+'</strong><small>'+Math.round(x.calories)+' kcal • '+Math.round(x.protein)+'P '+Math.round(x.carbs)+'C '+Math.round(x.fat)+'F'+(x.grams?' • '+Math.round(x.grams)+'g':'')+'</small></div><button onclick="deleteFoodLog(\''+x.id+'\')">×</button></div>').join('')+'</div>').join(''):'<div class="emptyState">Nothing logged for this day yet. Add food above or log a meal from your generated plan.</div>';
}
function loadDailyMetrics(){
  if(!el('dailyWeight'))return;const date=selectedFoodDate(),x=state.logs.find(v=>v.date===date),metric=state.profile.units==='metric';
  el('dailyWeight').value=x?.weight?(metric?(x.weight/2.20462).toFixed(1):x.weight):'';
  el('dailyWaist').value=x?.waist?(metric?(x.waist*2.54).toFixed(1):x.waist):'';
  el('dailySteps').value=x?.steps||'';el('dailyWater').value=x?.water?(metric?(x.water/33.814).toFixed(1):x.water):'';el('dailySleep').value=x?.sleep||'';el('dailyRhr').value=x?.rhr||'';
  el('dailyCalories').value=x?.calories||'';el('dailyAdherence').value=x?.adherence??'';el('dailyHunger').value=x?.hunger||'';el('dailyEnergy').value=x?.energy||'';el('dailyStress').value=x?.stress||'';el('dailyRecovery').value=x?.recovery||'';el('dailyDigestion').value=x?.digestion||'';el('dailySoreness').value=x?.soreness||'';el('dailyNotes').value=x?.notes||'';
  renderDailyMetricSummary(x);
}
function saveDailyMetrics(){
  const date=selectedFoodDate(),existing=state.logs.find(x=>x.date===date)||{date},metric=state.profile.units==='metric',val=id=>el(id).value!==''?+el(id).value:null;
  const next={...existing,date},w=val('dailyWeight'),waist=val('dailyWaist'),water=val('dailyWater');
  if(w!=null)next.weight=metric?w*2.20462:w;if(waist!=null)next.waist=metric?waist/2.54:waist;if(water!=null)next.water=metric?water*33.814:water;
  for(const [id,key] of [['dailySteps','steps'],['dailySleep','sleep'],['dailyRhr','rhr'],['dailyHunger','hunger'],['dailyEnergy','energy'],['dailyStress','stress'],['dailyRecovery','recovery'],['dailyDigestion','digestion'],['dailySoreness','soreness']]){const v=val(id);if(v!=null)next[key]=v}
  next.notes=el('dailyNotes').value;const tot=dayFoodTotals(date),manualCalories=val('dailyCalories'),manualAdherence=val('dailyAdherence');
  if(manualCalories!=null)next.calories=Math.round(manualCalories);else if(tot.cal)next.calories=Math.round(tot.cal);
  if(manualAdherence!=null)next.adherence=clamp(Math.round(manualAdherence),0,100);else if(state.macro?.calories&&next.calories)next.adherence=Math.round(clamp(100-Math.abs(next.calories-state.macro.calories)/state.macro.calories*100,0,100));
  state.logs=state.logs.filter(x=>x.date!==date);state.logs.push(next);state.logs.sort((x,y)=>x.date.localeCompare(y.date));save();renderAll();
}
function renderDailyMetricSummary(x){
  if(!el('dailyMetricSummary'))return;if(!x){el('dailyMetricSummary').innerHTML='<div class="emptyState">No daily metrics saved for this date yet.</div>';return}
  const metric=state.profile.units==='metric',items=[
    ['Weight',x.weight?(metric?(x.weight/2.20462).toFixed(1)+' kg':x.weight.toFixed(1)+' lb'):'—'],
    ['Steps',x.steps?x.steps.toLocaleString():'—'],['Water',x.water?(metric?(x.water/33.814).toFixed(1)+' L':Math.round(x.water)+' oz'):'—'],['Sleep',x.sleep?x.sleep+' h':'—'],['Resting HR',x.rhr?x.rhr+' bpm':'—'],['Calories',x.calories||'—']
  ];
  el('dailyMetricSummary').innerHTML='<div class="summaryGrid">'+items.map(x=>'<div><small>'+x[0]+'</small><strong>'+x[1]+'</strong></div>').join('')+'</div>';
}
function currentLog(){return state.logs.find(x=>x.date===today())||null}
function loadQuickMetrics(){
  const x=currentLog();if(!el('quickSteps'))return;
  const metric=state.profile.units==='metric';
  el('quickSteps').value=x?.steps||'';
  el('quickWater').value=x?.water?(metric?(x.water/33.814).toFixed(1):x.water):'';
  el('quickSleep').value=x?.sleep||'';
  el('quickWeight').value=x?.weight?(metric?(x.weight/2.20462).toFixed(1):x.weight):'';
  el('quickCalories').value=x?.calories||'';
  el('quickAdherence').value=x?.adherence||'';
  el('quickHunger').value=x?.hunger||'';
  el('quickEnergy').value=x?.energy||'';
}
function saveQuickMetrics(){
  const metric=state.profile.units==='metric',existing=currentLog()||{date:today()};
  const val=id=>el(id)&&el(id).value!==''?+el(id).value:null;
  const next={...existing,date:today()};
  const steps=val('quickSteps'),water=val('quickWater'),sleep=val('quickSleep'),weight=val('quickWeight'),calories=val('quickCalories'),adherence=val('quickAdherence'),hunger=val('quickHunger'),energy=val('quickEnergy');
  if(steps!=null)next.steps=steps;if(water!=null)next.water=metric?water*33.814:water;if(sleep!=null)next.sleep=sleep;if(weight!=null)next.weight=metric?weight*2.20462:weight;if(calories!=null)next.calories=calories;if(adherence!=null)next.adherence=adherence;if(hunger!=null)next.hunger=hunger;if(energy!=null)next.energy=energy;
  state.logs=state.logs.filter(x=>x.date!==today());state.logs.push(next);state.logs.sort((x,y)=>x.date.localeCompare(y.date));save();renderAll();
}
function logStreak(){
  if(!state.logs.length)return 0;const dates=new Set(state.logs.map(x=>x.date));let d=new Date(),n=0;
  for(let i=0;i<365;i++){const k=d.toISOString().slice(0,10);if(dates.has(k)){n++;d.setDate(d.getDate()-1)}else if(i===0){d.setDate(d.getDate()-1)}else break}return n;
}
function dailyScore(){
  const x=currentLog();if(!x)return 0;let pts=0,total=0;
  const score=(cond,w)=>{total+=w;if(cond)pts+=w};
  const stepGoal=state.profile.stepGoal||8000,waterGoal=state.profile.waterGoalOz||100;
  score(x.steps>=stepGoal,20);score(x.water>=waterGoal*.9,15);score(x.sleep>=(state.profile.sleepGoal||7.5),20);score(x.adherence>=85,20);score(x.calories&&state.macro&&Math.abs(x.calories-state.macro.calories)<=Math.max(150,state.macro.calories*.08),15);score(x.energy>=6,10);
  return total?Math.round(pts/total*100):0;
}
function saveLog(){
  const metric=state.profile.units==='metric',rawWeight=+el('logWeight').value||null,rawWater=+el('logWater').value||null;
  const measure=id=>{const v=+el(id).value||null;return v?(metric?v/2.54:v):null};
  const x={date:el('logDate').value||today(),weight:rawWeight?(metric?rawWeight*2.20462:rawWeight):null,bodyFat:+el('logBodyFat').value||null,neck:measure('logNeck'),shoulders:measure('logShoulders'),chest:measure('logChest'),waist:measure('logWaist'),hips:measure('logHips'),armL:measure('logArmL'),armR:measure('logArmR'),thighL:measure('logThighL'),thighR:measure('logThighR'),calfL:measure('logCalfL'),calfR:measure('logCalfR'),steps:+el('logSteps').value||null,water:rawWater?(metric?rawWater*33.814:rawWater):null,sleep:+el('logSleep').value||null,calories:+el('logCalories').value||null,adherence:+el('logAdherence').value||null,hunger:+el('logHunger').value||null,energy:+el('logEnergy').value||null,stress:+el('logStress').value||null,recovery:+el('logRecovery').value||null,soreness:+el('logSoreness').value||null,digestion:+el('logDigestion').value||null,performance:el('logPerformance').value,notes:el('logNotes').value};
  state.logs=state.logs.filter(a=>a.date!==x.date);state.logs.push(x);state.logs.sort((a,b)=>a.date.localeCompare(b.date));save();renderAll();
}
function renderHistory(){
  el('history').innerHTML='<table><tr><th>Date</th><th>Weight</th><th>Waist</th><th>Steps</th><th>Sleep</th><th>Adh.</th><th>Hunger</th><th>Recovery</th></tr>'+[...state.logs].reverse().map(x=>'<tr><td>'+x.date+'</td><td>'+(x.weight||'—')+'</td><td>'+(x.waist||'—')+'</td><td>'+(x.steps||'—')+'</td><td>'+(x.sleep||'—')+'</td><td>'+(x.adherence!=null?x.adherence+'%':'—')+'</td><td>'+(x.hunger||'—')+'</td><td>'+(x.recovery||'—')+'</td></tr>').join('')+'</table>';
}
function dateDaysAgo(n){const d=new Date();d.setDate(d.getDate()-n);return d.toISOString().slice(0,10)}
function weeklyWindow(){
  const start=dateDaysAgo(6),logs=state.logs.filter(x=>x.date>=start&&x.date<=today()),foods=state.foodLogs.filter(x=>x.date>=start&&x.date<=today()),workouts=state.workoutLogs.filter(x=>x.date>=start&&x.date<=today()),acts=state.activityLogs.filter(x=>x.date>=start&&x.date<=today());
  return{start,logs,foods,workouts,acts};
}
function renderWeeklyReview(){
  if(!el('weeklyReview'))return;const w=weeklyWindow(),m=state.macro;
  const vals=k=>w.logs.map(x=>x[k]).filter(v=>Number.isFinite(v)&&v>0),foodDays=[...new Set(w.foods.map(x=>x.date))],weights=vals('weight');
  const avgCal=foodDays.length?avg(foodDays.map(d=>dayFoodTotals(d).cal)):0,avgProtein=foodDays.length?avg(foodDays.map(d=>dayFoodTotals(d).p)):0;
  const planned=normalizedTrainingDays().length,trainingPct=planned?Math.min(100,Math.round(w.workouts.length/planned*100)):0;
  const weightChange=weights.length>=2?weights[weights.length-1]-weights[0]:null;
  const cards=[['Avg calories',avgCal?Math.round(avgCal):'—',m?'/ '+m.calories+' target':''],['Avg protein',avgProtein?Math.round(avgProtein)+'g':'—',m?'/ '+m.protein+'g':''],['Avg steps',vals('steps').length?Math.round(avg(vals('steps'))).toLocaleString():'—',''],['Avg sleep',vals('sleep').length?avg(vals('sleep')).toFixed(1)+'h':'—',''],['Training',trainingPct+'%',w.workouts.length+' sessions'],['Cardio',w.acts.reduce((s,x)=>s+x.minutes,0)+' min',w.acts.reduce((s,x)=>s+x.usedKcal,0)+' kcal est.']];
  let insight='Keep collecting consistent daily data.';
  if(w.logs.length>=4){
    if(m&&avgCal&&Math.abs(avgCal-m.calories)>m.calories*.12)insight='Nutrition execution is the biggest signal to tighten before changing the prescription.';
    else if(vals('sleep').length&&avg(vals('sleep'))<(state.profile.sleepGoal||7.5)-.75)insight='Sleep is the clearest recovery constraint this week.';
    else if(trainingPct<70)insight='Training completion is the biggest execution gap this week.';
    else if(weightChange!=null)insight='Execution looks reasonably consistent. Let the multi-week trend, not one weigh-in, drive the next adjustment.';
  }
  el('weeklyReview').innerHTML='<div class="summaryGrid">'+cards.map(x=>'<div><small>'+x[0]+'</small><strong>'+x[1]+'</strong><span>'+x[2]+'</span></div>').join('')+'</div><div class="coachInsight weeklyInsight"><strong>Coach read:</strong> '+insight+'</div>';
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
function normalizedTrainingDays(){
  const raw=(state.profile.preferredDays||'').toLowerCase().split(',').map(x=>x.trim().slice(0,3)).filter(Boolean);
  if(raw.length)return raw;
  const count=state.profile.days||4,defaults={2:['mon','thu'],3:['mon','wed','fri'],4:['mon','tue','thu','fri'],5:['mon','tue','wed','fri','sat'],6:['mon','tue','wed','thu','fri','sat']};
  return defaults[count]||defaults[4];
}
function workoutForDate(dateStr=today()){
  if(!state.trainingPlan.length)return null;
  const d=new Date(dateStr+'T12:00:00'),names=['sun','mon','tue','wed','thu','fri','sat'],day=names[d.getDay()],days=normalizedTrainingDays(),idx=days.indexOf(day);
  return idx>=0?state.trainingPlan[idx%state.trainingPlan.length]:null;
}
function todaysWorkout(){return workoutForDate(today())}
function dayType(dateStr=today()){
  const w=workoutForDate(dateStr);if(w)return{type:'training',title:w.name,workout:w};
  const pref=state.profile.cardioPreference||'walking';
  if(pref==='minimal')return{type:'rest',title:'Rest day'};
  return{type:'cardio',title:'Cardio / recovery day'};
}
function cardioPrescription(){
  const p=state.profile,pref=p.cardioPreference||'walking',goal=p.goal||'maintain',rec=currentLog()?.recovery;
  if(rec&&rec<=4)return{title:'Recovery-biased day',text:'20–30 min easy walking + 10 min mobility. Keep effort conversational and leave fresher than you started.'};
  if(pref==='minimal')return{title:'Full recovery day',text:'No structured cardio required. Hit normal daily steps, hydrate, eat to plan, and prioritize sleep.'};
  if(pref==='intervals')return{title:'Interval option',text:'5 min warm-up, 6–10 rounds of 30–60 sec hard / 90–120 sec easy, then 5 min cool-down. Keep the session brief and stop if mechanics deteriorate.'};
  if(pref==='steady')return{title:'Steady-state option',text:'25–40 min at an easy-to-moderate conversational pace. Walking, bike, elliptical or incline treadmill all work.'};
  if(pref==='mixed')return{title:'Mixed cardio option',text:'Choose either 25–40 min steady state or a short interval session based on recovery. When recovery is mediocre, choose steady state.'};
  return{title:'Walking / steps option',text:'Use your step goal as the base. Add a 20–40 min purposeful walk if you need more movement without creating meaningful recovery cost.'};
}

const ACTIVITY_MET={walk_easy:2.8,walk_brisk:4.3,incline:6.0,run:8.3,bike_easy:4.0,bike_mod:6.8,stairs:8.8,elliptical:5.0,row:7.0,swim:6.0,hiit:9.0,sport:7.0};
function activityEstimate(type,intensity,minutes,date=selectedFoodDate()){
  const log=state.logs.find(x=>x.date===date),lb=log?.weight||state.profile.weight||160,kg=lb/2.20462,base=ACTIVITY_MET[type]||4,mult={easy:.82,moderate:1,hard:1.2}[intensity]||1,met=base*mult;
  return Math.max(0,Math.round(met*3.5*kg/200*(+minutes||0)));
}
function previewActivityBurn(){
  if(!el('activityBurnPreview'))return;const est=activityEstimate(el('activityType').value,el('activityIntensity').value,+el('activityMinutes').value||0);
  el('activityBurnPreview').innerHTML='<div><span>Estimated exercise energy</span><strong>~'+est+' kcal</strong></div><small>MET-based estimate using your most recent bodyweight. Wearable/device data can replace this when available.</small>';
}
function saveActivityLog(){
  const date=selectedFoodDate(),type=el('activityType').value,intensity=el('activityIntensity').value,minutes=+el('activityMinutes').value||0;if(minutes<=0)return alert('Enter activity duration.');
  const estimated=activityEstimate(type,intensity,minutes,date),device=+el('activityDeviceKcal').value||null;
  state.activityLogs.push({id:Date.now()+'_'+Math.random(),date,type,intensity,minutes,avgHr:+el('activityHr').value||null,distance:+el('activityDistance').value||null,estimatedKcal:estimated,deviceKcal:device,usedKcal:device||estimated});
  save();renderAll();
}
function deleteActivityLog(id){state.activityLogs=state.activityLogs.filter(x=>x.id!==id);save();renderAll()}
function activityLabel(type){return({walk_easy:'Easy walk',walk_brisk:'Brisk walk',incline:'Incline treadmill',run:'Running',bike_easy:'Easy cycling',bike_mod:'Moderate cycling',stairs:'Stair climber',elliptical:'Elliptical',row:'Rowing',swim:'Swimming',hiit:'Intervals / HIIT',sport:'Recreational sport'})[type]||type}
function renderActivityHistory(){
  if(!el('activityHistory'))return;const date=selectedFoodDate(),arr=state.activityLogs.filter(x=>x.date===date);
  el('activityHistory').innerHTML=arr.length?'<div class="activityList">'+arr.map(x=>'<div class="diaryEntry"><div><strong>'+activityLabel(x.type)+'</strong><small>'+x.minutes+' min • '+x.intensity+' • '+x.usedKcal+' kcal '+(x.deviceKcal?'(device)':'(estimated)')+(x.avgHr?' • '+x.avgHr+' bpm':'')+'</small></div><button onclick="deleteActivityLog(\''+x.id+'\')">×</button></div>').join('')+'</div>':'<div class="emptyState">No cardio or activity logged for this date.</div>';
}
function logRecoveryProtocol(kind){
  const map={full:['Full rest','Normal steps, no structured cardio, hydration, nutrition and sleep priority.'],active:['Active recovery','20–40 min easy walk or bike at conversational pace.'],mobility:['Mobility reset','10–20 min mobility plus easy walking; no aggressive stretching into pain.'],cardio:['Cardio day',cardioPrescription().text]};
  const [title,text]=map[kind]||map.full,date=selectedFoodDate();
  state.recoveryLogs=state.recoveryLogs.filter(x=>!(x.date===date));state.recoveryLogs.push({id:Date.now()+'_'+Math.random(),date,kind,title,text});save();renderAll();
}
function renderDayRecommendation(){
  if(!el('dayRecommendation'))return;const date=selectedFoodDate(),d=dayType(date),rx=cardioPrescription(),saved=state.recoveryLogs.find(x=>x.date===date);
  const planned=d.type==='training'?'Strength day • '+d.title:(d.type==='rest'?'Rest day':rx.title);
  const body=d.type==='training'?'Complete the programmed lifting session. Optional cardio should stay easy unless it is separately planned.':rx.text;
  el('dayRecommendation').innerHTML='<div class="recommendationHero"><span class="pill">'+d.type.toUpperCase()+'</span><h4>'+planned+'</h4><p>'+body+'</p>'+(saved?'<div class="selectedProtocol">Selected: '+saved.title+'</div>':'')+'</div>';
}
function renderRecoveryHistory(){
  if(!el('recoveryHistory'))return;const date=selectedFoodDate(),x=state.recoveryLogs.find(v=>v.date===date);
  el('recoveryHistory').innerHTML=x?'<div class="notice success"><strong>'+x.title+'</strong><br>'+x.text+'</div>':'';
}
function activityCalories(date=today()){return state.activityLogs.filter(x=>x.date===date).reduce((s,x)=>s+(+x.usedKcal||0),0)}
function renderTodayMetricsSnapshot(){
  if(!el('todayMetricsSnapshot'))return;
  const x=currentLog()||{},metric=state.profile.units==='metric',food=dayFoodTotals(today()),burn=activityCalories(today());
  const calories=x.calories??(food.cal?Math.round(food.cal):null);
  const items=[
    ['Steps',x.steps?x.steps.toLocaleString():'—'],
    ['Water',x.water?(metric?(x.water/33.814).toFixed(1)+' L':Math.round(x.water)+' oz'):'—'],
    ['Sleep',x.sleep?x.sleep+' h':'—'],
    ['Weight',x.weight?(metric?(x.weight/2.20462).toFixed(1)+' kg':x.weight.toFixed(1)+' lb'):'—'],
    ['Waist',x.waist?(metric?(x.waist*2.54).toFixed(1)+' cm':x.waist.toFixed(1)+' in'):'—'],
    ['Calories',calories!=null?Math.round(calories).toLocaleString():'—'],
    ['Protein',food.p?Math.round(food.p)+' g':'—'],
    ['Adherence',x.adherence!=null?Math.round(x.adherence)+'%':'—'],
    ['Cardio burn',burn?burn+' kcal':'—'],
    ['Resting HR',x.rhr?x.rhr+' bpm':'—'],
    ['Hunger',x.hunger?x.hunger+'/10':'—'],
    ['Energy',x.energy?x.energy+'/10':'—'],
    ['Stress',x.stress?x.stress+'/10':'—'],
    ['Recovery',x.recovery?x.recovery+'/10':'—'],
    ['Digestion',x.digestion?x.digestion+'/10':'—'],
    ['Soreness',x.soreness?x.soreness+'/10':'—']
  ];
  el('todayMetricsSnapshot').innerHTML=items.map(v=>'<div class="snapshotMetric"><span>'+v[0]+'</span><strong>'+v[1]+'</strong></div>').join('');
}

function renderToday(){
  if(!state.profile.age){el('todayPanel').innerHTML='<div class="notice">Start with your profile. Once onboarding is complete, this becomes your personalized daily plan.</div>';return}
  const log=currentLog(),day=dayType(today()),work=day.workout,dayIdx=(new Date().getDay()+6)%7,mealDay=state.mealPlan[dayIdx%Math.max(1,state.mealPlan.length)],meal=mealDay?.meals?.[0],food=dayFoodTotals(today()),burn=activityCalories(today()),rx=cardioPrescription();
  const stepGoal=state.profile.stepGoal||8000,waterGoal=state.profile.waterGoalOz||100;
  const stepPct=log?.steps?Math.min(100,Math.round(log.steps/stepGoal*100)):0,waterPct=log?.water?Math.min(100,Math.round(log.water/waterGoal*100)):0;
  const remaining=state.macro?Math.max(0,Math.round(state.macro.calories-food.cal)):null,proteinLeft=state.macro?Math.max(0,Math.round(state.macro.protein-food.p)):null;
  const dayText=day.type==='training'?(work.name+(work.preferredDay?' • '+work.preferredDay:'')):day.type==='rest'?'Recovery / full rest':rx.title;
  el('todayPanel').innerHTML=
  '<div class="todayItem"><div class="row"><strong>Day type</strong><span class="pill">'+day.type.toUpperCase()+'</span></div><div>'+dayText+'</div></div>'+
  '<div class="todayItem"><div class="row"><strong>Nutrition logged</strong><span class="pill">'+Math.round(food.cal)+' kcal</span></div><div>'+(state.macro?(remaining+' kcal remaining • '+proteinLeft+'g protein remaining'):'Complete your profile for targets')+'</div></div>'+
  '<div class="todayItem"><div class="row"><strong>Movement</strong><span>'+stepPct+'%</span></div><div>'+(log?.steps||0).toLocaleString()+' / '+stepGoal.toLocaleString()+' steps'+(burn?' • '+burn+' activity kcal logged':'')+'</div></div>'+
  '<div class="todayItem"><div class="row"><strong>Hydration</strong><span>'+waterPct+'%</span></div><div>'+(state.profile.units==='metric'?((log?.water||0)/33.814).toFixed(1)+' / '+(waterGoal/33.814).toFixed(1)+' L':Math.round(log?.water||0)+' / '+Math.round(waterGoal)+' oz')+'</div></div>'+
  '<div class="todayItem"><strong>Next planned meal</strong><div>'+(meal?meal.items.slice(0,3).map(x=>x.name).join(' • '):'Generate your meal plan')+'</div></div>'+
  '<div class="buttons"><button class="primary" onclick="showTab(\'dailylog\')">Open Log</button>'+(day.type==='training'?'<button onclick="showTab(\'training\')">Open workout</button>':'')+'<button onclick="showTab(\'meals\')">Plan meals</button></div>';
}

function renderAdjustment(){
  const a=getAdjustment();state.pendingAdjustment=a;save();
  const html=a?'<div class="notice warning"><strong>Suggested target change:</strong> '+(a.delta>0?'+':'')+a.delta+' kcal/day → '+a.next+' kcal.<br>'+a.reason+'<div class="buttons"><button class="primary" onclick="applyAdjustment()">Apply adjustment</button></div></div>':'';
  el('adjustmentPanel').innerHTML=html;el('coachAdjustment').innerHTML=html;
}
function renderDashboard(){
  const latest=[...state.logs].reverse().find(x=>x.weight),t=trend();
  el('welcome').textContent=state.profile.name?'Welcome, '+state.profile.name+'.':'Build your baseline';
  const metric=state.profile.units==='metric'; el('dashCalories').textContent=state.macro?state.macro.calories:'—';el('dashWeight').textContent=latest?(metric?(latest.weight/2.20462).toFixed(1)+' kg':latest.weight.toFixed(1)+' lb'):state.profile.weight?(metric?(state.profile.weight/2.20462).toFixed(1)+' kg':state.profile.weight.toFixed(1)+' lb'):'—';el('dashAdherence').textContent=t&&t.adh?t.adh.toFixed(0)+'%':'—';if(el('dashStreak'))el('dashStreak').textContent=logStreak()+'d';if(el('dailyScore'))el('dailyScore').textContent=dailyScore();if(el('timeGreeting')){const h=new Date().getHours();el('timeGreeting').textContent=(h<12?'GOOD MORNING':h<17?'GOOD AFTERNOON':'GOOD EVENING')+' • '+(state.profile.goal==='fatloss'?'FAT LOSS':state.profile.goal==='gain'?'MUSCLE GAIN':state.profile.goal==='recomp'?'RECOMP':'MAINTENANCE')} el('homeCoach').textContent=adaptive();renderGettingStarted();renderToday();renderTodayMetricsSnapshot();renderAdjustment();draw('weightChart','weight','Weight');draw('waistChart','waist','Waist');
}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function coachContext(){
  const t=trend(),x=currentLog(),m=state.macro,p=state.profile,work=todaysWorkout(),food=dayFoodTotals(today()),day=dayType(today()),activityKcal=activityCalories(today());
  return{t,x,m,p,work,food,day,activityKcal,readiness:readinessAdvice(),lastWorkout:state.workoutLogs[state.workoutLogs.length-1]||null};
}
function coachReply(q){
  const {t,x,m,p,work,food,day,activityKcal,readiness,lastWorkout}=coachContext(),s=q.toLowerCase(),name=p.name?(', '+p.name):'';
  if(s.includes('chest pain')||s.includes('faint')||s.includes('passed out')||s.includes('severe pain'))return'I don’t want to coach through that symptom. Stop the session and get appropriate medical evaluation, especially for chest pain, fainting, trouble breathing, or severe/unusual symptoms.';
  if(s.includes('hungry')||s.includes('hunger'))return'Your hunger'+name+' should be interpreted with adherence and recovery, not in isolation. '+(x?.hunger>=8?'You logged high hunger today. ':'')+(t?.sleep&&t.sleep<6.5?'Sleep has also been low, which can amplify appetite. ':'')+'Keep protein on target, use high-volume produce and lean protein, distribute meals around the hardest part of your day, and don’t cut calories further just because hunger is present.';
  if(s.includes('stall')||s.includes('plateau')||s.includes('scale'))return t?'Your current trend is '+Math.abs(t.weekly).toFixed(2)+' lb/week '+(t.weekly>=0?'down':'up')+' with roughly '+(t.adh?t.adh.toFixed(0):'unknown')+'% adherence. '+(t.days<14?'That is not enough time for a confident plateau call yet. Keep collecting data.':t.adh<85?'I would fix execution before changing the prescription.':getAdjustment()?'Your data qualifies for a small target adjustment. Review the recommendation above.':'I would hold the plan right now; the data does not justify a change.'):'I need at least 7–14 days of weight and adherence data before calling a plateau.';
  if(s.includes('water')||s.includes('hydr'))return'Your current hydration target is '+(p.units==='metric'?((p.waterGoalOz||100)/33.814).toFixed(1)+' L':Math.round(p.waterGoalOz||100)+' oz')+' per day. '+(x?.water?'Today you’ve logged '+(p.units==='metric'?(x.water/33.814).toFixed(1)+' L':Math.round(x.water)+' oz')+'. ':'')+'Use that as a practical baseline and increase intake when heat, sweat, or training demand rises.';
  if(s.includes('step')||s.includes('walk'))return'Your daily step target is '+(p.stepGoal||8000).toLocaleString()+'. '+(x?.steps?'You are at '+x.steps.toLocaleString()+' today. ':'')+(x?.steps<(p.stepGoal||8000)?'A short walk after meals is the easiest way to close the gap without adding much fatigue.':'You’ve reached the target today; more is optional, not mandatory.');
  if(s.includes('sore')||s.includes('recovery')||s.includes('fatigue'))return(t?.recovery&&t.recovery<=4?'Recovery has been trending low. ':'')+'Keep the distinction between normal muscular soreness and injury-type pain. For normal soreness, preserve movement, sleep, protein and hydration, and reduce training effort if performance is clearly suppressed. Sharp, unstable, or worsening pain should not be trained through.';
  if(s.includes('cardio'))return day.type==='training'?'Today is a lifting day. Keep optional cardio easy unless it is specifically programmed so it does not compete with the session.':cardioPrescription().title+': '+cardioPrescription().text+(activityKcal?' You have logged about '+activityKcal+' exercise kcal today.':'');
  if(s.includes('rest day')||s.includes('recovery day'))return day.type==='training'?'Today is currently a programmed lifting day. If recovery is unusually poor, use your Recovery score and symptoms to decide whether to reduce volume or move the session rather than forcing it.':cardioPrescription().text;
  if(s.includes('missed')||s.includes('skip')||s.includes('workout'))return work?'Today’s programmed session is '+work.name+'. If you missed a prior session, don’t double up as punishment. Move the highest-priority session forward and continue the sequence; cut low-priority isolation volume before compressing recovery.':'Today is not a programmed lifting day. Use the cardio/recovery recommendation in Log rather than inventing an extra lifting session.';
  if(s.includes('meal')||s.includes('food')||s.includes('macro')||s.includes('protein'))return m?'Your target is '+m.calories+' kcal with '+m.protein+'g protein, '+m.carbs+'g carbs and '+m.fat+'g fat. Today you have logged '+Math.round(food.cal)+' kcal, '+Math.round(food.p)+'g protein, '+Math.round(food.c)+'g carbs and '+Math.round(food.f)+'g fat. '+(food.cal<m.calories?'You have about '+Math.max(0,Math.round(m.calories-food.cal))+' kcal remaining. ':'You are at or above the calorie target, so focus on accuracy rather than forcing extra food.')+' Use the Log tab for actual intake and the Meals tab for planning.':'Complete your profile first so I can coach against an actual calorie and macro target.';
  if(s.includes('travel')||s.includes('restaurant'))return'For travel, simplify the hierarchy: protein first, stay reasonably near calories, keep steps up, hydrate, and choose meals you can estimate. One imperfect travel meal matters far less than turning the entire trip into an untracked stretch.';
  if(s.includes('adjust')||s.includes('calorie')||s.includes('change plan')){const adj=getAdjustment();return adj?'Based on your logged trend and adherence, I’d propose '+(adj.delta>0?'+':'')+adj.delta+' kcal/day, bringing you to about '+adj.next+' kcal. You can apply that recommendation above.':'I would not adjust calories yet. The current data does not meet the beta’s threshold for a justified change.'}
  if(s.includes('ready')||s.includes('readiness')||s.includes('train today'))return readiness.title+': '+readiness.text;
  if(s.includes('rpe')||s.includes('rir'))return'Use RIR set by set because effort drifts as fatigue accumulates. For hypertrophy, the useful question is “how many clean reps were left?” PhysiqueOS converts that to approximate RPE automatically. Then rate one Session RPE after the workout to capture total difficulty. That gives useful detail without making you enter two redundant effort scores for every set.';
  if(s.includes('next set')||s.includes('add weight'))return lastWorkout?'Use the live cue beneath each set. In general: if you hit the top of the rep range at or above target RIR, add a small amount of load; if you fall below the range near failure, reduce slightly; otherwise hold and beat reps or execution.':'Log a baseline workout first and I can anchor progression to your prior sets.';
  if(s.includes('progress')||s.includes('review')||s.includes('how am i doing'))return adaptive();
  return'Here’s how I’d think about it'+name+': anchor the decision to your current target, adherence, weight trend, training performance, steps, sleep, hunger and recovery rather than reacting to one day. Ask me something specific like “Should I change calories?”, “What should I do about hunger?”, “How are my steps?”, or “What should I train today?”';
}
function renderCoachChat(){
  if(!el('coachChat'))return;
  if(!state.coachMessages.length){const r=readinessAdvice();state.coachMessages=[{role:'coach',text:'I’m your PhysiqueOS coach. I’m watching your nutrition, training, recovery, steps, hydration and trends together. '+(r.score!=null?'Today’s readiness is '+r.score+'/100. '+r.text:'Log today’s recovery metrics and I’ll start adjusting the day around you.')}];}
  el('coachChat').innerHTML=state.coachMessages.slice(-40).map(m=>'<div class="chatMsg '+m.role+'"><div class="chatMeta">'+(m.role==='coach'?'PHYSIQUEOS':'YOU')+'</div>'+escapeHtml(m.text)+'</div>').join('');
  el('coachChat').scrollTop=el('coachChat').scrollHeight;save();
}
function sendCoachMessage(){
  const q=el('coachInput').value.trim();if(!q)return;
  state.coachMessages.push({role:'user',text:q});state.coachMessages.push({role:'coach',text:coachReply(q)});el('coachInput').value='';save();renderCoachChat();renderAdjustment();
}
function askCoachPreset(mode){
  const prompts={review:'Analyze my progress and tell me what matters most right now.',hungry:'I’m hungry. What should I do?',stall:'The scale feels stalled. Should we change anything?',missed:'I missed a workout. How should I adjust?',sore:'I’m very sore and recovery feels off. What should I do?',travel:'I’m traveling. How should I handle my plan?'};
  el('coachInput').value=prompts[mode]||prompts.review;sendCoachMessage();
}
function coach(mode){if(el('coachOut'))el('coachOut').textContent=mode==='review'?adaptive():coachReply(mode);renderCoachChat();renderAdjustment();}

function exportData(){const b=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download='physiqueos-'+today()+'.json';a.click();URL.revokeObjectURL(u)}
function importData(inp){const f=inp.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{state=JSON.parse(r.result);state.profile=state.profile||{};state.logs=state.logs||[];state.mealPlan=state.mealPlan||[];state.trainingPlan=state.trainingPlan||[];state.workoutLogs=state.workoutLogs||[];state.coachMessages=state.coachMessages||[];state.foodLogs=state.foodLogs||[];state.activityLogs=state.activityLogs||[];state.recoveryLogs=state.recoveryLogs||[];state.mealPrefs=state.mealPrefs||{meals:Number(state.profile?.meals)||4,snacks:1,distribution:'balanced'};state.dayMealPrefs=state.dayMealPrefs||{};save();renderAll();alert('Backup imported.')}catch(e){alert('Invalid backup.')}};r.readAsText(f)}
function resetAll(){if(confirm('Erase all local coaching data? Progress photos stored in IndexedDB are not erased by this button.')){localStorage.removeItem('physiqueOS');location.reload()}}
function renderAll(){loadProfile();renderDashboard();renderNutrition();renderMeals();renderTraining();renderReadiness();renderHistory();renderFoodDiary();renderRecentFoods();loadDailyMetrics();renderActivityHistory();renderDayRecommendation();renderRecoveryHistory();previewActivityBurn();renderCoachChat();renderAdjustment();renderWeeklyReview();renderPhotoGallery();if(el('logDayScore'))el('logDayScore').textContent=dailyScore()}
renderAll();
if(el('coachInput'))el('coachInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendCoachMessage()}});
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js?v=21').catch(()=>{});