const el=id=>document.getElementById(id);
const localDate=d=>{const x=d||new Date(),y=x.getFullYear(),m=String(x.getMonth()+1).padStart(2,'0'),day=String(x.getDate()).padStart(2,'0');return y+'-'+m+'-'+day};
const today=()=>localDate(new Date());
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const avg=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:0;
const fmt=n=>Number.isFinite(n)?Math.round(n):'—';
function rangeTouched(id,outId){const input=el(id);if(!input)return;input.dataset.empty='0';const out=el(outId);if(out)out.textContent=input.value}
function setRangeValue(id,outId,value,fallback){const input=el(id);if(!input)return;const has=value!==null&&value!==undefined&&value!=='';input.value=has?value:fallback;input.dataset.empty=has?'0':'1';const out=el(outId);if(out)out.textContent=has?input.value:'—'}
function smartVal(id){const x=el(id);if(!x||x.value==='')return null;if(x.type==='range'&&x.dataset.empty==='1')return null;const n=+x.value;return Number.isFinite(n)?n:null}
function syncRangeOutputs(){document.querySelectorAll('input[type="range"]').forEach(x=>{const out=el(x.id+'Out');if(out)out.textContent=x.dataset.empty==='1'?'—':x.value})}
function deviceTimezone(){return Intl.DateTimeFormat().resolvedOptions().timeZone||'Local time'}
function formatLocalClock(d=new Date()){return new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(d)}
function minutesFromTime(t){const [h,m]=(t||'00:00').split(':').map(Number);return h*60+m}
function timeFromMinutes(total){total=((total%1440)+1440)%1440;return String(Math.floor(total/60)).padStart(2,'0')+':'+String(total%60).padStart(2,'0')}
function eventLocalDateTime(date,time){return date.replaceAll('-','')+'T'+(time||'00:00').replace(':','')+'00'}
function addMinutesToTime(date,time,minutes){const d=new Date(date+'T'+time+':00');d.setMinutes(d.getMinutes()+minutes);return {date:localDate(d),time:String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')}}
function escapeICS(v){return String(v||'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;')}
function saveSchedule(){
  state.schedule={wake:el('scheduleWake').value||'07:00',checkin:el('scheduleCheckin').value||'07:15',meal:el('scheduleMeal').value||'08:00',workout:el('scheduleWorkout').value||'17:30',bed:el('scheduleBed').value||'23:00',mealGap:+el('scheduleMealGap').value||4,mode:el('scheduleMode').value||'lifestyle',reminder:+el('scheduleReminder').value||0};
  state.timezone=deviceTimezone();save();renderSchedule();alert('Routine saved in '+state.timezone+'. Calendar exports will use your current device timezone.');
}
function loadSchedule(){
  if(!el('scheduleCheckin'))return;const s=state.schedule||{};
  el('scheduleWake').value=s.wake||'07:00';el('scheduleCheckin').value=s.checkin||'07:15';el('scheduleWorkout').value=s.workout||'17:30';el('scheduleMeal').value=s.meal||'08:00';el('scheduleBed').value=s.bed||'23:00';el('scheduleMealGap').value=String(s.mealGap||4);el('scheduleMode').value=s.mode||'lifestyle';el('scheduleReminder').value=String(s.reminder??15);
}
function scheduleEventsForDate(date){
  const s=state.schedule||{},events=[],day=dayType(date),mealCount=(state.dayMealPrefs?.[(new Date(date+'T12:00:00').getDay()+6)%7]?.meals||state.mealPrefs?.meals||state.profile.meals||4)+(state.dayMealPrefs?.[(new Date(date+'T12:00:00').getDay()+6)%7]?.snacks||state.mealPrefs?.snacks||0);
  events.push({title:'PhysiqueOS check-in',date,time:s.checkin||'08:00',minutes:10,desc:'Log weight/recovery/steps/sleep and review today’s plan.'});
  if(day.type==='training')events.push({title:'PhysiqueOS • '+day.title,date,time:s.workout||'17:30',minutes:state.profile.sessionLength||60,desc:'Planned training session. Open PhysiqueOS for readiness, execution cues and live modifications.'});
  else events.push({title:'PhysiqueOS • '+(day.type==='rest'?'Recovery day':'Cardio / recovery'),date,time:s.workout||'17:30',minutes:30,desc:cardioPrescription().text});
  const start=minutesFromTime(s.meal||'08:00'),gap=(+s.mealGap||4)*60;
  for(let n=0;n<Math.min(6,mealCount);n++)events.push({title:'PhysiqueOS • '+(n<mealCount-(state.mealPrefs?.snacks||0)?'Meal '+(n+1):'Snack'),date,time:timeFromMinutes(start+n*gap),minutes:25,desc:'Planned nutrition touchpoint. Log what you eat or use a saved meal/day template.'});
  return events;
}
function icsEvent(e,index){
  const tz=deviceTimezone(),end=addMinutesToTime(e.date,e.time,e.minutes||30),alarm=+(state.schedule?.reminder||0);
  return ['BEGIN:VEVENT','UID:physiqueos-'+e.date+'-'+index+'-'+Date.now()+'@local','DTSTAMP:'+new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,''),'DTSTART;TZID='+tz+':'+eventLocalDateTime(e.date,e.time),'DTEND;TZID='+tz+':'+eventLocalDateTime(end.date,end.time),'SUMMARY:'+escapeICS(e.title),'DESCRIPTION:'+escapeICS(e.desc),...(alarm?['BEGIN:VALARM','TRIGGER:-PT'+alarm+'M','ACTION:DISPLAY','DESCRIPTION:'+escapeICS(e.title),'END:VALARM']:[]),'END:VEVENT'].join('\r\n');
}
function downloadWeekCalendar(){
  const blocks=[];for(let d=0;d<7;d++){const x=new Date();x.setHours(12,0,0,0);x.setDate(x.getDate()+d);blocks.push(...scheduleEventsForDate(localDate(x)))}
  const body=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//PhysiqueOS//Beta//EN','CALSCALE:GREGORIAN','X-WR-CALNAME:PhysiqueOS Plan',...blocks.map(icsEvent),'END:VCALENDAR'].join('\r\n');
  const blob=new Blob([body],{type:'text/calendar;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='PhysiqueOS_7_Day_Plan.ics';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function addTodayToGoogleCalendar(){
  const events=scheduleEventsForDate(today()),main=events.find(x=>x.title.includes('PhysiqueOS •'))||events[0],end=addMinutesToTime(main.date,main.time,main.minutes||30),tz=deviceTimezone();
  const qs=new URLSearchParams({action:'TEMPLATE',text:main.title,dates:eventLocalDateTime(main.date,main.time)+'/'+eventLocalDateTime(end.date,end.time),details:main.desc||'',ctz:tz});
  window.open('https://calendar.google.com/calendar/render?'+qs.toString(),'_blank');
}
function adherenceTasks(){
  if(!state.profile.age)return[{title:'Complete your profile',detail:'About 3 minutes',tab:'onboarding',done:false}];
  const x=currentLog()||{},food=dayFoodTotals(today()),day=dayType(today()),tasks=[];
  tasks.push({title:'Daily check-in',detail:'Log recovery + body metrics',tab:'dailylog',done:!!(x.sleep||x.energy||x.recovery||x.weight)});
  if(state.macro)tasks.push({title:'Nutrition',detail:Math.round(food.cal)+' / '+state.macro.calories+' kcal • '+Math.round(food.p)+' / '+state.macro.protein+'g protein',tab:'dailylog',done:food.cal>=state.macro.calories*.8&&food.p>=state.macro.protein*.85});
  tasks.push({title:'Steps',detail:(x.steps||0).toLocaleString()+' / '+(state.profile.stepGoal||8000).toLocaleString(),tab:'dailylog',done:(x.steps||0)>=(state.profile.stepGoal||8000)});
  tasks.push({title:'Hydration',detail:(state.profile.units==='metric'?((x.water||0)/33.814).toFixed(1)+' L':Math.round(x.water||0)+' oz'),tab:'dailylog',done:(x.water||0)>=(state.profile.waterGoalOz||100)*.9});
  if(day.type==='training')tasks.push({title:'Training',detail:day.title,tab:'training',done:state.workoutLogs.some(w=>w.date===today()&&w.workout===day.title)});
  else tasks.push({title:'Recovery / activity',detail:day.type==='rest'?'Protect recovery':'Complete planned cardio/recovery',tab:'dailylog',done:state.recoveryLogs.some(r=>r.date===today())||state.activityLogs.some(r=>r.date===today())});
  return tasks;
}
function runwayRecommendation(){
  const s=state.schedule||{},goal=state.profile.goal||'maintain',day=dayType(today()),wake=s.wake||'07:00',bed=s.bed||'23:00';
  const wakeMin=minutesFromTime(wake),bedMin=minutesFromTime(bed),workMin=minutesFromTime(s.workout||'17:30');
  const checkin=timeFromMinutes(wakeMin+15);
  const firstMeal=timeFromMinutes(wakeMin+60);
  let workout=s.workout||'17:30';
  if(s.mode==='performance'){
    const earliest=wakeMin+180, latest=(bedMin>wakeMin?bedMin:bedMin+1440)-180;
    const preferred=Math.min(Math.max(workMin,earliest),latest);
    workout=timeFromMinutes(preferred);
  }
  const preMeal=timeFromMinutes(minutesFromTime(workout)-120);
  const notes=[
    'Check-in is suggested shortly after waking so weight/recovery data is more consistent.',
    'Meal timing is flexible; daily calories, protein and adherence matter more than chasing a perfect clock.',
    day.type==='training'?'A pre-training meal about 1.5–3 hours before lifting is a practical starting window for performance and comfort.':'On a non-lifting day, consistency and recovery take priority over precise meal timing.',
    'Bedtime is treated as a consistency anchor, not a guarantee of sleep quality.'
  ];
  if(goal==='gain')notes.push('For muscle gain, regular protein-containing meals can make it easier to hit intake without oversized meals.');
  if(goal==='fatloss')notes.push('For fat loss, meal timing should mainly reduce hunger and make the calorie target easier to sustain.');
  return{wake,bed,checkin,firstMeal,workout,preMeal,notes};
}
function applyRecommendedRunway(){
  const r=runwayRecommendation();el('scheduleCheckin').value=r.checkin;el('scheduleMeal').value=r.firstMeal;el('scheduleWorkout').value=r.workout;saveSchedule();
}
function dateDiffDays(a,b){return Math.round((new Date(b+'T12:00:00')-new Date(a+'T12:00:00'))/86400000)}
function recentDates(n){const out=[];for(let k=0;k<n;k++){const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-k);out.push(localDate(d))}return out}
function lastLoggedDate(){const dates=[...state.logs.map(x=>x.date),...state.foodLogs.map(x=>x.date),...state.workoutLogs.map(x=>x.date),...state.activityLogs.map(x=>x.date)].filter(Boolean).sort();return dates.length?dates[dates.length-1]:null}
function driftAnalysis(){
  if(!state.profile.age)return{score:0,level:'setup',label:'Set up',signals:[{severity:1,title:'Profile incomplete',detail:'Finish onboarding so drift monitoring has a baseline.'}],action:'Complete your profile first.'};
  const c=state.driftControls||{},dates=recentDates(7),signals=[],minAdh=+c.adherence||85,sens=c.sensitivity||'balanced';
  const logDays=dates.filter(d=>state.logs.some(x=>x.date===d)||state.foodLogs.some(x=>x.date===d)).length;
  const foodDays=dates.filter(d=>state.foodLogs.some(x=>x.date===d)).length;
  const adhVals=state.logs.filter(x=>dates.includes(x.date)&&Number.isFinite(x.adherence)).map(x=>x.adherence),avgAdh=adhVals.length?avg(adhVals):null;
  const planned=Math.max(1,normalizedTrainingDays().length),workouts=state.workoutLogs.filter(x=>dates.includes(x.date)).length,trainingPct=Math.min(100,workouts/planned*100);
  const last=lastLoggedDate(),gap=last?Math.max(0,dateDiffDays(last,today())):99;
  if(gap>=(+c.gap||2))signals.push({severity:gap>=4?3:2,title:'Logging gap',detail:gap+' days since meaningful data was logged.'});
  if(logDays<4)signals.push({severity:logDays<=2?3:2,title:'Check-in consistency slipping',detail:'Only '+logDays+' of the last 7 days have body or nutrition data.'});
  if(foodDays<4)signals.push({severity:foodDays<=2?3:2,title:'Nutrition visibility fading',detail:'Food was logged on '+foodDays+' of the last 7 days.'});
  if(avgAdh!=null&&avgAdh<minAdh)signals.push({severity:avgAdh<minAdh-15?3:2,title:'Adherence below your floor',detail:'Recent adherence averages '+Math.round(avgAdh)+'% vs your '+minAdh+'% floor.'});
  if(trainingPct<70)signals.push({severity:trainingPct<40?3:2,title:'Training completion slipping',detail:workouts+' of ~'+planned+' planned weekly sessions were logged.'});
  const t=trend(),stallDays=+c.stall||21;
  if(t&&t.days>=stallDays){
    const goal=state.profile.goal,weekly=Math.abs(t.weekly||0),stalled=(goal==='fatloss'&&weekly<.15)||(goal==='gain'&&weekly<.1)||(goal==='recomp'&&weekly<.05);
    if(stalled&&avgAdh!=null&&avgAdh>=minAdh)signals.push({severity:2,title:'Progress may be stagnant',detail:'Execution looks adequate, but the multi-week weight trend is barely moving. Review the prescription instead of adding random effort.'});
    else if(stalled&&avgAdh!=null&&avgAdh<minAdh)signals.push({severity:2,title:'Stall looks execution-related',detail:'The trend is flat, but adherence is below target. Tighten execution before changing calories or training.'});
  }
  const rec=state.logs.filter(x=>dates.includes(x.date)&&Number.isFinite(x.recovery)).map(x=>x.recovery),sleep=state.logs.filter(x=>dates.includes(x.date)&&Number.isFinite(x.sleep)).map(x=>x.sleep);
  if(rec.length>=3&&avg(rec)<=4.5)signals.push({severity:2,title:'Recovery trending low',detail:'Average recovery is '+avg(rec).toFixed(1)+'/10. Adding more work is unlikely to fix this.'});
  if(sleep.length>=3&&avg(sleep)<(state.profile.sleepGoal||7.5)-1)signals.push({severity:2,title:'Sleep is becoming a constraint',detail:'Recent sleep averages '+avg(sleep).toFixed(1)+' hours.'});
  let score=signals.reduce((s,x)=>s+x.severity,0);if(sens==='strict')score=Math.ceil(score*1.25);if(sens==='relaxed')score=Math.floor(score*.75);
  const level=score>=7?'high':score>=4?'medium':score>=1?'low':'good',label=level==='high'?'Drifting':level==='medium'?'Watch closely':level==='low'?'Minor drift':'On track';
  let action='Keep the plan boring and repeatable. No intervention needed.';
  if(level==='high')action='Reduce friction immediately: use saved meals, schedule the next workout, complete one check-in today, and use Rescue Mode instead of trying to make up missed work.';
  else if(level==='medium')action='Correct the smallest failing behavior today before changing the program. One clean day is the priority.';
  else if(level==='low')action='One signal is moving the wrong way. Address it today while the correction is still small.';
  return{score,level,label,signals,action};
}
function saveDriftControls(){state.driftControls={sensitivity:el('driftSensitivity').value,adherence:+el('driftAdherence').value||85,gap:+el('driftGap').value||2,stall:+el('driftStall').value||21};save();renderDriftMonitor()}
function loadDriftControls(){if(!el('driftSensitivity'))return;const c=state.driftControls||{};el('driftSensitivity').value=c.sensitivity||'balanced';el('driftAdherence').value=String(c.adherence||85);el('driftGap').value=String(c.gap||2);el('driftStall').value=String(c.stall||21)}
function activateRescueMode(){
  const start=today(),end=new Date();end.setDate(end.getDate()+2);state.rescueMode={start,end:localDate(end)};
  state.driftDismissedUntil=null;save();renderDriftMonitor();renderSchedule();
}
function dismissDrift(){const d=new Date();d.setDate(d.getDate()+3);state.driftDismissedUntil=localDate(d);state.rescueMode=null;save();renderDriftMonitor()}
function rescueEvents(){
  const out=[],s=state.schedule||{},base=new Date();
  for(let n=0;n<3;n++){const d=new Date(base);d.setHours(12,0,0,0);d.setDate(d.getDate()+n);const date=localDate(d);
    out.push({title:'PhysiqueOS Rescue • 5-minute check-in',date,time:s.checkin||'07:15',minutes:10,desc:'Log the minimum useful data. Do not wait for a perfect day.'});
    out.push({title:'PhysiqueOS Rescue • movement',date,time:'12:30',minutes:15,desc:'Short walk or your easiest realistic movement target.'});
    if(dayType(date).type==='training')out.push({title:'PhysiqueOS Rescue • training',date,time:s.workout||'17:30',minutes:Math.min(45,state.profile.sessionLength||45),desc:'Complete the highest-value programmed work. Do not make up missed sessions.'});
    out.push({title:'PhysiqueOS Rescue • tomorrow setup',date,time:timeFromMinutes(minutesFromTime(s.bed||'23:00')-30),minutes:10,desc:'Preload meals, review tomorrow and remove one point of friction.'});
  }return out;
}
function downloadRescueCalendar(){
  if(!state.rescueMode)activateRescueMode();const events=rescueEvents(),body=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//PhysiqueOS//Rescue//EN','CALSCALE:GREGORIAN','X-WR-CALNAME:PhysiqueOS 3-Day Rescue',...events.map(icsEvent),'END:VCALENDAR'].join('\r\n');
  const blob=new Blob([body],{type:'text/calendar;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='PhysiqueOS_3_Day_Rescue.ics';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function renderDriftMonitor(){
  if(!el('driftStatus'))return;const d=driftAnalysis(),dismissed=state.driftDismissedUntil&&state.driftDismissedUntil>=today(),rescue=state.rescueMode&&state.rescueMode.end>=today();
  el('driftStatus').className='driftStatus '+d.level;el('driftStatus').innerHTML='<strong>'+d.label+'</strong><small>risk '+d.score+'</small>';
  el('driftSignals').innerHTML=d.signals.length?d.signals.map(x=>'<div class="driftSignal s'+x.severity+'"><strong>'+escapeHtml(x.title)+'</strong><span>'+escapeHtml(x.detail)+'</span></div>').join(''):'<div class="driftSignal good"><strong>No meaningful drift detected</strong><span>Your recent behaviors are giving the plan a fair chance to work.</span></div>';
  let msg=d.action;
  if(dismissed)msg='Drift alerts are snoozed through '+state.driftDismissedUntil+'. The monitor still analyzes your data in the background.';
  if(rescue)msg='3-day Rescue Mode is active through '+state.rescueMode.end+'. The goal is minimum effective consistency, not catching up.';
  el('driftIntervention').innerHTML='<strong>'+(rescue?'RESCUE MODE':'COACH INTERVENTION')+'</strong><p>'+escapeHtml(msg)+'</p>';
}
function notificationPermission(){return 'Notification' in window?Notification.permission:'unsupported'}
function loadNotificationSettings(){
  const s=state.notificationSettings||{},map={notifyCheckin:'checkin',notifyMeals:'meals',notifyWorkout:'workout',notifySteps:'steps',notifyHydration:'hydration',notifyDrift:'drift',notifyRecovery:'recovery'};
  Object.entries(map).forEach(([id,k])=>{if(el(id))el(id).checked=s[k]!==false});
  if(el('notifyQuietStart'))el('notifyQuietStart').value=s.quietStart||'22:30';
  if(el('notifyQuietEnd'))el('notifyQuietEnd').value=s.quietEnd||'07:00';
  if(el('notifyEscalation'))el('notifyEscalation').value=s.escalation||'balanced';
  renderNotificationStatus();
}
function saveNotificationSettings(){
  state.notificationSettings={checkin:el('notifyCheckin')?.checked!==false,meals:el('notifyMeals')?.checked!==false,workout:el('notifyWorkout')?.checked!==false,steps:el('notifySteps')?.checked!==false,hydration:el('notifyHydration')?.checked!==false,drift:el('notifyDrift')?.checked!==false,recovery:el('notifyRecovery')?.checked!==false,quietStart:el('notifyQuietStart')?.value||'22:30',quietEnd:el('notifyQuietEnd')?.value||'07:00',escalation:el('notifyEscalation')?.value||'balanced'};save();renderNotificationStatus()
}
function inQuietHours(){
  const s=state.notificationSettings||{},now=new Date(),cur=now.getHours()*60+now.getMinutes(),start=minutesFromTime(s.quietStart||'22:30'),end=minutesFromTime(s.quietEnd||'07:00');
  return start>end?(cur>=start||cur<end):(cur>=start&&cur<end);
}
async function enableNotifications(){
  if(!('Notification' in window))return alert('This browser does not support device notifications.');
  const permission=await Notification.requestPermission();renderNotificationStatus();
  if(permission==='granted'){queueNotification('system','Notifications enabled','PhysiqueOS will surface high-value reminders on this device while the beta is active/installed.',{force:true});processSmartReminders()}
}
function notificationKey(type,date=today()){return date+'|'+type}
function alreadyNotified(type,date=today()){return !!state.notificationSent[notificationKey(type,date)]}
function recordNotified(type,date=today()){state.notificationSent[notificationKey(type,date)]=Date.now();save()}
function queueNotification(type,title,body,opts={}){
  const entry={id:Date.now()+'_'+Math.random(),type,title,body,date:today(),time:new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}),read:false,createdAt:Date.now()};
  state.notifications.unshift(entry);state.notifications=state.notifications.slice(0,80);save();renderNotificationCenter();
  if((opts.force||!inQuietHours())&&notificationPermission()==='granted')showDeviceNotification(title,body,type);
}
async function showDeviceNotification(title,body,type){
  try{
    if('serviceWorker' in navigator){const reg=await navigator.serviceWorker.ready;await reg.showNotification(title,{body,tag:'physiqueos-'+type,renotify:false,data:{url:location.href}})}
    else new Notification(title,{body});
  }catch(e){console.warn('Notification failed',e)}
}
function toggleNotificationCenter(){closeAppMenu();el('notificationCenter')?.classList.toggle('hidden');renderNotificationCenter()}
function markAllNotificationsRead(){state.notifications.forEach(x=>x.read=true);save();renderNotificationCenter()}
function renderNotificationStatus(){
  const p=notificationPermission(),txt=p==='granted'?'Device alerts enabled':p==='denied'?'Blocked in browser':p==='unsupported'?'Unsupported here':'Enable notifications';
  if(el('notificationStatusPill')){el('notificationStatusPill').textContent=txt;el('notificationStatusPill').className='notificationStatusPill '+(p==='granted'?'on':p==='denied'?'blocked':'')}
  if(el('notificationPermissionState'))el('notificationPermissionState').innerHTML='<strong>'+txt+'</strong><span>'+(p==='granted'?'Smart reminders are active when the beta is running. Calendar reminders cover closed-app scheduling.':'Enable alerts for in-app/device accountability. Calendar reminders work independently.')+'</span>';
}
function renderNotificationCenter(){
  if(!el('notificationList'))return;renderNotificationStatus();const unread=state.notifications.filter(x=>!x.read).length;
  if(el('notificationBadge')){el('notificationBadge').textContent=unread>9?'9+':unread;el('notificationBadge').classList.toggle('hidden',!unread)}
  el('notificationList').innerHTML=state.notifications.length?state.notifications.slice(0,30).map(x=>'<button class="notificationItem '+(x.read?'':'unread')+'" onclick="readNotification(\''+x.id+'\')"><span class="notificationType">'+escapeHtml(x.type)+'</span><strong>'+escapeHtml(x.title)+'</strong><p>'+escapeHtml(x.body)+'</p><small>'+escapeHtml(x.date)+' • '+escapeHtml(x.time)+'</small></button>').join(''):'<div class="emptyState">No notifications yet. PhysiqueOS will surface the highest-value reminders here.</div>';
}
function readNotification(id){const x=state.notifications.find(n=>n.id===id);if(x)x.read=true;save();renderNotificationCenter()}
function reminderDue(time,windowMin=10){
  if(!time)return false;const now=new Date(),cur=now.getHours()*60+now.getMinutes(),target=minutesFromTime(time),delta=cur-target;return delta>=0&&delta<=windowMin;
}
function hoursBefore(time,hours){return timeFromMinutes(minutesFromTime(time)-hours*60)}
function processSmartReminders(){
  if(!state.profile.age)return;
  const ns=state.notificationSettings||{},sch=state.schedule||{},x=currentLog()||{},food=dayFoodTotals(today()),day=dayType(today()),d=driftAnalysis(),es=ns.escalation||'balanced';
  const send=(type,title,body)=>{if(!alreadyNotified(type)){queueNotification(type,title,body);recordNotified(type)}};
  if(ns.checkin&&reminderDue(sch.checkin||'07:15')&&!x.weight&&!x.sleep&&!x.energy)send('checkin','Quick check-in','Log your morning data now so today’s plan can react to you.');
  if(ns.meals&&reminderDue(sch.meal||'08:00')&&food.cal===0)send('nutrition-start','First nutrition touchpoint','Use a favorite, saved day or quick log so the day starts with almost zero friction.');
  if(ns.workout&&day.type==='training'&&reminderDue(hoursBefore(sch.workout||'17:30',2))&&food.p<(state.macro?.protein||0)*.35)send('preworkout-fuel','Fuel the session','Training is coming up. Get an easy-to-digest protein-containing meal in if it fits your plan and comfort.');
  if(ns.workout&&day.type==='training'&&reminderDue(sch.workout||'17:30')&&!state.workoutLogs.some(w=>w.date===today()&&w.workout===day.title))send('workout','Workout runway is open',day.title+' is planned now. Open Workouts and let PhysiqueOS adapt the session from today’s readiness.');
  const hour=new Date().getHours();
  if(ns.steps&&hour>=15&&(x.steps||0)<(state.profile.stepGoal||8000)*.55)send('steps','Movement is falling behind','You are under 55% of today’s step target. A short walk now is easier than rescuing it late tonight.');
  if(ns.hydration&&hour>=14&&(x.water||0)<(state.profile.waterGoalOz||100)*.45)send('hydration','Hydration check','You are under halfway to your hydration target. Catch up gradually instead of cramming fluids at night.');
  if(ns.recovery&&reminderDue(hoursBefore(sch.bed||'23:00',1)))send('winddown','Protect tomorrow’s performance','Your wind-down window is starting. Make the next hour support the bedtime you chose.');
  if(ns.drift&&d.level==='high')send('drift-high','You are drifting','Multiple behaviors are slipping at once. Start the 3-day Rescue Mode instead of waiting for motivation.');
  else if(ns.drift&&d.level==='medium'&&es!=='gentle')send('drift-medium','Small course correction','PhysiqueOS sees early slippage. Fix the easiest failing behavior today before it compounds.');
  if(ns.drift&&d.signals.some(z=>z.title.toLowerCase().includes('stagnant')))send('stagnation','Progress needs a review','Your multi-week trend may be stagnant. Review execution first, then let the adaptive system decide whether the prescription should change.');
  if(es==='firm'&&d.level!=='good'&&hour>=18){const tasks=adherenceTasks(),next=tasks.find(t=>!t.done);if(next)send('evening-rescue','Finish the highest-value action','Before the day closes: '+next.title+' — '+next.detail+'. Do not try to make up everything at once.')}
}
function renderSchedule(){
  if(!el('timezoneStatus'))return;
  const tz=deviceTimezone();if(state.timezone!==tz){state.timezone=tz;save()}
  el('timezoneStatus').innerHTML='<strong>'+formatLocalClock()+'</strong><small>'+escapeHtml(tz)+'</small>';
  const events=scheduleEventsForDate(today()).sort((a,b)=>a.time.localeCompare(b.time)),rec=runwayRecommendation();
  el('runwayCoachNote').innerHTML='<strong>Your schedule wins.</strong> Coach timing is a recommendation layer, not a command. '+(state.schedule?.mode==='performance'?'Performance-biased mode nudges timing toward repeatable recovery and pre-training fueling windows.':'Lifestyle-first mode preserves your preferred times unless there is a clear friction point.');
  el('dailyRunway').innerHTML=events.map(e=>{
    const kind=e.title.includes('check-in')?'checkin':e.title.includes('Meal')||e.title.includes('Snack')?'meal':e.title.includes('Recovery')||e.title.includes('Cardio')?'workout':'workout';
    const suggested=kind==='checkin'?rec.checkin:kind==='workout'?rec.workout:null;
    return '<div class="runwayItem"><span>'+e.time+'</span><div><strong>'+escapeHtml(e.title.replace('PhysiqueOS • ',''))+'</strong><small>'+escapeHtml(e.desc)+'</small>'+(suggested&&suggested!==e.time?'<em>Coach window: around '+suggested+'</em>':'')+'</div></div>';
  }).join('');
  const tasks=adherenceTasks(),next=tasks.find(x=>!x.done);
  el('adherenceNudge').innerHTML=next?'<div class="nudgeHero"><span class="pulseDot"></span><div><strong>'+escapeHtml(next.title)+'</strong><p>'+escapeHtml(next.detail)+'</p></div></div><button class="primary fullBtn" onclick="showTab(\''+next.tab+'\')">Do this now</button>':'<div class="nudgeComplete"><strong>100% of today’s core actions are covered.</strong><p>Keep the rest of the day simple. Consistency beats adding unnecessary work.</p></div>';
  el('runwayRecommendations').innerHTML='<strong>Coach timing notes</strong><div>'+rec.notes.slice(0,3).map(x=>'<p>• '+escapeHtml(x)+'</p>').join('')+'</div>';
}

let state=JSON.parse(localStorage.getItem('physiqueOS')||'null')||{};
state.profile=state.profile||{};
state.macro=state.macro||null;
state.logs=Array.isArray(state.logs)?state.logs:[];
state.mealPlan=Array.isArray(state.mealPlan)?state.mealPlan:[];
state.trainingPlan=Array.isArray(state.trainingPlan)?state.trainingPlan:[];
state.workoutLogs=Array.isArray(state.workoutLogs)?state.workoutLogs:[];
state.pendingAdjustment=state.pendingAdjustment||null;
state.macroAutomation=state.macroAutomation||{enabled:true,lastReview:null,lastAdjustment:null,history:[]};
state.macroAutomation.history=Array.isArray(state.macroAutomation.history)?state.macroAutomation.history:[];
state.coachMessages=Array.isArray(state.coachMessages)?state.coachMessages:[];
state.foodLogs=Array.isArray(state.foodLogs)?state.foodLogs:[];
state.activityLogs=Array.isArray(state.activityLogs)?state.activityLogs:[];
state.recoveryLogs=Array.isArray(state.recoveryLogs)?state.recoveryLogs:[];
state.mealPrefs=state.mealPrefs||{meals:Number(state.profile.meals)||4,snacks:1,distribution:'balanced'};
state.dayMealPrefs=state.dayMealPrefs||{};
state.activeTimer=state.activeTimer||null;
state.trainingFlags=Array.isArray(state.trainingFlags)?state.trainingFlags:[];
state.recoveryPlan=state.recoveryPlan||null;
state.trainingDrafts=state.trainingDrafts||{};
state.favoriteFoods=Array.isArray(state.favoriteFoods)?state.favoriteFoods:[];
state.foodDayTemplates=Array.isArray(state.foodDayTemplates)?state.foodDayTemplates:[];
state.foodWeekTemplates=Array.isArray(state.foodWeekTemplates)?state.foodWeekTemplates:[];
state.workoutFavorites=Array.isArray(state.workoutFavorites)?state.workoutFavorites:[];
state.schedule=state.schedule||{wake:'07:00',checkin:'07:15',meal:'08:00',workout:'17:30',bed:'23:00',mealGap:4,mode:'lifestyle',reminder:15};
state.timezone=Intl.DateTimeFormat().resolvedOptions().timeZone||'Local time';
state.driftControls=state.driftControls||{sensitivity:'balanced',adherence:85,gap:2,stall:21};
state.rescueMode=state.rescueMode||null;
state.driftDismissedUntil=state.driftDismissedUntil||null;
state.notificationSettings=state.notificationSettings||{checkin:true,meals:true,workout:true,steps:true,hydration:true,drift:true,recovery:true,quietStart:'22:30',quietEnd:'07:00',escalation:'balanced'};
state.notifications=Array.isArray(state.notifications)?state.notifications:[];
state.notificationSent=state.notificationSent||{};

const FAQ_LIBRARY={
'Getting started':[
'What should I focus on first?','How do I use PhysiqueOS every day?','How often should I weigh myself?','When should I take progress photos?','How often should I update measurements?','How accurate are my starting calorie targets?'
],
'Calories & macros':[
'Should I change my calories?','How much protein do I need?','Should I eat back cardio calories?','What if I go over calories today?','What if I am under calories today?','Do I need to hit macros exactly?','Should calories change on rest days?','Should I carb cycle?','Why are my macros changing?','When should we increase calories?','When should we reduce calories?'
],
'Fat loss & scale':[
'Why did my weight go up overnight?','Is my fat loss too slow?','Is my fat loss too fast?','The scale stalled. What should I do?','How long is a real plateau?','Why is my waist changing but weight is not?','Should I add cardio or cut food?','What rate of weight loss should I target?'
],
'Muscle gain & recomp':[
'Am I gaining too fast?','How do I know if I am building muscle?','Should I be in a surplus?','Can I build muscle while losing fat?','When should I move from a cut to maintenance?','When should I start a gaining phase?'
],
'Meals & hunger':[
'I am hungry. What should I do?','What should I eat before training?','What should I eat after training?','Can I move calories between meals?','Can I skip breakfast?','Can I eat fewer meals today?','Can I add a snack?','How do I handle a restaurant meal?','What if I cannot prep food?','How do I handle cravings?','What are good high-volume foods?'
],
'Training & progression':[
'Am I ready to train today?','Should I add weight next set?','Should I add reps or load?','What does RIR mean?','What does session RPE mean?','How close to failure should I train?','How long should I rest between sets?','Should I add another set?','Should I remove a set?','Why did my performance drop today?','Should I deload?','How do I know if I am progressing?','Can I swap this exercise?','What should I do if equipment is taken?','How should I execute this exercise?','What should I feel during this movement?','Why is this exercise in my program?'
],
'Pain, tweaks & modifications':[
'I felt a tweak during my workout. What should I do?','An exercise hurts. Should I stop?','Can you modify today’s workout around pain?','Should I reduce range of motion?','Should I reduce load because something feels off?','How do I tell soreness from a possible injury?','What should I log when something hurts?','Should I train around an injury?','When should I get an injury evaluated?'
],
'Cardio & steps':[
'How much cardio should I do?','Should I do cardio today?','What type of cardio is best for my goal?','How many steps should I get?','Can I replace steps with cardio?','Should I do cardio before or after lifting?','Am I doing too much cardio?'
],
'Recovery & sleep':[
'I am very sore. Should I train?','My recovery is poor. What should I change?','How much sleep do I need?','What if I slept badly last night?','Should today be a rest day?','What should I do on an active recovery day?','My stress is high. Should training change?'
],
'Travel & lifestyle':[
'How do I stay on plan while traveling?','How do I handle alcohol or a night out?','What if I miss a workout?','What if I miss several days?','How do I handle holidays?','How do I handle a busy work week?'
],
'Progress & check-ins':[
'Analyze my progress.','What is the biggest thing holding me back?','Am I actually adherent?','What should change this week?','Which metric matters most right now?','Why are my photos improving but the scale is not?','When should I update my goal?'
]
};
function renderFaqQuestions(){
  if(!el('faqCategory')||!el('faqQuestion'))return;
  const cats=Object.keys(FAQ_LIBRARY);if(!el('faqCategory').options.length)el('faqCategory').innerHTML=cats.map(x=>'<option>'+x+'</option>').join('');
  const cat=el('faqCategory').value||cats[0];el('faqQuestion').innerHTML=(FAQ_LIBRARY[cat]||[]).map(q=>'<option value="'+escapeHtml(q)+'">'+escapeHtml(q)+'</option>').join('');
}
function askFaqQuestion(){
  const q=el('faqQuestion')?.value;if(!q)return;el('coachInput').value=q;sendCoachMessage();
}
function save(){localStorage.setItem('physiqueOS',JSON.stringify(state))}
function toggleAppMenu(force){
  const menu=el('appMenu'),back=el('appMenuBackdrop');if(!menu||!back)return;
  const open=typeof force==='boolean'?force:menu.classList.contains('hidden');
  menu.classList.toggle('hidden',!open);back.classList.toggle('hidden',!open);
  document.body.classList.toggle('menuOpen',open);
  const trigger=el('menuTrigger');if(trigger)trigger.setAttribute('aria-expanded',open?'true':'false');
  const mobileTrigger=el('mobileMenuTrigger');if(mobileTrigger)mobileTrigger.setAttribute('aria-expanded',open?'true':'false');
  if(open){if(el('notificationCenter'))el('notificationCenter').classList.add('hidden');renderMenuProfile();}
}
function closeAppMenu(){toggleAppMenu(false)}
function menuGo(id){closeAppMenu();showTab(id)}
function renderMenuProfile(){
  if(!el('menuProfileName'))return;
  const p=state.profile||{},goal=p.goal==='fatloss'?'Fat loss':p.goal==='gain'?'Muscle gain':p.goal==='recomp'?'Recomposition':p.goal==='maintain'?'Maintenance':'Set your goal';
  el('menuProfileName').textContent=p.name||'Your profile';
  el('menuProfileMeta').textContent=(p.age?p.age+' • ':'')+goal;
  document.querySelectorAll('[data-menu-tab]').forEach(x=>x.classList.toggle('active',x.dataset.menuTab===document.body.dataset.view));
  renderProfilePhoto();
}
function showTab(id){
  document.body.dataset.view=id;
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('active',x.dataset.tab===id));
  document.querySelectorAll('[data-menu-tab]').forEach(x=>x.classList.toggle('active',x.dataset.menuTab===id));
  const target=document.querySelector('section#'+id+'.tab'); if(target) target.classList.add('active');
  renderAll(); if(window.innerWidth<900)window.scrollTo({top:0,behavior:'smooth'});
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
  state.macroAutomation=state.macroAutomation||{enabled:true,lastReview:null,lastAdjustment:null,history:[]};
  state.macroAutomation.lastReview=null;
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
function logsBetween(start,end){
  return state.logs.filter(x=>x.date>=start&&x.date<=end);
}
function averageWeight(logs){
  const v=logs.map(x=>x.weight).filter(x=>Number.isFinite(x)&&x>0);return v.length?avg(v):null;
}
function latestBodyStats(){
  const weights=state.logs.filter(x=>Number.isFinite(x.weight)&&x.weight>0).sort((x,y)=>x.date.localeCompare(y.date));
  const bfs=state.logs.filter(x=>Number.isFinite(x.bodyFat)&&x.bodyFat>0).sort((x,y)=>x.date.localeCompare(y.date));
  const recent=weights.filter(x=>x.date>=dateDaysAgo(6));
  return{
    weight:recent.length?avg(recent.map(x=>x.weight)):(weights.length?weights[weights.length-1].weight:state.profile.weight),
    bodyFat:bfs.length?bfs[bfs.length-1].bodyFat:(state.profile.bf||null)
  };
}
function rollingTrend(){
  const thisStart=dateDaysAgo(6),prevStart=dateDaysAgo(13),prevEnd=dateDaysAgo(7);
  const recent=logsBetween(thisStart,today()),prior=logsBetween(prevStart,prevEnd);
  const recentW=averageWeight(recent),priorW=averageWeight(prior);
  const vals=(logs,k)=>logs.map(x=>x[k]).filter(x=>Number.isFinite(x));
  const adhVals=vals(recent,'adherence'),steps=vals(recent,'steps'),sleep=vals(recent,'sleep'),hunger=vals(recent,'hunger'),recovery=vals(recent,'recovery');
  if(recentW==null||priorW==null)return null;
  const weeklyChange=recentW-priorW;
  const pct=priorW?weeklyChange/priorW*100:0;
  return{
    recentWeight:recentW,priorWeight:priorW,weeklyChange,pct,
    recentWeightDays:recent.filter(x=>Number.isFinite(x.weight)&&x.weight>0).length,
    priorWeightDays:prior.filter(x=>Number.isFinite(x.weight)&&x.weight>0).length,
    adherence:adhVals.length?avg(adhVals):null,
    steps:steps.length?avg(steps):null,
    sleep:sleep.length?avg(sleep):null,
    hunger:hunger.length?avg(hunger):null,
    recovery:recovery.length?avg(recovery):null
  };
}
function trend(){
  const t=rollingTrend();
  if(t)return{weekly:-t.weeklyChange,pct:-t.pct,days:14,adh:t.adherence,steps:t.steps,sleep:t.sleep,hunger:t.hunger,recovery:t.recovery};
  const a=state.logs.filter(x=>x.weight).sort((x,y)=>x.date.localeCompare(y.date));if(a.length<2)return null;
  const first=a[0],last=a[a.length-1],days=Math.max(1,(new Date(last.date)-new Date(first.date))/86400000),weekly=(first.weight-last.weight)/(days/7);
  const recent=state.logs.slice(-7),vals=k=>recent.map(x=>x[k]).filter(x=>Number.isFinite(x));
  return{weekly,pct:weekly/first.weight*100,days,adh:avg(vals('adherence')),steps:avg(vals('steps')),sleep:avg(vals('sleep')),hunger:avg(vals('hunger')),energy:avg(vals('energy')),stress:avg(vals('stress')),recovery:avg(vals('recovery')),soreness:avg(vals('soreness'))};
}
function macroTargetsForCalories(calories,bodyStats=latestBodyStats()){
  const p=state.profile,weight=bodyStats.weight||p.weight,goalWeight=p.goalWeight||weight;
  let protein=Math.round(Math.max(goalWeight*.9,Math.min(weight,goalWeight)*1.0));
  if(bodyStats.bodyFat){const lbm=weight*(1-bodyStats.bodyFat/100);protein=Math.max(protein,Math.round(lbm*.9))}
  let fat=Math.round(Math.max(goalWeight*.3,calories*.22/9));
  let carbs=Math.max(40,Math.round((calories-protein*4-fat*9)/4));
  const actual=Math.round(protein*4+carbs*4+fat*9);
  return{protein,fat,carbs,calories:actual};
}
function reanchorMacroBodyStats(){
  if(!state.macro||!state.profile.age)return false;
  const stats=latestBodyStats(),working={...state.profile,weight:stats.weight||state.profile.weight,bf:stats.bodyFat||state.profile.bf};
  const fresh=calcMacro(working),targets=macroTargetsForCalories(state.macro.calories,stats);
  const changed=state.macro.protein!==targets.protein||state.macro.fat!==targets.fat||state.macro.carbs!==targets.carbs||state.macro.bmr!==fresh.bmr||state.macro.tdee!==fresh.tdee;
  state.macro.bmr=fresh.bmr;state.macro.tdee=fresh.tdee;state.macro.floor=fresh.floor;
  state.macro.protein=targets.protein;state.macro.fat=targets.fat;state.macro.carbs=targets.carbs;state.macro.calories=targets.calories;
  return changed;
}
function getAdjustment(){
  if(!state.macro||safetyBlockers(state.profile).length)return null;
  const t=rollingTrend(),p=state.profile;
  if(!t||t.recentWeightDays<4||t.priorWeightDays<4||t.adherence==null||t.adherence<85)return null;
  let delta=0,reason='';
  const changePct=t.pct; // negative = loss, positive = gain
  if(p.goal==='fatloss'){
    const target={conservative:-.5,moderate:-.75,aggressive:-1}[p.aggr]||-.75;
    if(changePct>target+.25){delta=-125;reason='Two-week weight averages are moving slower than the selected fat-loss pace with strong adherence.'}
    if(changePct<target-.35||(t.hunger!=null&&t.hunger>=8)||(t.recovery!=null&&t.recovery<=4)){delta=125;reason='Weight loss or recovery signals suggest the current deficit may be more aggressive than needed.'}
  }else if(p.goal==='gain'){
    const target={conservative:.1,moderate:.25,aggressive:.4}[p.aggr]||.25;
    if(changePct<target-.1){delta=125;reason='Two-week weight averages are rising slower than the selected gaining pace with strong adherence.'}
    if(changePct>target+.25){delta=-100;reason='Weight is rising faster than the selected gaining pace.'}
  }else if(p.goal==='recomp'){
    if(Math.abs(changePct)<.15&&t.adherence>=90)return null;
  }
  if(!delta)return null;
  const next=Math.max(state.macro.floor||0,state.macro.calories+delta);
  if(next===state.macro.calories)return null;
  return{delta:next-state.macro.calories,next,reason,trend:t};
}
function applyMacroCalories(nextCalories,reason,source='automatic'){
  const before={calories:state.macro.calories,protein:state.macro.protein,carbs:state.macro.carbs,fat:state.macro.fat};
  const stats=latestBodyStats(),targets=macroTargetsForCalories(nextCalories,stats);
  state.macro.protein=targets.protein;state.macro.carbs=targets.carbs;state.macro.fat=targets.fat;state.macro.calories=targets.calories;
  reanchorMacroBodyStats();
  const after={calories:state.macro.calories,protein:state.macro.protein,carbs:state.macro.carbs,fat:state.macro.fat};
  state.macroAutomation.history.unshift({date:today(),source,reason,before,after,weight:stats.weight,bodyFat:stats.bodyFat||null});
  state.macroAutomation.history=state.macroAutomation.history.slice(0,20);
  state.macroAutomation.lastAdjustment=today();state.pendingAdjustment=null;
  state.mealPlan=[];state.mealPlanSchema=3;
}
function autoMacroReview(force=false){
  if(!state.macroAutomation?.enabled||!state.macro||safetyBlockers(state.profile).length)return false;
  const last=state.macroAutomation.lastReview;
  if(!force&&last&&dateDiffDays(last,today())<7)return false;
  state.macroAutomation.lastReview=today();
  const bodyChanged=reanchorMacroBodyStats(),adj=getAdjustment();
  if(adj){
    const lastAdj=state.macroAutomation.lastAdjustment;
    if(force||!lastAdj||dateDiffDays(lastAdj,today())>=7)applyMacroCalories(adj.next,adj.reason,'automatic');
  }else if(bodyChanged){
    state.mealPlan=[];state.mealPlanSchema=3;
  }
  save();return !!adj||bodyChanged;
}
function applyAdjustment(){
  const adj=getAdjustment()||state.pendingAdjustment;if(!adj)return alert('No eligible adjustment right now.');
  applyMacroCalories(adj.next,adj.reason||'Manual adaptive review','manual');save();renderAll();alert('New calories and macros applied from your progress data. Regenerate the meal plan to match.');
}
function adaptive(){
  const blockers=safetyBlockers(state.profile);if(blockers.length)return blockers.join(' ');
  if(!state.macro)return'Complete onboarding first.';
  const t=rollingTrend();if(!t)return'Starting target: '+state.macro.calories+' kcal. Log weight and adherence consistently for about 2 weeks so automatic adjustments can use trend data.';
  let s='7-day average weight: '+t.recentWeight.toFixed(1)+' lb vs '+t.priorWeight.toFixed(1)+' lb the week before. ';
  s+='Recent adherence: '+(t.adherence!=null?t.adherence.toFixed(0):'—')+'%. ';
  if(t.adherence!=null&&t.adherence<85)s+='Targets stay stable until execution is consistent enough to judge the prescription. ';
  else s+=getAdjustment()?'The automatic review has identified an eligible target adjustment. ':'Current progress is within the adjustment guardrails. ';
  return s;
}
function renderMacroAutomation(){
  if(!el('macroAutomationPanel'))return;
  const auto=state.macroAutomation||{},last=auto.history?.[0],t=rollingTrend(),enabled=auto.enabled;
  let deltaText='Learning',deltaSub='Collecting trend data';
  if(t&&t.adherence!=null){deltaText='↑ '+Math.max(0,Math.round(t.adherence-80))+'%';deltaSub=t.adherence>=85?'Ahead of target this week':'Building consistency'}
  el('macroAutomationPanel').innerHTML=
    '<div class="macroAutoVisual"><div class="macroAutoRing">↻</div><div><span class="kicker">ADAPTIVE MACROS</span><strong>'+(enabled?'Automatically adapting<br>to your progress.':'Automatic adjustments paused.')+'</strong><small>Your calorie and macro targets update based on your weight trends, activity and adherence.</small></div></div>'+
    '<div class="macroAutoTrend"><div class="macroBars"><i></i><i></i><i></i><i></i><i></i><i></i></div><div class="macroTrendMeta"><b>'+deltaText+'</b><span>'+deltaSub+'</span></div></div>'+
    '<label class="autoToggle macroAutoToggle"><input type="checkbox" '+(enabled?'checked':'')+' onchange="toggleMacroAutomation(this.checked)"><span></span></label>'+
    (last?'<div class="macroLastChange">Last adjustment '+escapeHtml(last.date)+' • '+last.before.calories+' → '+last.after.calories+' kcal</div>':'');
}
function dateDaysFrom(date,n){const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+n);return localDate(d)}
function toggleMacroAutomation(on){state.macroAutomation.enabled=!!on;save();if(on)autoMacroReview(true);renderNutrition();renderMacroAutomation()}
function renderNutrition(){
  const blockers=safetyBlockers(state.profile),out=el('nutritionOut'),content=el('nutritionPremiumContent');
  if(!blockers.length&&state.macro)autoMacroReview();
  if(blockers.length){out.innerHTML='<div class="notice dangerNotice"><strong>Automation paused.</strong><br>'+blockers.join('<br>')+'</div>';if(content)content.classList.add('hidden');return}
  if(!state.macro){out.innerHTML='<div class="notice">Complete onboarding first.</div>';if(content)content.classList.add('hidden');return}
  out.innerHTML='';if(content)content.classList.remove('hidden');
  const m=state.macro,total=m.protein*4+m.carbs*4+m.fat*9;
  if(el('nutritionHeroCalories'))el('nutritionHeroCalories').textContent=m.calories;
  if(el('nutritionBmr'))el('nutritionBmr').textContent=m.bmr;
  if(el('nutritionTdee'))el('nutritionTdee').textContent=m.tdee;
  if(el('nutritionCalories'))el('nutritionCalories').textContent=m.calories;
  const vals=[['nutritionProtein','nutritionProteinMeta','nutritionProteinBar',m.protein,m.protein*4],['nutritionCarbs','nutritionCarbsMeta','nutritionCarbsBar',m.carbs,m.carbs*4],['nutritionFat','nutritionFatMeta','nutritionFatBar',m.fat,m.fat*9]];
  vals.forEach(([id,meta,bar,g,k])=>{if(el(id))el(id).textContent=g+'g';if(el(meta))el(meta).textContent=Math.round(k/total*100)+'% • '+Math.round(k)+' kcal';if(el(bar))el(bar).style.width=Math.round(k/total*100)+'%'});
  const t=rollingTrend();if(el('nutritionTrendBadge'))el('nutritionTrendBadge').innerHTML=t&&t.adherence!=null?'↑ '+Math.max(1,Math.round(t.adherence-80))+'%<small>vs. last week</small>':'Adaptive<small>learning</small>';
  if(el('nutritionBudget'))el('nutritionBudget').textContent=state.profile.budget?'$'+Math.round(state.profile.budget)+'/wk':'No limit set';
  if(el('nutritionMealPattern'))el('nutritionMealPattern').textContent=(state.mealPrefs?.meals||state.profile.meals||4)+' meals'+((state.mealPrefs?.snacks||0)?' + '+state.mealPrefs.snacks+' snack'+(state.mealPrefs.snacks===1?'':'s'):'');
  const diet=(state.profile.diet||'').trim(),priority=state.profile.groceryPriority||'balanced';
  if(el('nutritionPreference'))el('nutritionPreference').textContent=diet||'Balanced';
  if(el('nutritionPreferenceMeta'))el('nutritionPreferenceMeta').textContent=(priority==='budget'?'Budget-conscious':priority==='premium'?'Premium ingredients':'Flexible')+' • personalized';
  renderMacroAutomation();
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
function macro(f,g){
  const q=g/100,p=(f.p||0)*q,c=(f.c||0)*q,fat=(f.f||0)*q;
  return{p,c,f:fat,k:p*4+c*4+fat*9};
}
function itemMacro(x){
  const f=FOOD_DB.find(z=>z.name===x.name);
  if(f)return macro(f,x.g);
  if(x.macrosPer100)return macro({p:+x.macrosPer100.p||0,c:+x.macrosPer100.c||0,f:+x.macrosPer100.f||0},x.g);
  return{p:0,c:0,f:0,k:0};
}
function sumMeal(items){
  const total=items.map(itemMacro).reduce((a,x)=>({p:a.p+x.p,c:a.c+x.c,f:a.f+x.f,k:a.k+x.k}),{p:0,c:0,f:0,k:0});
  total.k=total.p*4+total.c*4+total.f*9;
  return total;
}
function targetMealMacros(share){const m=state.macro;return{p:m.protein*share,c:m.carbs*share,f:m.fat*share,k:m.calories*share}}
function solve3x3(A,b){
  const m=A.map((r,i)=>[...r,b[i]]);
  for(let col=0;col<3;col++){
    let pivot=col;for(let r=col+1;r<3;r++)if(Math.abs(m[r][col])>Math.abs(m[pivot][col]))pivot=r;
    if(Math.abs(m[pivot][col])<1e-8)return null;
    [m[col],m[pivot]]=[m[pivot],m[col]];
    const div=m[col][col];for(let j=col;j<4;j++)m[col][j]/=div;
    for(let r=0;r<3;r++){if(r===col)continue;const f=m[r][col];for(let j=col;j<4;j++)m[r][j]-=f*m[col][j]}
  }
  return [m[0][3],m[1][3],m[2][3]];
}
function solveMealGrams(pf,cf,ff,vf,share,kind){
  const target=targetMealMacros(share),vegG=vf&&kind==='meal'?100:0,veg=vf?macro(vf,vegG):{p:0,c:0,f:0};
  const b=[target.p-veg.p,target.c-veg.c,target.f-veg.f];
  const A=[
    [(pf.p||0)/100,(cf.p||0)/100,(ff.p||0)/100],
    [(pf.c||0)/100,(cf.c||0)/100,(ff.c||0)/100],
    [(pf.f||0)/100,(cf.f||0)/100,(ff.f||0)/100]
  ];
  let g=solve3x3(A,b);
  if(!g||g.some(x=>!Number.isFinite(x)||x<0)){
    const pg=gramsFor(pf,'p',Math.max(1,b[0]));
    const pm=macro(pf,pg);
    const cg=gramsFor(cf,'c',Math.max(1,target.c-veg.c-pm.c));
    const cm=macro(cf,cg);
    const fg=gramsFor(ff,'f',Math.max(1,target.f-veg.f-pm.f-cm.f));
    g=[pg,cg,fg];
  }
  return g.map(x=>Math.max(5,Math.round(x/5)*5)).concat([vegG]);
}
function alignMealToTarget(meal){
  if(!meal||!meal.items||!state.macro)return meal;
  const extras=meal.items.filter(x=>x.isExtra),extra=sumMeal(extras),target=targetMealMacros(meal.share||0);
  const pfItem=meal.items.find(x=>x.cat==='protein'&&!x.isExtra),cfItem=meal.items.find(x=>x.cat==='carb'&&!x.isExtra),ffItem=meal.items.find(x=>x.cat==='fat'&&!x.isExtra),vfItem=meal.items.find(x=>x.cat==='veg'&&!x.isExtra);
  if(!pfItem||!cfItem||!ffItem){meal.sum=sumMeal(meal.items);return meal}
  const pf=FOOD_DB.find(x=>x.name===pfItem.name),cf=FOOD_DB.find(x=>x.name===cfItem.name),ff=FOOD_DB.find(x=>x.name===ffItem.name),vf=vfItem?FOOD_DB.find(x=>x.name===vfItem.name):null;
  if(!pf||!cf||!ff){meal.sum=sumMeal(meal.items);return meal}
  const vegG=vf&&meal.kind!=='snack'?100:0,veg=vf?macro(vf,vegG):{p:0,c:0,f:0};
  const b=[Math.max(1,target.p-extra.p-veg.p),Math.max(1,target.c-extra.c-veg.c),Math.max(1,target.f-extra.f-veg.f)];
  const A=[
    [(pf.p||0)/100,(cf.p||0)/100,(ff.p||0)/100],
    [(pf.c||0)/100,(cf.c||0)/100,(ff.c||0)/100],
    [(pf.f||0)/100,(cf.f||0)/100,(ff.f||0)/100]
  ];
  let g=solve3x3(A,b);
  if(!g||g.some(x=>!Number.isFinite(x)||x<0)){
    const pg=gramsFor(pf,'p',b[0]),pm=macro(pf,pg);
    const cg=gramsFor(cf,'c',Math.max(1,b[1]-pm.c)),cm=macro(cf,cg);
    const fg=gramsFor(ff,'f',Math.max(1,b[2]-pm.f-cm.f));
    g=[pg,cg,fg];
  }
  [pfItem.g,cfItem.g,ffItem.g]=g.map(x=>Math.max(5,Math.round(x/5)*5));
  if(vfItem)vfItem.g=vegG;
  meal.sum=sumMeal(meal.items);return meal;
}
function alignMealPlanToTargets(plan){
  if(!Array.isArray(plan)||!state.macro)return plan;
  plan.forEach(day=>(day.meals||[]).forEach(alignMealToTarget));
  return plan;
}
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
  el('mealStructurePreview').innerHTML=parts.map(p=>'<div class="structureChip"><strong>'+p.label+'</strong><span>'+(m?Math.round(m.calories*p.share)+' kcal • '+Math.round(m.protein*p.share)+'P • '+Math.round(m.carbs*p.share)+'C • '+Math.round(m.fat*p.share)+'F':' '+Math.round(p.share*100)+'% of day')+'</span></div>').join('');
}
function buildMeal(d,i,share,kind='meal',label='Meal'){
  const ps=kind==='snack'?snackPool('protein'):pool('protein'),cs=kind==='snack'?snackPool('carb'):pool('carb'),vs=pool('veg'),fs=kind==='snack'?snackPool('fat'):pool('fat');
  if(!ps.length||!cs.length||!fs.length||(kind==='meal'&&!vs.length))throw new Error('Your restrictions leave an empty food category. Adjust preferences or exclusions.');
  const pf=foodChoice(ps,d,i),cf=foodChoice(cs,d,i+1),vf=kind==='meal'?foodChoice(vs,d,i+2):null,ff=foodChoice(fs,d,i+3);
  const [pg,cg,fg,vg]=solveMealGrams(pf,cf,ff,vf,share,kind);
  const items=[
    {name:pf.name,g:pg,cat:'protein',price:pf.price},
    {name:cf.name,g:cg,cat:'carb',price:cf.price},
    vf&&{name:vf.name,g:vg,cat:'veg',price:vf.price},
    {name:ff.name,g:fg,cat:'fat',price:ff.price}
  ].filter(x=>x&&x.g>0);
  return{kind,label,share,items,sum:sumMeal(items)};
}
function buildMealDay(dayIndex,meals,snacks,distribution){
  const parts=mealStructure(meals,snacks,distribution);
  return{day:dayIndex+1,meals:parts.map((p,i)=>buildMeal(dayIndex,i,p.share,p.kind,p.label)),prefs:{meals:+meals,snacks:+snacks,distribution}};
}
function saveMealBudget(){
  if(!el('mealBudget'))return;
  state.profile.budget=Math.max(0,+el('mealBudget').value||0);
  if(el('budget'))el('budget').value=state.profile.budget||'';
  save();
}
function estimateMealPlanCost(days){
  let total=0;
  (days||[]).forEach(d=>(d.meals||[]).forEach(m=>(m.items||[]).forEach(x=>{
    const f=FOOD_DB.find(z=>z.name===x.name);
    const price=Number(x.price??f?.price)||0;
    total+=(Number(x.g)||0)/1000*price;
  })));
  return total;
}
function cheapestCompatible(item){
  const current=FOOD_DB.find(x=>x.name===item.name),key=primaryKey(item.cat);
  const options=pool(item.cat).filter(x=>x&&x.name!==item.name&&Number(x.price)>=0).sort((a,b)=>(a.price||0)-(b.price||0));
  if(!options.length)return null;
  const next=options[0];
  let g=Number(item.g)||0;
  if(key&&current&&next[key]>0){const target=(current[key]||0)*g/100;g=gramsFor(next,key,target)}
  return{name:next.name,g,cat:item.cat,price:next.price};
}
function optimizeBudget(days){
  const budget=Number(state.profile.budget)||0;
  if(!budget)return alignMealPlanToTargets(days);
  let plan=JSON.parse(JSON.stringify(days)),cost=estimateMealPlanCost(plan);
  if(cost<=budget)return alignMealPlanToTargets(plan);
  const candidates=[];
  plan.forEach((d,di)=>(d.meals||[]).forEach((m,mi)=>(m.items||[]).forEach((item,ii)=>{
    const alt=cheapestCompatible(item);if(!alt)return;
    const curPrice=Number(item.price??FOOD_DB.find(x=>x.name===item.name)?.price)||0;
    const oldCost=(Number(item.g)||0)/1000*curPrice,newCost=(Number(alt.g)||0)/1000*(Number(alt.price)||0);
    const savings=oldCost-newCost;
    if(savings>.01)candidates.push({di,mi,ii,alt,savings});
  })));
  candidates.sort((x,y)=>y.savings-x.savings);
  for(const c of candidates){
    if(cost<=budget)break;
    plan[c.di].meals[c.mi].items[c.ii]=c.alt;
    plan[c.di].meals[c.mi].sum=sumMeal(plan[c.di].meals[c.mi].items);
    cost-=c.savings;
  }
  alignMealPlanToTargets(plan);
  plan.budgetEstimate=estimateMealPlanCost(plan);
  return plan;
}
function generateMeals(){
  try{
    if(safetyBlockers(state.profile).length)return alert('Meal-plan automation is paused by the safety screening.');
    if(!state.macro)return alert('Complete onboarding first.');
    saveMealBudget();
    const meals=+el('planMealsPerDay').value||Number(state.profile.meals)||4,snacks=+el('planSnacksPerDay').value||0,distribution=el('mealDistribution').value||'balanced';
    state.mealPrefs={meals,snacks,distribution};state.dayMealPrefs={};
    const days=[];for(let d=0;d<7;d++)days.push(buildMealDay(d,meals,snacks,distribution));
    state.mealPlan=optimizeBudget(days);state.mealPlanSchema=3;save();renderMeals();
  }catch(e){console.error(e);el('mealPlan').innerHTML='<div class="notice dangerNotice"><strong>We couldn’t build the meal plan yet.</strong><br>'+String(e.message||e)+'<br><small>Your settings were saved. Try Generate again.</small></div>'}
}
function rebuildMealDay(di){
  try{
    const meals=+el('dayMeals_'+di).value||3,snacks=+el('daySnacks_'+di).value||0,distribution=el('dayDist_'+di).value||state.mealPrefs.distribution||'balanced';
    state.dayMealPrefs[di]={meals,snacks,distribution};state.mealPlan[di]=buildMealDay(di,meals,snacks,distribution);state.mealPlanSchema=3;alignMealPlanToTargets(state.mealPlan);save();renderMeals();
  }catch(e){alert('Could not rebuild this day: '+e.message)}
}
function swapCompatibilityScore(item,candidate){
  const old=FOOD_DB.find(x=>x.name===item.name),key=primaryKey(item.cat);
  if(!old||!candidate)return 999;
  const oldM=macro(old,item.g),targetPrimary=key?oldM[key]:0;
  let g=item.g;
  if(key&&candidate[key]>0)g=gramsFor(candidate,key,targetPrimary);
  const cand=macro(candidate,g);
  const pDiff=Math.abs(cand.p-oldM.p),cDiff=Math.abs(cand.c-oldM.c),fDiff=Math.abs(cand.f-oldM.f),kDiff=Math.abs(cand.k-oldM.k);
  const pref=preferred(candidate)?-8:0,budget=(state.profile.groceryPriority==='budget'?(candidate.price||0)*.15:0);
  return pDiff*2+cDiff*1.2+fDiff*2+kDiff*.03+budget+pref;
}
function nutritionRole(item){
  const f=FOOD_DB.find(x=>x.name===item.name),key=primaryKey(item.cat);
  if(key)return key;
  if(!f)return null;
  return f.p>=f.c&&f.p>=f.f?'p':f.c>=f.f?'c':'f';
}
function roleCandidatePool(item){
  const role=nutritionRole(item),sameCat=FOOD_DB.filter(x=>x.cat===item.cat&&!excluded(x));
  const broad=FOOD_DB.filter(x=>{
    if(excluded(x)||x.name===item.name)return false;
    if(role==='p')return (x.p||0)>=8 && (x.p||0)>=Math.max((x.c||0)*.35,(x.f||0)*.45);
    if(role==='c')return (x.c||0)>=10 && (x.c||0)>=Math.max((x.p||0)*1.2,(x.f||0)*2);
    if(role==='f')return (x.f||0)>=5 && (x.f||0)>=Math.max((x.p||0)*.7,(x.c||0)*.35);
    return x.cat===item.cat;
  });
  const map=new Map();
  [...sameCat,...broad].forEach(x=>map.set(x.name,x));
  return [...map.values()];
}
function swapOptionsFor(item){
  return roleCandidatePool(item)
    .filter(x=>x.name!==item.name)
    .map(x=>({food:x,score:swapCompatibilityScore(item,x)}))
    .sort((a,b)=>a.score-b.score);
}
function swapPreview(item,candidate,meal){
  const old=FOOD_DB.find(x=>x.name===item.name),key=primaryKey(item.cat);
  let g=item.g;
  if(key&&old&&candidate[key]>0){const target=old[key]*item.g/100;g=gramsFor(candidate,key,target)}
  const cloned={...meal,items:meal.items.map(x=>({...x}))};
  const idx=cloned.items.indexOf(cloned.items.find(x=>x.name===item.name&&x.cat===item.cat));
  if(idx>=0)cloned.items[idx]={name:candidate.name,g,cat:item.cat,price:candidate.price};
  alignMealToTarget(cloned);
  const newItem=cloned.items[idx]||{g};
  return{grams:newItem.g,meal:cloned,macros:cloned.sum};
}
let activeSwap=null;
let activeSwapFilter='recommended';
function setSwapFilter(filter,btn){
  activeSwapFilter=filter;
  document.querySelectorAll('[data-swap-filter]').forEach(x=>x.classList.toggle('active',x.dataset.swapFilter===filter));
  renderSwapPickerOptions();
}
function filteredSwapOptions(){
  if(!activeSwap)return[];
  const {di,mi,ii}=activeSwap,meal=state.mealPlan[di]?.meals?.[mi],item=meal?.items?.[ii];if(!meal||!item)return[];
  let options=swapOptionsFor(item),q=(el('swapSearch')?.value||'').trim().toLowerCase();
  if(q)options=options.filter(o=>o.food.name.toLowerCase().includes(q));
  if(activeSwapFilter==='recommended')options=options.slice(0,8);
  else if(activeSwapFilter==='budget')options=[...options].sort((x,y)=>(x.food.price||0)-(y.food.price||0));
  else if(activeSwapFilter==='preferred'){
    const prefs=options.filter(o=>preferred(o.food));if(prefs.length)options=prefs;
  }
  return options;
}
function renderSwapPickerOptions(){
  if(!activeSwap||!el('swapPickerOptions'))return;
  const {di,mi,ii}=activeSwap,meal=state.mealPlan[di]?.meals?.[mi],item=meal?.items?.[ii];if(!meal||!item)return;
  const allRanked=swapOptionsFor(item),options=filteredSwapOptions();
  if(el('swapPickerCount'))el('swapPickerCount').textContent=options.length+' option'+(options.length===1?'':'s')+(activeSwapFilter==='recommended'?' • best macro matches first':'');
  if(el('swapScopeNote')){const role=nutritionRole(item);el('swapScopeNote').textContent=activeSwapFilter==='all'?(role==='p'?'Showing every compatible protein source in the current food library that fits your dietary rules.':'Showing every compatible option in the current food library that can fill this nutrition role.'):'Recommendations are ranked by macro similarity, your preferences and budget settings.';}
  el('swapPickerOptions').innerHTML=options.length?options.map(o=>{
    const idx=allRanked.findIndex(x=>x.food.name===o.food.name),p=swapPreview(item,o.food,meal),m=p.macros,recommended=idx>=0&&idx<3;
    return '<button class="swapOption '+(recommended?'recommended':'')+'" onclick="chooseSwap(\''+escapeHtml(o.food.name).replace(/'/g,"\\'")+'\')">'+
      '<div><strong>'+escapeHtml(o.food.name)+'</strong><small>'+Math.round(p.grams)+'g • '+Math.round(m.k)+' kcal • '+Math.round(m.p)+'P '+Math.round(m.c)+'C '+Math.round(m.f)+'F</small></div>'+
      '<span>'+(recommended?'Recommended':activeSwapFilter==='budget'?'Budget option':'Choose')+'</span></button>';
  }).join(''):'<div class="emptyState">No matching foods. Try another search or filter.</div>';
}
function openSwapPicker(di,mi,ii){
  const meal=state.mealPlan[di]?.meals?.[mi],item=meal?.items?.[ii];if(!meal||!item)return;
  const options=swapOptionsFor(item);if(!options.length)return alert('No compatible alternatives are available for this item.');
  activeSwap={di,mi,ii};activeSwapFilter='recommended';
  if(el('swapSearch'))el('swapSearch').value='';
  document.querySelectorAll('[data-swap-filter]').forEach(x=>x.classList.toggle('active',x.dataset.swapFilter==='recommended'));
  const old=FOOD_DB.find(x=>x.name===item.name),oldMacro=old?macro(old,item.g):null;
  el('swapPickerCurrent').innerHTML='<span>Current</span><strong>'+escapeHtml(item.name)+'</strong><small>'+Math.round(item.g)+'g'+(oldMacro?' • '+Math.round(oldMacro.k)+' kcal • '+Math.round(oldMacro.p)+'P '+Math.round(oldMacro.c)+'C '+Math.round(oldMacro.f)+'F':'')+'</small>';
  renderSwapPickerOptions();
  el('swapPicker').classList.remove('hidden');el('swapPickerBackdrop').classList.remove('hidden');document.body.classList.add('menuOpen');
}
function closeSwapPicker(){el('swapPicker')?.classList.add('hidden');el('swapPickerBackdrop')?.classList.add('hidden');document.body.classList.remove('menuOpen');activeSwap=null;activeSwapFilter='recommended';if(el('swapSearch'))el('swapSearch').value=''}
function chooseSwap(name){
  if(!activeSwap)return;
  const {di,mi,ii}=activeSwap,meal=state.mealPlan[di]?.meals?.[mi],item=meal?.items?.[ii],next=FOOD_DB.find(x=>x.name===name);
  if(!meal||!item||!next)return closeSwapPicker();
  const preview=swapPreview(item,next,meal);
  state.mealPlan[di].meals[mi]=preview.meal;
  save();closeSwapPicker();renderMeals();
}
function swapIngredient(di,mi,ii){openSwapPicker(di,mi,ii)}

let activeMealAdd=null;
function openMealAdd(di,mi){
  const meal=state.mealPlan[di]?.meals?.[mi];if(!meal)return;
  activeMealAdd={di,mi};
  if(el('mealAddSearch'))el('mealAddSearch').value='';
  if(el('mealAddRebalance'))el('mealAddRebalance').checked=true;
  renderMealAddResults();
  el('mealAddPicker').classList.remove('hidden');el('mealAddBackdrop').classList.remove('hidden');document.body.classList.add('menuOpen');
}
function closeMealAdd(){el('mealAddPicker')?.classList.add('hidden');el('mealAddBackdrop')?.classList.add('hidden');document.body.classList.remove('menuOpen');activeMealAdd=null}
function mealAddLibrary(){
  const q=(el('mealAddSearch')?.value||'').trim().toLowerCase();
  let foods=FOOD_DB.filter(x=>!excluded(x));
  if(q)foods=foods.filter(x=>x.name.toLowerCase().includes(q));
  const pref=foods.filter(preferred),rest=foods.filter(x=>!preferred(x));
  return [...pref,...rest].slice(0,q?60:24);
}
function renderMealAddResults(){
  if(!el('mealAddResults'))return;
  const foods=mealAddLibrary();
  el('mealAddResults').innerHTML=foods.length?foods.map(f=>'<button class="swapOption" onclick="promptAddFood(\''+escapeHtml(f.name).replace(/'/g,"\\'")+'\')"><div><strong>'+escapeHtml(f.name)+'</strong><small>'+Math.round(f.k||((f.p||0)*4+(f.c||0)*4+(f.f||0)*9))+' kcal / 100g • '+(f.p||0)+'P '+(f.c||0)+'C '+(f.f||0)+'F</small></div><span>Add</span></button>').join(''):'<div class="emptyState">No matching foods.</div>';
}
function promptAddFood(name){
  const grams=Number(prompt('How many grams of '+name+'?',30));if(!grams||grams<=0)return;
  addFoodToMeal(name,grams);
}
function addFoodToMeal(name,grams){
  if(!activeMealAdd)return;
  const {di,mi}=activeMealAdd,meal=state.mealPlan[di]?.meals?.[mi],food=FOOD_DB.find(x=>x.name===name);if(!meal||!food)return;
  meal.items.push({name:food.name,g:Math.round(grams),cat:food.cat,price:food.price,isExtra:true});
  if(el('mealAddRebalance')?.checked)alignMealToTarget(meal);else meal.sum=sumMeal(meal.items);
  state.mealPlanSchema=3;save();closeMealAdd();renderMeals();
}
function addCustomFoodToMeal(){
  if(!activeMealAdd)return;
  const name=(el('customFoodName')?.value||'').trim(),g=+el('customFoodGrams')?.value||0,p=+el('customFoodProtein')?.value||0,c=+el('customFoodCarbs')?.value||0,f=+el('customFoodFat')?.value||0;
  if(!name||g<=0)return alert('Enter a food name and serving grams.');
  const {di,mi}=activeMealAdd,meal=state.mealPlan[di]?.meals?.[mi];if(!meal)return;
  meal.items.push({name,g:Math.round(g),cat:'extra',isExtra:true,macrosPer100:{p,c,f}});
  if(el('mealAddRebalance')?.checked)alignMealToTarget(meal);else meal.sum=sumMeal(meal.items);
  state.mealPlanSchema=3;save();
  ['customFoodName','customFoodProtein','customFoodCarbs','customFoodFat'].forEach(id=>{if(el(id))el(id).value=''});if(el('customFoodGrams'))el('customFoodGrams').value='30';
  closeMealAdd();renderMeals();
}
function removeMealExtra(di,mi,ii){
  const meal=state.mealPlan[di]?.meals?.[mi],item=meal?.items?.[ii];if(!meal||!item||!item.isExtra)return;
  meal.items.splice(ii,1);alignMealToTarget(meal);save();renderMeals();
}
function replaceMeal(di,mi){
  const old=state.mealPlan[di]?.meals?.[mi];if(!old)return;
  const share=old.share||1/Math.max(1,state.mealPlan[di].meals.length),kind=old.kind||'meal',label=old.label||(kind==='snack'?'Snack':'Meal '+(mi+1));
  let fresh=buildMeal(di+mi+3,mi+2,share,kind,label);
  fresh.items.forEach((x,ii)=>{if(old.items[ii]&&x.name===old.items[ii].name){const opts=(kind==='snack'?snackPool(x.cat):pool(x.cat)).filter(z=>z.name!==x.name);if(opts.length){const oldF=FOOD_DB.find(z=>z.name===x.name),key=primaryKey(x.cat),n=opts[0];let g=x.g;if(key&&oldF&&n[key]>0)g=gramsFor(n,key,oldF[key]*x.g/100);fresh.items[ii]={name:n.name,g,cat:n.cat,price:n.price}}}});
  alignMealToTarget(fresh);state.mealPlan[di].meals[mi]=fresh;save();renderMeals();
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
  if(state.mealPlan.length&&state.mealPlanSchema!==3){state.mealPlan=[];state.mealPlanSchema=3;save()}
  if(state.mealPlan.length&&state.macro)alignMealPlanToTargets(state.mealPlan);
  if(el('mealBudget'))el('mealBudget').value=state.profile.budget||'';
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
    const pref=d.prefs||state.dayMealPrefs[di]||state.mealPrefs,total=d.meals.reduce((s,m)=>({k:s.k+m.sum.k,p:s.p+m.sum.p,c:s.c+m.sum.c,f:s.f+m.sum.f}),{k:0,p:0,c:0,f:0}),target=state.macro||{},deltaK=Math.round(total.k-(target.calories||0));
    const controls='<div class="dayStructure"><label>Meals<select id="dayMeals_'+di+'">'+[2,3,4,5,6].map(n=>'<option '+(n==pref.meals?'selected':'')+'>'+n+'</option>').join('')+'</select></label><label>Snacks<select id="daySnacks_'+di+'">'+[0,1,2,3].map(n=>'<option '+(n==pref.snacks?'selected':'')+'>'+n+'</option>').join('')+'</select></label><label>Distribution<select id="dayDist_'+di+'"><option value="balanced" '+(pref.distribution==='balanced'?'selected':'')+'>Balanced</option><option value="largerDinner" '+(pref.distribution==='largerDinner'?'selected':'')+'>Larger dinner</option><option value="largerBreakfast" '+(pref.distribution==='largerBreakfast'?'selected':'')+'>Larger breakfast</option><option value="training" '+(pref.distribution==='training'?'selected':'')+'>Training-focused</option></select></label><button onclick="rebuildMealDay('+di+')">Rebuild day</button></div>';
    const cards=d.meals.map((m,mi)=>'<div class="meal '+(m.kind==='snack'?'snackCard':'')+'"><div class="row"><div><span class="mealType">'+(m.kind==='snack'?'SNACK':'MEAL')+'</span><strong>'+(m.label||((m.kind==='snack'?'Snack ':'Meal ')+(mi+1)))+'</strong></div><div class="rowWrap"><button class="addFoodBtn" onclick="openMealAdd('+di+','+mi+')">+ Add food</button><button onclick="logPlannedMeal('+di+','+mi+')">Log</button><button onclick="replaceMeal('+di+','+mi+')">Replace</button></div></div><small>'+m.sum.k.toFixed(0)+' kcal • '+m.sum.p.toFixed(0)+'P '+m.sum.c.toFixed(0)+'C '+m.sum.f.toFixed(0)+'F</small>'+m.items.map((x,ii)=>'<div class="row '+(x.isExtra?'mealExtraRow':'')+'"><span>'+x.g+'g '+escapeHtml(x.name)+(x.isExtra?' <em>added</em>':'')+'</span><div class="rowWrap">'+(x.isExtra?'<button onclick="removeMealExtra('+di+','+mi+','+ii+')">Remove</button>':'<button onclick="swapIngredient('+di+','+mi+','+ii+')">Choose swap</button>')+'</div></div>').join('')+'</div>').join('');
    return'<details class="meal dayCard" '+(d.day===1?'open':'')+'><summary><span>Day '+d.day+'</span><small>'+Math.round(total.k)+' / '+Math.round(target.calories||total.k)+' kcal • '+Math.round(total.p)+'P '+Math.round(total.c)+'C '+Math.round(total.f)+'F'+(Math.abs(deltaK)>25?' • '+(deltaK>0?'+':'')+deltaK+' kcal':' • on target')+'</small></summary>'+controls+cards+'</details>';
  }).join('');
  const totals=groceryTotals(),rows=Object.entries(totals);let roundedCost=0;
  const qtyRows=rows.map(([name,g])=>{const f=FOOD_DB.find(x=>x.name===name);if(!f)return'<tr><td>'+escapeHtml(name)+'</td><td>'+displayGroceryWeight(g)+' needed</td><td>Custom item</td></tr>';const packs=Math.ceil(g/f.packageG),buy=packs*f.packageG,cost=buy/1000*f.price;roundedCost+=cost;return'<tr><td>'+name+'</td><td>'+displayGroceryWeight(g)+' needed</td><td>'+displayPackage(f.packageG,packs)+'</td></tr>'}).join('');
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
  const s=(state.profile.injuries||'').toLowerCase(),owned=state.profile.equipment||[],recoveryKey=recoveryPlanAreaKey();
  const safe=x=>!x.avoid.some(z=>s.includes(z)||(recoveryKey&&(recoveryKey.includes(z)||z.includes(recoveryKey))));
  let a=EXERCISES.filter(x=>x.m===m&&x.eq.some(e=>owned.includes(e))&&safe(x));
  if(!a.length)a=EXERCISES.filter(x=>x.m===m&&safe(x));return a[i%a.length]?.name||('Pain-free '+m+' movement');
}
function activeRecoveryPlan(){
  const p=state.recoveryPlan;if(!p||!p.active)return null;
  if(p.restrictionUntil&&today()>p.restrictionUntil&&!p.clearanceRequired)return null;
  return p;
}
function recoveryPlanAreaKey(){const p=activeRecoveryPlan();return p?areaKeyword(p.area||''):''}
function recoveryRestUntil(p=activeRecoveryPlan()){
  if(!p||!p.onsetDate||!p.fullRestDays)return null;
  const d=new Date(p.onsetDate+'T12:00:00');d.setDate(d.getDate()+(+p.fullRestDays||0)-1);return localDate(d);
}
function recoveryExerciseAffected(item,p=activeRecoveryPlan()){
  if(!p||!item)return false;
  const key=areaKeyword(p.area||''),meta=EXERCISES.find(x=>x.name===item.name);
  if(!key||!meta)return false;
  return meta.avoid.some(z=>key.includes(z)||z.includes(key));
}
function recoveryTrainingMode(p=activeRecoveryPlan()){
  if(!p)return{mode:'normal',text:'No active recovery restriction.'};
  const sev=+p.severity||0,restUntil=recoveryRestUntil(p),restricted=p.restrictionUntil&&today()<=p.restrictionUntil;
  if(concerningIssue({severity:sev,sensation:p.symptoms,notes:p.notes}))return{mode:'stop',text:'Do not load the affected area. This symptom pattern needs appropriate clinical evaluation before the app attempts progression.'};
  if(restUntil&&today()<=restUntil)return{mode:'rest',text:'Planned full-rest window is active through '+restUntil+'. Training is intentionally paused during this user/clinician-set window.'};
  if(restricted||p.clearanceRequired)return{mode:'protect',text:'Affected-area protection is active'+(p.restrictionUntil?' through '+p.restrictionUntil:'')+'. PhysiqueOS will avoid loading exercises that conflict with the logged restriction.'};
  if(sev>=4)return{mode:'protect',text:'Moderate symptoms are logged. Keep the affected area unloaded or pain-free, reduce training stress, and reassess instead of forcing progression.'};
  return{mode:'modify',text:'Mild symptoms are logged. Keep training conservative and pain-free, with no forced progression for the affected area.'};
}
function saveRecoveryPlan(){
  const area=el('recoveryArea')?.value||'',type=el('recoveryType')?.value||'unknown',onsetDate=el('recoveryOnset')?.value||today(),severity=+(el('recoverySeverity')?.value||0),symptoms=el('recoverySymptoms')?.value||'',fullRestDays=Math.max(0,+(el('recoveryRestDays')?.value||0)),restrictionUntil=el('recoveryUntil')?.value||'',clearanceRequired=!!el('recoveryClearance')?.checked,notes=el('recoveryNotes')?.value||'';
  if(!area)return alert('Choose the area you want PhysiqueOS to protect.');
  state.recoveryPlan={active:true,area,type,onsetDate,severity,symptoms,fullRestDays,restrictionUntil,clearanceRequired,notes,updatedAt:today()};
  save();renderAll();
}
function endRecoveryPlan(){if(!state.recoveryPlan)return;state.recoveryPlan.active=false;save();renderAll()}
function renderRecoveryPlanner(){
  if(!el('recoveryPlanner'))return;
  const p=state.recoveryPlan||{},active=activeRecoveryPlan(),mode=recoveryTrainingMode(active);
  const areas=['','Shoulder','Elbow','Wrist/hand','Neck','Upper back','Low back','Hip','Groin','Knee','Hamstring','Quad','Calf','Achilles','Ankle/foot','Other'];
  const types=[['unknown','Not sure'],['muscle','Muscle-related'],['tendon','Tendon-related'],['ligament','Ligament-related'],['joint','Joint-related'],['bone','Bone-related'],['other','Other']];
  const status=active?'<div class="recoveryStatus '+mode.mode+'"><div><span class="kicker">ACTIVE PROTECTION</span><strong>'+escapeHtml(active.area)+' • '+escapeHtml(types.find(x=>x[0]===active.type)?.[1]||active.type)+'</strong><small>'+escapeHtml(mode.text)+'</small></div><button onclick="endRecoveryPlan()">End protection</button></div>':'<div class="recoveryStatus normal"><div><span class="kicker">RECOVERY PROTECTION</span><strong>No active restriction</strong><small>Log a current issue if training needs to adapt around it.</small></div></div>';
  const timeline=active?(active.restrictionUntil?'<div class="recoveryTimeline"><strong>Restriction window</strong><span>Through '+active.restrictionUntil+'</span><small>This is a training-protection date, not a prediction that tissue is healed.</small></div>':active.fullRestDays?'<div class="recoveryTimeline"><strong>Planned rest window</strong><span>'+active.fullRestDays+' day'+(active.fullRestDays===1?'':'s')+' from '+active.onsetDate+'</span><small>Rest duration comes from the user/clinician entry. PhysiqueOS does not diagnose tissue healing time.</small></div>':''):'';
  el('recoveryPlanner').innerHTML='<details class="recoveryCard" '+(active?'open':'')+'><summary><div><span class="kicker">RECOVERY & RETURN TO TRAINING</span><strong>Protect an injury or irritated area</strong><small>Adjust exercises, loading and days off without pretending to diagnose or predict healing.</small></div><em>'+(active?'Active':'Set up')+'</em></summary><div class="recoveryBody">'+status+timeline+
    '<div class="recoveryForm"><label>Area<select id="recoveryArea">'+areas.map(x=>'<option '+((p.area||'')===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label>'+
    '<label>Issue type<select id="recoveryType">'+types.map(x=>'<option value="'+x[0]+'" '+((p.type||'unknown')===x[0]?'selected':'')+'>'+x[1]+'</option>').join('')+'</select></label>'+
    '<label>Started<input id="recoveryOnset" type="date" value="'+escapeHtml(p.onsetDate||today())+'"></label>'+
    '<label>Current severity 0–10<input id="recoverySeverity" type="number" min="0" max="10" value="'+(+p.severity||0)+'"></label>'+
    '<label>Symptoms<select id="recoverySymptoms"><option '+((p.symptoms||'')===''?'selected':'')+'></option><option '+(p.symptoms==='Tight/stiff'?'selected':'')+'>Tight/stiff</option><option '+(p.symptoms==='Sore/ache'?'selected':'')+'>Sore/ache</option><option '+(p.symptoms==='Sharp'?'selected':'')+'>Sharp</option><option '+(p.symptoms==='Numb/tingly'?'selected':'')+'>Numb/tingly</option><option '+(p.symptoms==='Unstable/weak'?'selected':'')+'>Unstable/weak</option><option '+(p.symptoms==='Other'?'selected':'')+'>Other</option></select></label>'+
    '<label>Full rest days <span class="muted">optional</span><input id="recoveryRestDays" type="number" min="0" max="60" value="'+(+p.fullRestDays||0)+'"></label>'+
    '<label>Protect area until <span class="muted">optional</span><input id="recoveryUntil" type="date" value="'+escapeHtml(p.restrictionUntil||'')+'"></label>'+
    '<label class="checkLabel"><input id="recoveryClearance" type="checkbox" '+(p.clearanceRequired?'checked':'')+'> Keep affected area protected until cleared</label>'+
    '<label class="wide">Clinician / recovery notes<textarea id="recoveryNotes" placeholder="Examples: avoid loaded knee flexion for 2 weeks; no sprinting until cleared; PT said upper body only.">'+escapeHtml(p.notes||'')+'</textarea></label></div>'+
    '<div class="recoveryGuardrail"><strong>Important:</strong> PhysiqueOS can adapt training around restrictions and track a clinician-provided timeline, but it will not estimate that a tendon, muscle, ligament or joint is “healed” on a specific date.</div>'+
    '<button class="primary" onclick="saveRecoveryPlan()">Save & adapt training</button></div></details>';
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
function workoutDraftKey(di){const d=state.trainingPlan[di];return today()+'|'+(d?.name||di)}
function getWorkoutDraft(di){
  const k=workoutDraftKey(di);
  return state.trainingDrafts[k]||(state.trainingDrafts[k]={pre:{},post:{},exercises:{},sets:{},sessionStatus:'active',coachResponse:''});
}
function saveWorkoutDraft(di){
  const d=getWorkoutDraft(di);
  d.pre={area:el('preArea_'+di)?.value||d.pre?.area||'',sensation:el('preSensation_'+di)?.value||d.pre?.sensation||'',severity:+(el('preSeverity_'+di)?.value??d.pre?.severity??0),notes:el('preNotes_'+di)?.value??d.pre?.notes??''};
  d.post={area:el('postArea_'+di)?.value||d.post?.area||'',sensation:el('postSensation_'+di)?.value||d.post?.sensation||'',severity:+(el('postSeverity_'+di)?.value??d.post?.severity??0),notes:el('postNotes_'+di)?.value??d.post?.notes??''};
  state.trainingPlan[di]?.items?.forEach((x,ei)=>{
    d.exercises[ei]={pain:+(el('exPain_'+di+'_'+ei)?.value??d.exercises?.[ei]?.pain??0),mod:el('exMod_'+di+'_'+ei)?.value||d.exercises?.[ei]?.mod||'as prescribed',note:el('exNote_'+di+'_'+ei)?.value??d.exercises?.[ei]?.note??'',recommendation:d.exercises?.[ei]?.recommendation||''};
    d.sets[ei]=d.sets[ei]||{};
    for(let si=0;si<x.sets;si++)d.sets[ei][si]={weight:el('w_'+di+'_'+ei+'_'+si)?.value??d.sets[ei][si]?.weight??'',reps:el('r_'+di+'_'+ei+'_'+si)?.value??d.sets[ei][si]?.reps??'',rir:el('rir_'+di+'_'+ei+'_'+si)?.value??d.sets[ei][si]?.rir??''};
  });
  d.sessionRpe=el('sessionRpe_'+di)?.value??d.sessionRpe??'';d.sessionNotes=el('sessionNotes_'+di)?.value??d.sessionNotes??'';
  save();
}
function saveTrainingFlag(di,phase,area,sensation,severity,notes,exercise=''){
  if(!area&&!sensation&&!notes&&!severity)return;
  state.trainingFlags.push({id:Date.now()+'_'+Math.random(),date:today(),workout:state.trainingPlan[di]?.name||'',phase,exercise,area,sensation,severity:+severity||0,notes});
}
function recentTrainingFlag(){return [...state.trainingFlags].reverse().find(x=>x.area||x.sensation||x.notes)||null}
function issueText(issue){return((issue?.sensation||'')+' '+(issue?.notes||issue?.note||'')).toLowerCase()}
function concerningIssue(issue){
  const sev=+(issue?.severity??issue?.pain??0),text=issueText(issue);
  return sev>=7||/sharp|pop|snap|unstable|giving way|numb|tingl|weakness|cannot bear|can.t bear/.test(text);
}
function flagAdvice(flag){
  if(!flag)return'';
  const sev=+flag.severity||0,text=issueText(flag);
  if(concerningIssue(flag))return'Stop loading that area for now. Do not use the app to push through severe or neurologic-type symptoms; seek appropriate clinical evaluation.';
  if(sev>=4)return'Stop the aggravating movement, switch to a pain-free option if available, reduce training stress, and reassess rather than chasing progression.';
  return'Keep the movement pain-free, use a conservative load/range, and stop if symptoms increase across sets.';
}
function areaKeyword(area){
  const x=(area||'').toLowerCase();
  if(x.includes('shoulder'))return'shoulder';if(x.includes('elbow'))return'elbow';if(x.includes('wrist'))return'wrist';if(x.includes('neck'))return'neck';if(x.includes('low back'))return'low back';if(x.includes('hip')||x.includes('groin'))return'hip';if(x.includes('knee'))return'knee';if(x.includes('ankle')||x.includes('foot'))return'ankle';return x;
}
function painFreeAlternative(item,area){
  const m=exerciseMuscle(item),key=areaKeyword(area),inj=(state.profile.injuries||'').toLowerCase(),owned=state.profile.equipment||[];
  let opts=EXERCISES.filter(x=>x.m===m&&x.name!==item.name&&x.eq.some(e=>owned.includes(e))&&!x.avoid.some(z=>inj.includes(z)||key.includes(z)||z.includes(key)));
  if(!opts.length)opts=EXERCISES.filter(x=>x.m===m&&x.name!==item.name&&!x.avoid.some(z=>inj.includes(z)||key.includes(z)||z.includes(key)));
  return opts[0]||null;
}
function applyExerciseModification(di,ei,issue){
  const item=state.trainingPlan[di]?.items?.[ei];if(!item)return{action:'none',text:'No exercise found.'};
  const sev=+(issue?.pain??issue?.severity??0),text=issueText(issue),draft=getWorkoutDraft(di);
  if(concerningIssue(issue)){
    draft.exercises[ei]={...draft.exercises[ei],mod:'stopped',recommendation:'Stop this exercise now. Do not test it with heavier loading.'};
    return{action:'stop',text:'Stop '+item.name+' now. Do not keep testing the painful movement. If the symptom is severe, sharp, unstable, accompanied by a pop/snap, numbness/tingling or weakness, end loading for that area and seek appropriate evaluation.'};
  }
  if(sev>=4||/pinch|ache|burning/.test(text)){
    const alt=painFreeAlternative(item,issue?.area||'');
    if(alt){
      const old=item.name;item.name=alt.name;item.muscle=alt.m;item.sets=Math.max(1,(item.sets||3)-1);item.rir=Math.max(3,item.rir||3);
      draft.exercises[ei]={...draft.exercises[ei],mod:'substituted',recommendation:'Replaced '+old+' with '+alt.name+'; reduced one set and increased RIR target.'};
      return{action:'swap',text:'I replaced '+old+' with '+alt.name+', removed one working set, and moved the target to at least '+item.rir+' RIR. If the substitute reproduces the symptom, stop it rather than searching for a way to push through.'};
    }
    item.sets=Math.max(1,(item.sets||3)-1);item.rir=Math.max(3,item.rir||3);
    draft.exercises[ei]={...draft.exercises[ei],mod:'reduced load',recommendation:'No clear alternate found. Reduce load/range, remove one set, keep ≥3 RIR, and stop if symptoms persist.'};
    return{action:'reduce',text:'No clearly safer substitute is available in the current exercise database. Reduce load and range to a pain-free version, remove one set, stay at least 3 RIR, and stop the exercise if symptoms persist or worsen.'};
  }
  item.rir=Math.max(item.rir||3,3);
  draft.exercises[ei]={...draft.exercises[ei],mod:'reduced load',recommendation:'Mild issue: keep it pain-free, use a conservative load, and do not progress today.'};
  return{action:'monitor',text:'This reads as a mild issue. Keep the movement pain-free, avoid load progression today, stay around '+item.rir+' RIR, and stop if the symptom increases.'};
}
function analyzePreWorkoutIssue(di){
  saveWorkoutDraft(di);const d=getWorkoutDraft(di),issue=d.pre,sev=+issue.severity||0;
  if(!issue.area&&!issue.sensation&&!issue.notes&&!sev){d.coachResponse='No issue entered. Run the readiness-adjusted workout as planned.';save();renderTraining();return}
  if(concerningIssue(issue)){
    d.sessionStatus='ended';d.coachResponse='Workout stopped by the beta safety logic. '+flagAdvice(issue);saveTrainingFlag(di,'pre',issue.area,issue.sensation,sev,issue.notes);save();renderTraining();return;
  }
  const affected=[];
  state.trainingPlan[di].items.forEach((item,ei)=>{
    const meta=EXERCISES.find(x=>x.name===item.name),key=areaKeyword(issue.area);
    const likely=meta&&meta.avoid.some(z=>key.includes(z)||z.includes(key));
    if(likely&&sev>=3){const r=applyExerciseModification(di,ei,{...issue,pain:sev});affected.push(item.name+': '+r.action)}
  });
  if(sev>=4&&!affected.length){
    state.trainingPlan[di].items.forEach(item=>{item.rir=Math.max(3,item.rir||3)});
    d.coachResponse='No specific exercise conflict was identified, so I made the whole session more conservative: keep at least 3 RIR, avoid painful ranges, and stop any movement that reproduces the symptom.';
  }else if(affected.length)d.coachResponse='I modified the exercises most likely to aggravate the area. '+affected.join(' • ')+'. Reassess symptoms after warm-ups and stop any movement that worsens them.';
  else d.coachResponse='Mild issue logged. Keep the session pain-free, do not force progression, and reassess after warm-ups.';
  saveTrainingFlag(di,'pre',issue.area,issue.sensation,sev,issue.notes);save();renderTraining();
}
function analyzeExerciseIssue(di,ei){
  saveWorkoutDraft(di);const d=getWorkoutDraft(di),issue=d.exercises[ei]||{},area=el('preArea_'+di)?.value||d.pre?.area||'',payload={...issue,area,severity:issue.pain};
  if(!issue.pain&&!issue.note){issue.recommendation='No symptom entered.';save();renderTraining();return}
  const r=applyExerciseModification(di,ei,payload);issue.recommendation=r.text;
  if(concerningIssue(payload)&&(+issue.pain>=8||/pop|snap|numb|tingl|unstable|weakness/.test(issueText(payload)))){d.sessionStatus='ended';d.coachResponse='The workout has been stopped because the symptom pattern is not appropriate for automated training modification. '+flagAdvice(payload)}
  else d.coachResponse='Workout adapted from your latest exercise feedback. '+r.text;
  saveTrainingFlag(di,'during',area,issue.mod,issue.pain,issue.note,state.trainingPlan[di]?.items?.[ei]?.name||'');save();renderTraining();
}
function endWorkoutNow(di,reason='User ended workout'){
  saveWorkoutDraft(di);const d=getWorkoutDraft(di);d.sessionStatus='ended';d.coachResponse=reason+'. Remaining work is disabled. Log the session as-is or leave it unfinished.';save();renderTraining();
}
function resumeWorkout(di){const d=getWorkoutDraft(di);d.sessionStatus='active';d.coachResponse='Workout resumed. Keep the session conservative and stop again if symptoms return.';save();renderTraining()}

const EXERCISE_GUIDES={
'Goblet Squat':{target:'Quads + glutes',setup:'Hold the dumbbell close to the chest, feet around shoulder width, brace before descending.',execute:'Sit down between the hips while keeping the whole foot planted. Drive through the floor and finish tall.',cues:['Tripod foot','Knees track with toes','Ribs stacked over pelvis'],avoid:['Heels lifting','Knees collapsing inward','Losing trunk position']},
'Leg Press':{target:'Quads + glutes',setup:'Set feet where you can maintain pelvis contact and a comfortable knee path.',execute:'Lower under control to your deepest pain-free position without the pelvis rolling, then press without locking violently.',cues:['Control the bottom','Push through mid-foot','Keep pelvis heavy on pad'],avoid:['Butt curling off pad','Bouncing','Knees collapsing']},
'Back Squat':{target:'Quads + glutes',setup:'Create a stable bar position, brace 360°, set feet and pressure before unracking.',execute:'Descend with hips and knees together, maintain balance over mid-foot, then drive up without losing brace.',cues:['Brace before moving','Stay over mid-foot','Drive the floor away'],avoid:['Relaxing at bottom','Shifting onto toes','Knees collapsing']},
'Hack Squat':{target:'Quads',setup:'Keep back and pelvis supported, place feet where knees can travel comfortably.',execute:'Lower slowly into a pain-free depth and drive through the platform while keeping the torso supported.',cues:['Let knees travel','Control depth','Keep full foot pressure'],avoid:['Bouncing','Pelvis lifting','Locking knees aggressively']},
'Leg Extension':{target:'Quads',setup:'Align knee joint with machine pivot and pad above the ankle.',execute:'Extend smoothly, squeeze the quads near the top, lower under control.',cues:['Move from the knee','Own the top','Slow eccentric'],avoid:['Swinging hips','Slamming stack','Forcing painful knee range']},
'Romanian Deadlift':{target:'Hamstrings + glutes',setup:'Soft knees, ribs stacked, load close to thighs.',execute:'Push hips back while maintaining spinal position until hamstrings limit the range, then drive hips forward.',cues:['Hips back','Shave the legs','Keep lats tight'],avoid:['Squatting the movement','Rounding to gain depth','Load drifting forward']},
'Seated Leg Curl':{target:'Hamstrings',setup:'Align knee with machine pivot and secure thigh pad.',execute:'Curl through the largest comfortable range, pause briefly, then control the return.',cues:['Keep hips down','Curl, do not kick','Control the stretch'],avoid:['Hip lifting','Jerking','Shortening ROM unnecessarily']},
'Lying Leg Curl':{target:'Hamstrings',setup:'Hips square to pad, pad positioned near lower calf/ankle.',execute:'Curl heels toward glutes without lifting hips, then lower slowly.',cues:['Hips heavy','Smooth curl','Own the eccentric'],avoid:['Arching low back','Bouncing','Using momentum']},
'Hip Thrust':{target:'Glutes',setup:'Upper back supported, feet positioned so shins are near vertical at lockout.',execute:'Drive hips up while keeping ribs down, pause at full hip extension, lower under control.',cues:['Ribs down','Posterior tilt at top','Push through whole foot'],avoid:['Overarching back','Feet too far away','Hyperextending neck']},
'Walking Lunge':{target:'Glutes + quads',setup:'Stand tall with enough space for controlled steps.',execute:'Step into a stable stride, lower both knees under control, drive through the front leg into the next step.',cues:['Own each step','Front foot planted','Pelvis stays level'],avoid:['Narrow tightrope stance','Rushing','Front knee collapsing']},
'Cable Kickback':{target:'Glutes',setup:'Brace torso and keep pelvis square.',execute:'Extend the hip without rotating or arching the back, pause, return slowly.',cues:['Move the thigh','Square hips','Small clean ROM'],avoid:['Low-back extension','Swinging','Opening the pelvis']},
'DB Bench Press':{target:'Chest + triceps',setup:'Feet planted, shoulder blades gently back/down, wrists stacked over forearms.',execute:'Lower dumbbells under control to a comfortable depth, then press while maintaining shoulder position.',cues:['Chest tall','Elbows under wrists','Drive upper arms inward'],avoid:['Shoulders rolling forward','Bouncing','Excessive elbow flare']},
'Machine Chest Press':{target:'Chest + triceps',setup:'Adjust seat so handles line up around mid-chest and shoulder stays centered.',execute:'Press smoothly without shrugging, return until chest is stretched without shoulder rolling forward.',cues:['Shoulders down','Press in an arc','Control the stretch'],avoid:['Shrugging','Locking out violently','Letting shoulders dump forward']},
'Push-up':{target:'Chest + triceps + core',setup:'Hands slightly wider than shoulders, body in a straight line.',execute:'Lower chest between hands while keeping trunk rigid, then push the floor away.',cues:['Ribs down','Screw hands into floor','Move as one unit'],avoid:['Sagging hips','Flared elbows','Half reps']},
'Incline DB Press':{target:'Upper chest + triceps',setup:'Moderate bench incline, feet planted, shoulders stable.',execute:'Lower toward upper chest line, keep forearms stacked, press without shrugging.',cues:['Shoulders packed','Elbows under wrists','Press up and slightly in'],avoid:['Too-steep incline','Shoulder roll','Bouncing']},
'Cable Fly':{target:'Chest',setup:'Set cables so tension remains through the desired arc, slight elbow bend.',execute:'Bring upper arms across the body without turning it into a press, then control the stretch.',cues:['Hug the room','Soft elbows','Chest stays tall'],avoid:['Overstretching shoulder','Elbows bending excessively','Torso swinging']},
'Lat Pulldown':{target:'Lats + upper back',setup:'Secure thighs and take a grip that allows comfortable shoulder motion.',execute:'Drive elbows down toward the torso, pause, then allow a controlled overhead stretch.',cues:['Elbows to pockets','Chest quiet','Reach at top'],avoid:['Turning into a row','Jerking torso','Pulling behind neck']},
'Chest Supported Row':{target:'Upper back + lats',setup:'Chest stays supported, feet stable, arms reach naturally.',execute:'Pull elbows back without lifting chest from pad, pause, lower under control.',cues:['Reach then row','Move elbows, not hands','Keep chest planted'],avoid:['Shrugging','Throwing torso','Cutting stretch short']},
'Cable Row':{target:'Back',setup:'Sit tall with stable pelvis and neutral trunk.',execute:'Reach shoulder blades forward under control, then row elbows back without excessive torso swing.',cues:['Long arms first','Elbows back','Finish without leaning'],avoid:['Rocking torso','Shrugging','Yanking cable']},
'Pull-up':{target:'Lats + upper back + arms',setup:'Start from a controlled hang with ribs stacked.',execute:'Pull elbows toward ribs, bring chest toward bar, lower to a controlled hang.',cues:['Drive elbows down','Keep ribs controlled','Own the bottom'],avoid:['Kipping unless programmed','Neck reaching','Dropping from top']},
'One-arm DB Row':{target:'Lats + upper back',setup:'Stable stance/support, spine controlled, shoulder allowed to reach.',execute:'Row elbow toward hip/ribs, pause, then lower with a controlled reach.',cues:['Reach long','Elbow to hip','Keep torso quiet'],avoid:['Twisting aggressively','Shrugging','Yanking']},
'DB Lateral Raise':{target:'Lateral delts',setup:'Stand stable with dumbbells slightly forward of thighs.',execute:'Raise arms out and slightly forward to a comfortable height, lower slowly.',cues:['Lead with elbows','Reach wide','Stay relaxed through traps'],avoid:['Heaving','Shrugging','Turning into front raise']},
'Cable Lateral Raise':{target:'Lateral delts',setup:'Set cable low and create a clear path away from the body.',execute:'Raise arm out and slightly forward with a soft elbow, control the return.',cues:['Lead elbow','Reach away','Keep torso still'],avoid:['Shrugging','Twisting','Too much momentum']},
'Machine Shoulder Press':{target:'Delts + triceps',setup:'Seat height allows forearms to stay under handles without shoulder pinch.',execute:'Press overhead smoothly, stop short of painful range, lower under control.',cues:['Ribs down','Forearms stacked','Press without shrugging'],avoid:['Excessive back arch','Forcing depth','Bouncing']},
'Rear Delt Fly':{target:'Rear delts + upper back',setup:'Chest supported if available, arms slightly bent.',execute:'Sweep arms out/back while keeping shoulders away from ears, return slowly.',cues:['Reach wide','Lead with elbows','Keep traps quiet'],avoid:['Shrugging','Over-rowing','Using momentum']},
'Cable Curl':{target:'Biceps',setup:'Stand stable with upper arms positioned consistently.',execute:'Curl without letting elbows drift excessively, squeeze, lower fully under control.',cues:['Elbows quiet','Supinate if handle allows','Own the bottom'],avoid:['Rocking torso','Shoulders rolling forward','Dropping eccentric']},
'DB Curl':{target:'Biceps',setup:'Stand or sit tall with shoulders stable.',execute:'Curl through a comfortable range while keeping upper arm controlled, lower slowly.',cues:['Turn palm up','Keep elbow quiet','Slow down'],avoid:['Swinging','Shoulder flexion taking over','Dropping weight']},
'Rope Pressdown':{target:'Triceps',setup:'Elbows near sides, torso stable.',execute:'Extend elbows until triceps shorten fully without shoulder movement, return under control.',cues:['Pin elbows','Spread rope slightly','Finish with triceps'],avoid:['Torso rocking','Elbows drifting','Stack slamming']},
'DB Skullcrusher':{target:'Triceps',setup:'Upper arms angled comfortably, shoulders stable.',execute:'Bend elbows to lower dumbbells beside/behind head, then extend without moving upper arms excessively.',cues:['Move at elbows','Control stretch','Keep shoulders quiet'],avoid:['Elbows flaring wildly','Dropping quickly','Forcing painful elbow range']},
'Standing Calf Raise':{target:'Calves',setup:'Stable support, ball of foot firmly planted.',execute:'Lower into a controlled stretch, rise as high as possible without bouncing, pause.',cues:['Full stretch','Pause at top','Straight path'],avoid:['Bouncing','Tiny reps','Rolling ankle']},
'Plank':{target:'Anterior core',setup:'Elbows under shoulders, glutes lightly engaged, ribs stacked.',execute:'Maintain a straight line while breathing behind the brace.',cues:['Ribs down','Squeeze glutes','Push floor away'],avoid:['Sagging hips','Holding breath','Shrugging']},
'Cable Crunch':{target:'Abs',setup:'Kneel/sit stable and keep hips relatively fixed.',execute:'Flex the trunk by bringing ribs toward pelvis, then control back to neutral.',cues:['Ribs to pelvis','Exhale into crunch','Hips stay quiet'],avoid:['Turning into hip hinge','Pulling with arms','Jerking cable']}
};
function exerciseGuide(item){
  const g=EXERCISE_GUIDES[item.name];
  if(g)return g;
  const target=(item.muscle||exerciseMuscle(item)||'target musculature').replace(/^./,x=>x.toUpperCase());
  return{target,setup:'Create a stable setup that lets you move through a comfortable, repeatable range.',execute:'Use controlled reps through the largest pain-free range you can own while keeping tension on the intended muscles.',cues:['Stable setup','Controlled range','Match the prescribed RIR'],avoid:['Using momentum','Changing technique as fatigue rises','Training through increasing pain']};
}
function renderExerciseGuide(item){
  const g=exerciseGuide(item);
  return'<details class="executionGuide"><summary><strong>Execution guide</strong><span>'+escapeHtml(g.target)+'</span></summary><div class="guideGrid"><div><small>SETUP</small><p>'+escapeHtml(g.setup)+'</p></div><div><small>EXECUTION</small><p>'+escapeHtml(g.execute)+'</p></div><div><small>KEY CUES</small><ul>'+g.cues.map(x=>'<li>'+escapeHtml(x)+'</li>').join('')+'</ul></div><div><small>AVOID</small><ul>'+g.avoid.map(x=>'<li>'+escapeHtml(x)+'</li>').join('')+'</ul></div></div><div class="guideNote">Use the guide as a coaching reference, not a reason to push through pain. If your movement feels meaningfully different or painful, use “Something feels off?” below.</div></details>';
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
  if(!el('readinessPanel'))return;
  const r=readinessAdvice(),score=r.score,label=r.level==='high'?'High Readiness':r.level==='medium'?'Moderate Readiness':r.level==='low'?'Low Readiness':'Readiness not logged';
  const headline=r.level==='unknown'?'Readiness<br><span>not logged</span>':label.replace(' ',' <span>')+(r.level!=='unknown'?'</span>':'');
  const prior=[...state.logs].reverse().find(x=>x.date<today()&&(x.sleep||x.energy||x.recovery||x.soreness||x.stress));
  let delta='';if(score!=null&&prior){const curLog=currentLog(),saveLogs=state.logs,stateLogs=state.logs;const vals=[prior.sleep?clamp(prior.sleep/(state.profile.sleepGoal||7.5)*100,0,110):null,prior.energy?prior.energy*10:null,prior.recovery?prior.recovery*10:null,prior.soreness?110-prior.soreness*10:null,prior.stress?110-prior.stress*10:null].filter(v=>v!=null);const ps=vals.length?Math.round(avg(vals)):null;if(ps!=null)delta=(score-ps>=0?'↑ ':'↓ ')+Math.abs(score-ps)+'%'}
  el('readinessPanel').innerHTML='<div class="readinessCard trainingReadinessHero '+r.level+'"><div class="readinessHeroCopy"><span class="kicker">TODAY\'S READINESS</span><h2>'+headline+'</h2><p>'+r.text+'</p></div><div class="readinessVisual"><div class="readinessScore"><strong>'+(score==null?'—':score)+'</strong><small>READINESS'+(score==null?' SCORE':'')+'</small></div>'+(score==null?'<button class="readinessLogBtn" onclick="showTab(\'dailylog\')"><span>▥</span>Log now ›</button>':'<div class="readinessDelta"><strong>'+(delta||'↑ 0%')+'</strong><small>vs. yesterday</small></div>')+'</div></div>';
}
function renderTrainingSpotlight(){
  if(!el('trainingSpotlight'))return;
  const day=dayType(today()),work=day.workout,recovery=activeRecoveryPlan(),mins=state.profile.sessionLength||60;
  if(day.type!=='training'||!work){
    const rx=cardioPrescription();
    el('trainingSpotlight').innerHTML='<div class="trainingWorkoutCard recoveryDayCard"><div class="trainingWorkoutTop"><span class="kicker">TODAY\'S PLAN</span></div><div class="trainingWorkoutMain"><div class="spotlightIcon">↗</div><div><h2>'+escapeHtml(day.title)+'</h2><p>'+escapeHtml(rx.text)+'</p></div></div><button class="primary trainingStartBtn" onclick="showTab(\'dailylog\')">Open today ›</button></div>'+
      '<div class="recoveryProtectionMock"><div class="recoveryShield">◇</div><div><span class="kicker">RECOVERY & RETURN TO TRAINING</span><strong>Protect an injury or irritated area</strong><small>Get personalized modifications to keep training consistent while you recover.</small></div><button onclick="document.querySelector(\'.recoveryCard\')?.setAttribute(\'open\',\'\')">Set →</button></div>';
    return;
  }
  const count=work.items?.length||0,goal=state.profile.trainingGoal==='strength'?'Build strength':state.profile.trainingGoal==='performance'?'Performance':'Build muscle';
  const difficulty=readinessAdvice().level==='low'?'Reduced':readinessAdvice().level==='high'?'Moderate':'Moderate';
  const focus=(work.items||[]).slice(0,3).map(x=>exerciseMuscle(x)).filter(Boolean).map(x=>x.charAt(0).toUpperCase()+x.slice(1)).filter((x,j,arr)=>arr.indexOf(x)===j).slice(0,3).join(' • ')||'Full body';
  const estCal=Math.round((state.profile.weight||175)*.045*mins);
  const recoveryHtml=recovery?'<div class="recoveryProtectionMock active"><div class="recoveryShield">◇</div><div><span class="kicker">RECOVERY PROTECTION</span><strong>Protecting Your '+escapeHtml(recovery.area)+'</strong><small>We’ve adjusted your workout around the active restriction so you can keep training effectively.</small></div><div class="shoulderArt"></div><button onclick="document.querySelector(\'.recoveryCard\')?.setAttribute(\'open\',\'\')">Manage →</button></div>':'';
  el('trainingSpotlight').innerHTML='<div class="trainingWorkoutCard"><div class="trainingWorkoutTop"><span class="kicker">TODAY\'S WORKOUT</span><button onclick="generateTraining()">Change Workout →</button></div><div class="trainingWorkoutMain"><div class="spotlightIcon"><svg viewBox="0 0 24 24"><path d="M3 9v6M6 7v10M18 7v10m3-8v6M6 12h12"/></svg></div><div><h2>'+escapeHtml(work.name)+'</h2><p>◎ '+count+' exercises • '+Math.max(45,mins-10)+'–'+mins+' min • '+goal+'</p></div><button class="primary trainingStartBtn" onclick="document.querySelector(\'#trainingPlan .workout\')?.scrollIntoView({behavior:\'smooth\'})">▶ Start Workout</button></div><div class="trainingStatGrid"><div class="cal"><span>♨</span><small>EST. CALORIES</small><strong>'+estCal+'</strong></div><div class="time"><span>◷</span><small>EST. TIME</small><strong>~'+mins+' min</strong></div><div class="diff"><span>▥</span><small>DIFFICULTY</small><strong>'+difficulty+'</strong></div><div class="focus"><span>◎</span><small>PRIMARY FOCUS</small><strong>'+escapeHtml(focus)+'</strong></div></div></div>'+recoveryHtml;
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
  const day=state.trainingPlan[di];if(!day)return;saveWorkoutDraft(di);const draft=getWorkoutDraft(di);
  const exercises=day.items.map((x,ei)=>{
    const results=[];
    for(let si=0;si<x.sets;si++){
      const sv=draft.sets?.[ei]?.[si]||{},weight=+sv.weight||0,reps=+sv.reps||0,rir=sv.rir!==''&&sv.rir!=null?+sv.rir:null;
      if(reps>0)results.push({set:si+1,weight,reps,rir,rpe:rir!=null?Math.max(1,10-rir):null});
    }
    const issue=draft.exercises[ei]||{};
    if(issue.pain||issue.note||issue.mod!=='as prescribed')saveTrainingFlag(di,'during','',issue.mod,issue.pain,issue.note,x.name);
    return{name:x.name,issue,results};
  }).filter(x=>x.results.length||x.issue?.pain||x.issue?.note);
  const hasContext=draft.pre?.severity||draft.pre?.notes||draft.post?.severity||draft.post?.notes||draft.sessionStatus==='ended';
  if(!exercises.length&&!hasContext)return alert('Enter at least one completed set or note about what happened.');
  saveTrainingFlag(di,'pre',draft.pre.area,draft.pre.sensation,draft.pre.severity,draft.pre.notes);
  saveTrainingFlag(di,'post',draft.post.area,draft.post.sensation,draft.post.severity,draft.post.notes);
  const sessionRpe=+draft.sessionRpe||null;
  if(draft.sessionStatus!=='ended'&&!sessionRpe&&!confirm('No session RPE entered. Save the workout anyway?'))return;
  state.workoutLogs.push({date:today(),workout:day.name,status:draft.sessionStatus||'active',sessionRpe,notes:draft.sessionNotes||'',volume:workoutVolume(exercises),readiness:readinessScore(),pre:draft.pre,post:draft.post,coachResponse:draft.coachResponse||'',exercises});
  delete state.trainingDrafts[workoutDraftKey(di)];save();renderTraining();renderCoachChat();alert(draft.sessionStatus==='ended'?'Partial/ended workout saved with the reason and modifications.':'Workout logged. PhysiqueOS updated your progression and modification history.');
}

function saveWorkoutFavorite(di){
  saveWorkoutDraft(di);
  const d=state.trainingPlan[di];if(!d)return;
  const name=(prompt('Name this favorite workout:',d.name)||'').trim();if(!name)return;
  const draft=getWorkoutDraft(di);
  const template={id:Date.now()+'_'+Math.random(),name,sourceName:d.name,items:JSON.parse(JSON.stringify(d.items)),presetSets:JSON.parse(JSON.stringify(draft.sets||{}))};
  state.workoutFavorites.push(template);save();renderTraining();
}
function loadWorkoutFavorite(di){
  const id=el('workoutFavorite_'+di)?.value;if(!id)return alert('Choose a favorite workout first.');
  const f=state.workoutFavorites.find(x=>x.id===id);if(!f)return;
  if(!confirm('Load "'+f.name+'" into this workout slot?'))return;
  const preferredDay=state.trainingPlan[di]?.preferredDay||'';
  state.trainingPlan[di]={name:f.name,preferredDay,items:JSON.parse(JSON.stringify(f.items))};
  const key=workoutDraftKey(di);state.trainingDrafts[key]={pre:{},post:{},exercises:{},sets:JSON.parse(JSON.stringify(f.presetSets||{})),sessionStatus:'active',coachResponse:'Loaded favorite workout: '+f.name};
  save();renderTraining();
}
function deleteWorkoutFavorite(di){
  const id=el('workoutFavorite_'+di)?.value;if(!id)return;
  state.workoutFavorites=state.workoutFavorites.filter(x=>x.id!==id);save();renderTraining();
}
function favoriteWorkoutOptions(){
  return '<option value="">Favorite workouts…</option>'+state.workoutFavorites.map(x=>'<option value="'+x.id+'">'+escapeHtml(x.name)+'</option>').join('');
}
function quickExerciseValue(di,ei,key){
  const item=state.trainingPlan[di]?.items?.[ei],draft=getWorkoutDraft(di),sv=draft.sets?.[ei]?.[0]||{},prev=item&&lastPerformance(item.name)?.sets?.[0];
  if(key==='sets')return item?.sets||3;
  if(key==='load')return +(sv.weight||prev?.weight||0);
  if(key==='reps')return +(sv.reps||Math.round(((item?.minReps||8)+(item?.maxReps||12))/2));
  if(key==='rir')return +(sv.rir!==''&&sv.rir!=null?sv.rir:(item?.rir??2));
  if(key==='rpe')return Math.max(1,10-quickExerciseValue(di,ei,'rir'));
  return 0;
}
function quickAdjustExercise(di,ei,key,delta){
  const item=state.trainingPlan[di]?.items?.[ei];if(!item)return;
  if(key==='sets'){item.sets=clamp((item.sets||3)+delta,1,8);save();renderTraining();return}
  const d=getWorkoutDraft(di);d.sets[ei]=d.sets[ei]||{};
  const current=quickExerciseValue(di,ei,key),step=key==='load'?5:1,next=Math.max(key==='rir'?0:0,current+delta*step);
  for(let si=0;si<item.sets;si++){d.sets[ei][si]=d.sets[ei][si]||{};if(key==='load')d.sets[ei][si].weight=next;if(key==='reps')d.sets[ei][si].reps=Math.max(1,next);if(key==='rir')d.sets[ei][si].rir=clamp(next,0,9)}
  save();renderTraining();
}
function toggleExerciseDetails(di,ei){const card=document.getElementById('exCard_'+di+'_'+ei);if(card)card.classList.toggle('detailsOpen')}
function exerciseMockControls(di,ei,x){
  const vals=[['sets','Sets',quickExerciseValue(di,ei,'sets')],['load','Load (lb)',quickExerciseValue(di,ei,'load')||'—'],['reps','Reps',quickExerciseValue(di,ei,'reps')],['rir','RIR',quickExerciseValue(di,ei,'rir')],['rpe','RPE',quickExerciseValue(di,ei,'rpe')]];
  return '<div class="exerciseMockControls">'+vals.map(v=>'<div><small>'+v[1]+'</small><span><button onclick="quickAdjustExercise('+di+','+ei+',\''+v[0]+'\',-1)" '+(v[0]==='rpe'?'disabled':'')+'>−</button><strong>'+v[2]+'</strong><button onclick="quickAdjustExercise('+di+','+ei+',\''+v[0]+'\',1)" '+(v[0]==='rpe'?'disabled':'')+'>+</button></span></div>').join('')+'</div>';
}
function renderTraining(){
  renderRecoveryPlanner();
  renderReadiness();
  renderTrainingSpotlight();
  if(trainingBlocked(state.profile)){el('trainingPlan').innerHTML='<div class="notice dangerNotice">Training automation is paused by the safety screening.</div>';return}
  if(!state.trainingPlan.length){el('trainingPlan').innerHTML='<div class="notice">Generate a program first.</div>';el('workoutHistory').innerHTML='';return}
  const areas=['','Shoulder','Elbow','Wrist/hand','Neck','Upper back','Low back','Hip','Groin','Knee','Ankle/foot','Other'];
  const sensations=['','Tight/stiff','Sore','Ache','Pinch','Sharp','Burning','Numb/tingly','Unstable','Weak','Other'];
  el('trainingPlan').innerHTML=state.trainingPlan.map((d,di)=>{
    const draft=getWorkoutDraft(di),ended=draft.sessionStatus==='ended',recovery=activeRecoveryPlan(),recoveryMode=recoveryTrainingMode(recovery),resting=recoveryMode.mode==='rest'||recoveryMode.mode==='stop';
    const recoveryBanner=recovery?'<div class="recoveryWorkoutBanner '+recoveryMode.mode+'"><strong>'+escapeHtml(recoveryMode.text)+'</strong>'+(resting?'<span>Workout inputs are disabled during the active rest/protection window.</span>':'<span>Non-conflicting exercises can still be trained conservatively.</span>')+'</div>':'';
    const coachBanner=draft.coachResponse?'<div class="coachModification '+(ended?'stop':'')+'"><div><span class="kicker">LIVE COACH MODIFICATION</span><strong>'+escapeHtml(draft.coachResponse)+'</strong></div><div class="buttons">'+(ended?'<button onclick="resumeWorkout('+di+')">Resume only if appropriate</button>':'')+'<button class="danger" onclick="endWorkoutNow('+di+',\'Workout ended manually\')">End workout</button></div></div>':'';
    const pre='<details class="trainingCheck" '+((draft.pre?.severity||draft.pre?.notes)?'open':'')+'><summary><strong>Pre-workout body check</strong><span>Anything tight, sore, tweaked or needing modification?</span></summary><div class="issueGrid"><label>Area<select id="preArea_'+di+'" onchange="saveWorkoutDraft('+di+')">'+areas.map(x=>'<option '+(draft.pre?.area===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label><label>Feeling<select id="preSensation_'+di+'" onchange="saveWorkoutDraft('+di+')">'+sensations.map(x=>'<option '+(draft.pre?.sensation===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label><label>Severity 0–10<input id="preSeverity_'+di+'" type="number" min="0" max="10" value="'+(draft.pre?.severity||0)+'" onchange="saveWorkoutDraft('+di+')"></label><label class="issueNote">Coach note<textarea id="preNotes_'+di+'" onblur="saveWorkoutDraft('+di+')" placeholder="What feels off? What movements worry you?">'+escapeHtml(draft.pre?.notes||'')+'</textarea></label><button class="primary analyzeIssue" onclick="analyzePreWorkoutIssue('+di+')">Analyze & adapt workout</button></div></details>';
    const exercises=d.items.map((x,ei)=>{
      const targetRpe=Math.max(1,10-(x.rir??3)),prev=lastPerformance(x.name),issue=draft.exercises?.[ei]||{},savedSets=draft.sets?.[ei]||{},recoveryProtected=recovery&&recoveryExerciseAffected(x,recovery),exerciseDisabled=ended||resting||recoveryProtected;
      const setRows=Array.from({length:x.sets},(_,si)=>{const sv=savedSets[si]||{};return'<div class="setBlock"><div class="setRow coachSetRow"><strong>Set '+(si+1)+'</strong><label>Load<input id="w_'+di+'_'+ei+'_'+si+'" type="number" step=".5" inputmode="decimal" value="'+escapeHtml(sv.weight??'')+'" placeholder="'+(prev?.sets?.[si]?.weight??'')+'" oninput="saveWorkoutDraft('+di+')" '+(exerciseDisabled?'disabled':'')+'></label><label>Reps<input id="r_'+di+'_'+ei+'_'+si+'" type="number" inputmode="numeric" value="'+escapeHtml(sv.reps??'')+'" placeholder="'+(prev?.sets?.[si]?.reps??'')+'" oninput="liveSetCue('+di+','+ei+','+si+');saveWorkoutDraft('+di+')" '+(exerciseDisabled?'disabled':'')+'></label><label>RIR<input id="rir_'+di+'_'+ei+'_'+si+'" type="number" min="0" max="9" step=".5" inputmode="decimal" value="'+escapeHtml(sv.rir??'')+'" placeholder="'+(prev?.sets?.[si]?.rir??x.rir)+'" oninput="liveSetCue('+di+','+ei+','+si+');saveWorkoutDraft('+di+')" '+(exerciseDisabled?'disabled':'')+'></label><div class="derivedRpe">RPE ≈ <span id="derived_'+di+'_'+ei+'_'+si+'">'+targetRpe+'</span></div></div><div id="cue_'+di+'_'+ei+'_'+si+'" class="setCue">Previous: '+previousSetText(x.name,si)+'</div></div>'}).join('');
      const recommendation=issue.recommendation?'<div class="issueRecommendation">'+escapeHtml(issue.recommendation)+'</div>':'';
      const issueBox='<details class="exerciseIssue" '+((issue.pain||issue.note||issue.recommendation)?'open':'')+'><summary>Something feels off? Tell the coach.</summary><div class="exerciseIssueGrid"><label>Pain / discomfort 0–10<input id="exPain_'+di+'_'+ei+'" type="number" min="0" max="10" value="'+(issue.pain||0)+'" onchange="saveWorkoutDraft('+di+')"></label><label>What did you already change?<select id="exMod_'+di+'_'+ei+'" onchange="saveWorkoutDraft('+di+')"><option value="as prescribed" '+(issue.mod==='as prescribed'?'selected':'')+'>Nothing yet</option><option value="reduced load" '+(issue.mod==='reduced load'?'selected':'')+'>Reduced load</option><option value="reduced ROM" '+(issue.mod==='reduced ROM'?'selected':'')+'>Reduced range</option><option value="tempo modified" '+(issue.mod==='tempo modified'?'selected':'')+'>Changed tempo</option><option value="technique modified" '+(issue.mod==='technique modified'?'selected':'')+'>Changed technique</option><option value="substituted" '+(issue.mod==='substituted'?'selected':'')+'>Substituted movement</option><option value="stopped" '+(issue.mod==='stopped'?'selected':'')+'>Stopped exercise</option></select></label><label class="issueNote">What happened?<textarea id="exNote_'+di+'_'+ei+'" onblur="saveWorkoutDraft('+di+')" placeholder="Example: right shoulder started pinching on set 2 and worsened when I went deeper.">'+escapeHtml(issue.note||'')+'</textarea></label><button class="primary analyzeIssue" onclick="analyzeExerciseIssue('+di+','+ei+')">Analyze & modify from here</button>'+recommendation+'</div></details>';
      return'<div id="exCard_'+di+'_'+ei+'" class="exerciseCard '+(exerciseDisabled?'disabledExercise':'')+' '+(recoveryProtected?'recoveryProtected':'')+'"><div class="exerciseMockHead"><span class="exerciseNumber">'+(ei+1)+'</span><span class="exerciseThumb"><svg viewBox="0 0 24 24"><path d="M5 13h14M7 10v6m10-6v6M4 11v4m16-4v4"/></svg></span><div><strong>'+escapeHtml(x.name)+'</strong><small>'+escapeHtml((exerciseGuide(x).target||exerciseMuscle(x)||'Target muscles').replace(/,/g,' •'))+'</small></div><button class="exerciseDots" onclick="toggleExerciseDetails('+di+','+ei+')">•••</button></div>'+exerciseMockControls(di,ei,x)+'<div class="exerciseDetailLayer"><div class="recoveryExerciseNote">'+(recoveryProtected?'<strong>Protected for recovery</strong><span>This movement conflicts with the active '+escapeHtml(recovery.area)+' restriction and is disabled until the restriction changes.</span>':'')+'</div><div class="row exerciseTitleRow"><div class="exName"><strong>'+x.name+'</strong><br><small>'+x.sets+' working sets • '+x.minReps+'–'+x.maxReps+' reps • target '+x.rir+' RIR (≈ '+targetRpe+' RPE)</small><br><small>'+progression(x.name,x.minReps,x.maxReps,x.rir)+'</small></div><div class="exerciseActions"><button onclick="fillPrevious('+di+','+ei+')" '+(exerciseDisabled?'disabled':'')+'>Last workout</button><button onclick="changeSetCount('+di+','+ei+',-1)" '+(exerciseDisabled?'disabled':'')+'>− set</button><button onclick="changeSetCount('+di+','+ei+',1)" '+(exerciseDisabled?'disabled':'')+'>+ set</button><button onclick="swapExercise('+di+','+ei+')" '+(exerciseDisabled?'disabled':'')+'>Swap</button></div></div><div class="restButtons"><span>Rest timer</span><button onclick="startRestTimer(60)" '+(exerciseDisabled?'disabled':'')+'>1:00</button><button onclick="startRestTimer(90)" '+(exerciseDisabled?'disabled':'')+'>1:30</button><button onclick="startRestTimer(120)" '+(exerciseDisabled?'disabled':'')+'>2:00</button><button onclick="startRestTimer(180)" '+(exerciseDisabled?'disabled':'')+'>3:00</button></div><div class="setRows">'+setRows+'</div>'+renderExerciseGuide(x)+issueBox+'</div></div>';
    }).join('');
    const post='<details class="trainingCheck postCheck" '+((draft.post?.severity||draft.post?.notes)?'open':'')+'><summary><strong>Post-workout body check</strong><span>Anything to carry into the next session?</span></summary><div class="issueGrid"><label>Area<select id="postArea_'+di+'" onchange="saveWorkoutDraft('+di+')">'+areas.map(x=>'<option '+(draft.post?.area===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label><label>Feeling<select id="postSensation_'+di+'" onchange="saveWorkoutDraft('+di+')">'+sensations.map(x=>'<option '+(draft.post?.sensation===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label><label>Severity 0–10<input id="postSeverity_'+di+'" type="number" min="0" max="10" value="'+(draft.post?.severity||0)+'" onchange="saveWorkoutDraft('+di+')"></label><label class="issueNote">Carry-forward note<textarea id="postNotes_'+di+'" onblur="saveWorkoutDraft('+di+')" placeholder="What should the coach remember or modify next time?">'+escapeHtml(draft.post?.notes||'')+'</textarea></label></div></details>';
    const finish='<div class="workoutFinish"><div><span class="kicker">POST-WORKOUT</span><h4>How hard was the whole session?</h4><p>Session RPE is separate from set RIR. Rate the overall workout after you finish.</p></div><label><span>Session RPE</span><input id="sessionRpe_'+di+'" type="number" min="1" max="10" step=".5" value="'+escapeHtml(draft.sessionRpe??'')+'" placeholder="1–10"></label></div><label class="sessionNote">General session notes<input id="sessionNotes_'+di+'" value="'+escapeHtml(draft.sessionNotes??'')+'" placeholder="Performance, pumps, technique, energy, anything unusual..."></label>';
    return'<div class="workout"><div class="workoutHeader"><div><h3>'+d.name+'</h3><span class="pill">'+(d.preferredDay||'Session '+(di+1))+'</span></div><div class="workoutFavoriteControls"><button onclick="saveWorkoutFavorite('+di+')">★ Save favorite</button><select id="workoutFavorite_'+di+'">'+favoriteWorkoutOptions()+'</select><button onclick="loadWorkoutFavorite('+di+')">Load</button><button onclick="deleteWorkoutFavorite('+di+')">Delete</button></div></div>'+coachBanner+pre+exercises+post+finish+'<button class="primary fullBtn" onclick="logWorkout('+di+')">'+(ended?'Log partial / ended session':'Finish & log '+d.name)+'</button></div>';
  }).join('');
  const flags=[...state.trainingFlags].reverse().slice(0,10);
  el('workoutHistory').innerHTML=(flags.length?'<div class="flagHistory"><h4>Recent body / modification notes</h4>'+flags.map(f=>'<div class="flagItem '+(f.severity>=7?'highFlag':f.severity>=4?'midFlag':'')+'"><strong>'+f.date+' • '+(f.exercise||f.workout||f.phase)+'</strong><span>'+[f.area,f.sensation,f.severity?f.severity+'/10':'',f.notes].filter(Boolean).map(escapeHtml).join(' • ')+'</span></div>').join('')+'</div>':'')+(state.workoutLogs.length?[...state.workoutLogs].reverse().slice(0,12).map(w=>'<div class="meal"><div class="row"><strong>'+w.date+' • '+w.workout+'</strong><span class="pill">'+(w.sessionRpe?'RPE '+w.sessionRpe:'Logged')+'</span></div>'+(w.volume?'<div class="muted">Volume '+Math.round(w.volume).toLocaleString()+' • readiness '+(w.readiness??'—')+'</div>':'')+(w.notes?'<div class="muted">'+escapeHtml(w.notes)+'</div>':'')+w.exercises.map(x=>'<div class="historyExercise"><strong>'+x.name+'</strong>'+(x.issue&&(x.issue.pain||x.issue.note||x.issue.mod!=='as prescribed')?'<div class="issueHistory">'+[x.issue.mod,x.issue.pain?x.issue.pain+'/10':'',x.issue.note].filter(Boolean).map(escapeHtml).join(' • ')+'</div>':'')+'<div>'+normalizeSetResults(x).map((s,i)=>'Set '+(s.set||i+1)+': '+s.weight+' × '+s.reps+(s.rir!=null?' @ '+s.rir+' RIR':'')).join('<br>')+'</div></div>').join('')+'</div>').join(''):'<div class="notice">No workouts logged yet.</div>');
}

function shiftLogDate(delta){
  const d=new Date(selectedFoodDate()+'T12:00:00');d.setDate(d.getDate()+delta);el('foodLogDate').value=localDate(d);renderAll();
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
  el('foodDbLogger').classList.toggle('hidden',mode!=='database');
  el('customFoodLogger').classList.toggle('hidden',mode!=='custom');
  if(el('savedFoodLogger'))el('savedFoodLogger').classList.toggle('hidden',mode!=='saved');
  document.querySelectorAll('.foodLogTabs button').forEach(x=>x.classList.remove('active'));if(btn)btn.classList.add('active');
  if(mode==='saved')renderSavedNutrition();
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
  const date=selectedFoodDate(),d=new Date(date+'T12:00:00');d.setDate(d.getDate()-1);const prev=localDate(d),entries=dayFoodEntries(prev);
  if(!entries.length)return alert('No food entries found for the previous day.');
  entries.forEach(x=>state.foodLogs.push({...x,id:Date.now()+'_'+Math.random(),date}));
  syncFoodToDailyLog(date);save();renderAll();
}
function clearFoodDay(){
  const date=selectedFoodDate();if(!confirm('Clear all food entries for '+date+'?'))return;
  state.foodLogs=state.foodLogs.filter(x=>x.date!==date);syncFoodToDailyLog(date);save();renderAll();
}
function cleanFoodTemplateEntry(x){return{meal:x.meal,name:x.name,grams:x.grams||null,calories:+x.calories||0,protein:+x.protein||0,carbs:+x.carbs||0,fat:+x.fat||0,source:x.source||'saved'}}
function favoriteFood(id){
  const x=state.foodLogs.find(v=>v.id===id);if(!x)return;
  const exists=state.favoriteFoods.some(v=>v.name===x.name&&v.meal===x.meal&&Math.round(v.calories)===Math.round(x.calories)&&Math.round(v.grams||0)===Math.round(x.grams||0));
  if(exists)return alert('That entry is already in Favorites.');
  state.favoriteFoods.push({id:Date.now()+'_'+Math.random(),...cleanFoodTemplateEntry(x)});save();renderAll();
}
function addFavoriteFood(id){
  const x=state.favoriteFoods.find(v=>v.id===id);if(!x)return;
  state.foodLogs.push({...cleanFoodTemplateEntry(x),id:Date.now()+'_'+Math.random(),date:selectedFoodDate(),source:'favorite'});
  syncFoodToDailyLog();save();renderAll();
}
function deleteFavoriteFood(id){state.favoriteFoods=state.favoriteFoods.filter(x=>x.id!==id);save();renderSavedNutrition()}
function saveCurrentDayTemplate(){
  const entries=dayFoodEntries(selectedFoodDate());if(!entries.length)return alert('Log food for this day first.');
  const name=(prompt('Name this repeat day:','My standard day')||'').trim();if(!name)return;
  state.foodDayTemplates.push({id:Date.now()+'_'+Math.random(),name,entries:entries.map(cleanFoodTemplateEntry)});save();renderSavedNutrition();
}
function applyDayTemplate(id){
  const t=state.foodDayTemplates.find(x=>x.id===id);if(!t)return;
  const date=selectedFoodDate();if(dayFoodEntries(date).length&&!confirm('This date already has food logged. Add the saved day anyway?'))return;
  t.entries.forEach(x=>state.foodLogs.push({...x,id:Date.now()+'_'+Math.random(),date,source:'day-template'}));
  syncFoodToDailyLog(date);save();renderAll();
}
function deleteDayTemplate(id){state.foodDayTemplates=state.foodDayTemplates.filter(x=>x.id!==id);save();renderSavedNutrition()}
function startOfWeek(dateStr=selectedFoodDate()){
  const d=new Date(dateStr+'T12:00:00'),day=(d.getDay()+6)%7;d.setDate(d.getDate()-day);return d;
}
function saveCurrentWeekTemplate(){
  const start=startOfWeek(),days=[];
  for(let n=0;n<7;n++){const d=new Date(start);d.setDate(d.getDate()+n);const date=localDate(d),entries=dayFoodEntries(date);days.push({offset:n,entries:entries.map(cleanFoodTemplateEntry)})}
  if(!days.some(d=>d.entries.length))return alert('There are no food logs in this Monday–Sunday week to save.');
  const name=(prompt('Name this weekly food template:','My normal week')||'').trim();if(!name)return;
  state.foodWeekTemplates.push({id:Date.now()+'_'+Math.random(),name,days});save();renderSavedNutrition();
}
function applyWeekTemplate(id){
  const t=state.foodWeekTemplates.find(x=>x.id===id);if(!t)return;
  const start=startOfWeek(),dates=t.days.map(d=>{const x=new Date(start);x.setDate(x.getDate()+d.offset);return localDate(x)});
  if(dates.some(date=>dayFoodEntries(date).length)&&!confirm('Some dates this week already contain food. Add the saved week anyway?'))return;
  t.days.forEach(day=>{const d=new Date(start);d.setDate(d.getDate()+day.offset);const date=localDate(d);day.entries.forEach(x=>state.foodLogs.push({...x,id:Date.now()+'_'+Math.random(),date,source:'week-template'}));syncFoodToDailyLog(date)});
  save();renderAll();
}
function deleteWeekTemplate(id){state.foodWeekTemplates=state.foodWeekTemplates.filter(x=>x.id!==id);save();renderSavedNutrition()}
function renderSavedNutrition(){
  if(!el('savedNutrition'))return;
  const fav=state.favoriteFoods.map(x=>'<div class="savedItem"><div><strong>'+escapeHtml(x.name)+'</strong><small>'+escapeHtml(x.meal)+' • '+Math.round(x.calories)+' kcal • '+Math.round(x.protein)+'P '+Math.round(x.carbs)+'C '+Math.round(x.fat)+'F'+(x.grams?' • '+Math.round(x.grams)+'g':'')+'</small></div><div class="savedActions"><button class="primary" onclick="addFavoriteFood(\''+x.id+'\')">Add</button><button onclick="deleteFavoriteFood(\''+x.id+'\')">Delete</button></div></div>').join('');
  const days=state.foodDayTemplates.map(x=>'<div class="savedItem"><div><strong>'+escapeHtml(x.name)+'</strong><small>Full day • '+x.entries.length+' entries • '+Math.round(x.entries.reduce((s,v)=>s+v.calories,0))+' kcal</small></div><div class="savedActions"><button class="primary" onclick="applyDayTemplate(\''+x.id+'\')">Load day</button><button onclick="deleteDayTemplate(\''+x.id+'\')">Delete</button></div></div>').join('');
  const weeks=state.foodWeekTemplates.map(x=>'<div class="savedItem"><div><strong>'+escapeHtml(x.name)+'</strong><small>Weekly template • '+x.days.reduce((s,d)=>s+d.entries.length,0)+' logged items</small></div><div class="savedActions"><button class="primary" onclick="applyWeekTemplate(\''+x.id+'\')">Load week</button><button onclick="deleteWeekTemplate(\''+x.id+'\')">Delete</button></div></div>').join('');
  el('savedNutrition').innerHTML='<div class="savedSection"><h4>Favorite foods / meals</h4>'+(fav||'<div class="emptyState">Tap ★ beside a logged food or meal to save it here.</div>')+'</div><div class="savedSection"><h4>Repeat days</h4>'+(days||'<div class="emptyState">Save a fully logged day to reuse it later.</div>')+'</div><div class="savedSection"><h4>Repeat weeks</h4>'+(weeks||'<div class="emptyState">Save a Monday–Sunday eating pattern and preload it into another week.</div>')+'</div>';
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
  el('foodDiary').innerHTML=entries.length?Object.entries(groups).map(([meal,arr])=>'<div class="diaryMeal"><div class="row"><h4>'+meal+'</h4><span>'+Math.round(arr.reduce((s,x)=>s+x.calories,0))+' kcal</span></div>'+arr.map(x=>'<div class="diaryEntry"><div><strong>'+escapeHtml(x.name)+'</strong><small>'+Math.round(x.calories)+' kcal • '+Math.round(x.protein)+'P '+Math.round(x.carbs)+'C '+Math.round(x.fat)+'F'+(x.grams?' • '+Math.round(x.grams)+'g':'')+'</small></div><div class="diaryEntryActions"><button title="Save favorite" onclick="favoriteFood(\''+x.id+'\')">★</button><button title="Delete" onclick="deleteFoodLog(\''+x.id+'\')">×</button></div></div>').join('')+'</div>').join(''):'<div class="emptyState">Nothing logged for this day yet. Add food above or log a meal from your generated plan.</div>';
}
function loadDailyMetrics(){
  if(!el('dailyWeight'))return;const date=selectedFoodDate(),x=state.logs.find(v=>v.date===date),metric=state.profile.units==='metric';
  el('dailyWeight').value=x?.weight?(metric?(x.weight/2.20462).toFixed(1):x.weight):'';
  el('dailyWaist').value=x?.waist?(metric?(x.waist*2.54).toFixed(1):x.waist):'';
  el('dailySteps').value=x?.steps||'';el('dailyWater').value=x?.water?(metric?(x.water/33.814).toFixed(1):x.water):'';setRangeValue('dailySleep','dailySleepOut',x?.sleep,7.5);el('dailyRhr').value=x?.rhr||'';
  el('dailyCalories').value=x?.calories||'';setRangeValue('dailyAdherence','dailyAdherenceOut',x?.adherence,85);setRangeValue('dailyHunger','dailyHungerOut',x?.hunger,5);setRangeValue('dailyEnergy','dailyEnergyOut',x?.energy,5);setRangeValue('dailyStress','dailyStressOut',x?.stress,5);setRangeValue('dailyRecovery','dailyRecoveryOut',x?.recovery,5);setRangeValue('dailyDigestion','dailyDigestionOut',x?.digestion,5);setRangeValue('dailySoreness','dailySorenessOut',x?.soreness,5);el('dailyNotes').value=x?.notes||'';
  renderDailyMetricSummary(x);
}
function saveDailyMetrics(){
  const date=selectedFoodDate(),existing=state.logs.find(x=>x.date===date)||{date},metric=state.profile.units==='metric',val=id=>smartVal(id);
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
  state.logs=state.logs.filter(x=>x.date!==today());state.logs.push(next);state.logs.sort((x,y)=>x.date.localeCompare(y.date));save();autoMacroReview(true);renderAll();
}
function logStreak(){
  if(!state.logs.length)return 0;const dates=new Set(state.logs.map(x=>x.date));let d=new Date(),n=0;
  for(let i=0;i<365;i++){const k=localDate(d);if(dates.has(k)){n++;d.setDate(d.getDate()-1)}else if(i===0){d.setDate(d.getDate()-1)}else break}return n;
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
  const x={date:el('logDate').value||today(),weight:rawWeight?(metric?rawWeight*2.20462:rawWeight):null,bodyFat:+el('logBodyFat').value||null,neck:measure('logNeck'),shoulders:measure('logShoulders'),chest:measure('logChest'),waist:measure('logWaist'),hips:measure('logHips'),armL:measure('logArmL'),armR:measure('logArmR'),thighL:measure('logThighL'),thighR:measure('logThighR'),calfL:measure('logCalfL'),calfR:measure('logCalfR'),steps:+el('logSteps').value||null,water:rawWater?(metric?rawWater*33.814:rawWater):null,sleep:smartVal('logSleep'),calories:+el('logCalories').value||null,adherence:smartVal('logAdherence'),hunger:smartVal('logHunger'),energy:smartVal('logEnergy'),stress:smartVal('logStress'),recovery:smartVal('logRecovery'),soreness:smartVal('logSoreness'),digestion:smartVal('logDigestion'),performance:el('logPerformance').value,notes:el('logNotes').value};
  state.logs=state.logs.filter(a=>a.date!==x.date);state.logs.push(x);state.logs.sort((a,b)=>a.date.localeCompare(b.date));save();autoMacroReview(true);renderAll();
}
function renderHistory(){
  el('history').innerHTML='<table><tr><th>Date</th><th>Weight</th><th>Waist</th><th>Steps</th><th>Sleep</th><th>Adh.</th><th>Hunger</th><th>Recovery</th></tr>'+[...state.logs].reverse().map(x=>'<tr><td>'+x.date+'</td><td>'+(x.weight||'—')+'</td><td>'+(x.waist||'—')+'</td><td>'+(x.steps||'—')+'</td><td>'+(x.sleep||'—')+'</td><td>'+(x.adherence!=null?x.adherence+'%':'—')+'</td><td>'+(x.hunger||'—')+'</td><td>'+(x.recovery||'—')+'</td></tr>').join('')+'</table>';
}
function dateDaysAgo(n){const d=new Date();d.setDate(d.getDate()-n);return localDate(d)}
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

function openPhotoDB(){return new Promise((res,rej)=>{const r=indexedDB.open('PhysiqueOSPhotos',2);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('photos'))r.result.createObjectStore('photos',{keyPath:'id'});if(!r.result.objectStoreNames.contains('profile'))r.result.createObjectStore('profile',{keyPath:'id'})};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function saveProfilePhoto(input){
  const file=input?.files?.[0];if(!file)return;
  if(!file.type.startsWith('image/'))return alert('Choose an image file.');
  if(file.size>12*1024*1024)return alert('Choose an image under 12 MB.');
  try{
    const db=await openPhotoDB(),tx=db.transaction('profile','readwrite');
    tx.objectStore('profile').put({id:'avatar',blob:file,updatedAt:Date.now()});
    tx.oncomplete=()=>{db.close();input.value='';renderProfilePhoto()};
  }catch(e){console.warn(e);alert('Could not save that profile photo on this device.')}
}
async function removeProfilePhoto(){
  if(!confirm('Remove your profile photo from this device?'))return;
  try{const db=await openPhotoDB(),tx=db.transaction('profile','readwrite');tx.objectStore('profile').delete('avatar');tx.oncomplete=()=>{db.close();renderProfilePhoto()}}catch(e){console.warn(e)}
}
async function getProfilePhoto(){
  try{
    const db=await openPhotoDB();return await new Promise(resolve=>{const tx=db.transaction('profile','readonly'),req=tx.objectStore('profile').get('avatar');req.onsuccess=()=>{const x=req.result;db.close();resolve(x?.blob||null)};req.onerror=()=>{db.close();resolve(null)}})
  }catch(e){return null}
}
let profilePhotoObjectUrl='';
async function renderProfilePhoto(){
  const blob=await getProfilePhoto();
  if(profilePhotoObjectUrl){URL.revokeObjectURL(profilePhotoObjectUrl);profilePhotoObjectUrl=''}
  const targets=[el('profilePhotoPreview'),el('heroProfilePhoto'),document.querySelector('.menuAvatar')].filter(Boolean);
  if(blob){
    profilePhotoObjectUrl=URL.createObjectURL(blob);
    targets.forEach(t=>{t.innerHTML='<img src="'+profilePhotoObjectUrl+'" alt="Profile photo">';t.classList.add('hasPhoto')});
  }else{
    const initial=(state.profile?.name||'P').trim().charAt(0).toUpperCase()||'P';
    targets.forEach(t=>{t.innerHTML='<span>'+escapeHtml(initial)+'</span>';t.classList.remove('hasPhoto')});
  }
}
async function savePhotos(){
  const date=el('photoDate').value||today(),files={front:el('photoFront').files[0],side:el('photoSide').files[0],back:el('photoBack').files[0]};
  if(!files.front&&!files.side&&!files.back)return alert('Choose at least one photo.');
  const db=await openPhotoDB(),tx=db.transaction('photos','readwrite'),store=tx.objectStore('photos');
  for(const [pose,file] of Object.entries(files)){if(file)store.put({id:date+'_'+pose,date,pose,blob:file})}
  tx.oncomplete=()=>{db.close();['photoFront','photoSide','photoBack'].forEach(id=>el(id).value='');renderPhotoGallery();alert('Progress photos saved on this device.')};
}
async function deletePhoto(id){
  if(!confirm('Delete this progress photo from this device?'))return;
  const db=await openPhotoDB(),tx=db.transaction('photos','readwrite');tx.objectStore('photos').delete(id);tx.oncomplete=()=>{db.close();renderPhotoGallery()};
}
async function deleteAllPhotos(){
  if(!confirm('Delete ALL progress photos stored on this device? This cannot be undone.'))return;
  try{const db=await openPhotoDB(),tx=db.transaction('photos','readwrite');tx.objectStore('photos').clear();tx.oncomplete=()=>{db.close();renderPhotoGallery()}}catch(e){console.warn(e)}
}
async function renderPhotoGallery(){
  try{
    const db=await openPhotoDB(),tx=db.transaction('photos','readonly'),req=tx.objectStore('photos').getAll();
    req.onsuccess=()=>{
      const items=req.result.sort((a,b)=>b.date.localeCompare(a.date)),groups={};items.forEach(x=>(groups[x.date]??=[]).push(x));
      if(!items.length)el('photoGallery').innerHTML='<div class="emptyState">No progress photos saved yet.</div>';
      else el('photoGallery').innerHTML=Object.entries(groups).map(([date,arr])=>'<div class="photoSet"><strong>'+date+'</strong><div class="photoRow">'+arr.map(x=>'<div class="photoTile"><div class="row"><small>'+x.pose+'</small><button class="photoDelete" onclick="deletePhoto(\''+x.id+'\')">Delete</button></div><img src="'+URL.createObjectURL(x.blob)+'" alt="'+x.pose+' progress photo from '+date+'"></div>').join('')+'</div></div>').join('');
      db.close();
    };
  }catch(e){console.warn(e)}
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
function dashboardMetricIcon(type){
  const paths={
    Steps:'<path d="M8 18c2-3 4-5 7-7l2-4 2 1-1 5-5 5c-2 2-4 3-6 2l-2-1 1-2 2 1Z"/><path d="M13 8l2 2m-5 1 2 2"/>',
    Water:'<path d="M12 3c4 5 6 8 6 11a6 6 0 1 1-12 0c0-3 2-6 6-11Z"/>',
    Calories:'<path d="M13 3c1 4-2 5-2 8 0 2 1 3 3 4 1-3 3-4 3-7 3 3 4 6 3 9-1 3-4 5-8 5s-7-2-8-5c-1-4 2-7 5-9 0 3 1 4 2 5 0-4 3-6 2-10Z"/>',
    Sleep:'<path d="M17 15a7 7 0 0 1-8-9 7 7 0 1 0 8 9Z"/>'
  };return '<svg viewBox="0 0 24 24">'+(paths[type]||'')+'</svg>';
}
function renderTodayMetricsSnapshot(){
  const x=currentLog()||{},metric=state.profile.units==='metric',food=dayFoodTotals(today()),burn=activityCalories(today()),stepGoal=state.profile.stepGoal||8000,waterGoal=state.profile.waterGoalOz||100;
  const calories=x.calories??(food.cal?Math.round(food.cal):null);
  const primary=[
    ['Steps',x.steps?x.steps.toLocaleString():'—',(x.steps&&stepGoal)?Math.min(100,Math.round(x.steps/stepGoal*100)):0,'blue',stepGoal.toLocaleString()+' goal'],
    ['Water',x.water?(metric?(x.water/33.814).toFixed(1)+' L':Math.round(x.water)+' oz'):'—',(x.water&&waterGoal)?Math.min(100,Math.round(x.water/waterGoal*100)):0,'cyan',metric?(waterGoal/33.814).toFixed(1)+' L goal':Math.round(waterGoal)+' oz goal'],
    ['Calories',calories!=null?Math.round(calories).toLocaleString():'—',(calories!=null&&state.macro?.calories)?Math.min(100,Math.round(calories/state.macro.calories*100)):0,'coral',state.macro?.calories?'of '+state.macro.calories.toLocaleString():'daily intake'],
    ['Sleep',x.sleep?x.sleep+' h':'—',(x.sleep&&state.profile.sleepGoal)?Math.min(100,Math.round(x.sleep/state.profile.sleepGoal*100)):0,'violet',(state.profile.sleepGoal||7.5)+'h goal']
  ];
  const html=primary.map(v=>'<div class="snapshotMetric flagshipMetric '+v[3]+'"><span class="flagshipMetricIcon">'+dashboardMetricIcon(v[0])+'</span><span class="metricLabel">'+v[0]+'</span><strong>'+v[1]+'</strong><small>'+v[4]+'</small><b><i style="width:'+v[2]+'%"></i></b></div>').join('');
  if(el('todayMetricsSnapshot'))el('todayMetricsSnapshot').innerHTML=html;
  const full=[
    ['Steps',x.steps?x.steps.toLocaleString():'—'],['Water',x.water?(metric?(x.water/33.814).toFixed(1)+' L':Math.round(x.water)+' oz'):'—'],['Sleep',x.sleep?x.sleep+' h':'—'],
    ['Weight',x.weight?(metric?(x.weight/2.20462).toFixed(1)+' kg':x.weight.toFixed(1)+' lb'):'—'],['Waist',x.waist?(metric?(x.waist*2.54).toFixed(1)+' cm':x.waist.toFixed(1)+' in'):'—'],
    ['Calories',calories!=null?Math.round(calories).toLocaleString():'—'],['Protein',food.p?Math.round(food.p)+' g':'—'],['Adherence',x.adherence!=null?Math.round(x.adherence)+'%':'—'],
    ['Cardio burn',burn?burn+' kcal':'—'],['Resting HR',x.rhr?x.rhr+' bpm':'—'],['Hunger',x.hunger?x.hunger+'/10':'—'],['Energy',x.energy?x.energy+'/10':'—'],
    ['Stress',x.stress?x.stress+'/10':'—'],['Recovery',x.recovery?x.recovery+'/10':'—'],['Digestion',x.digestion?x.digestion+'/10':'—'],['Soreness',x.soreness?x.soreness+'/10':'—']
  ];
  if(el('todayMetricsSnapshotAdvanced'))el('todayMetricsSnapshotAdvanced').innerHTML=full.map(v=>'<div class="snapshotMetric"><span>'+v[0]+'</span><strong>'+v[1]+'</strong></div>').join('');
}
function renderHomeInsight(){
  if(!el('homeInsightTitle'))return;
  const t=trend(),score=dailyScore(),logs=state.logs.filter(x=>x.date>=dateDaysAgo(6));
  let title='Your system is learning you.',text='Keep logging consistently and PhysiqueOS will surface the most useful trend here.';
  if(t&&t.days>=7){
    if(t.adh>=90){title='Consistency is driving the plan.';text='Recent adherence is '+t.adh.toFixed(0)+'%. PhysiqueOS is using that consistency to judge whether your targets actually need to change.'}
    else if(t.adh<80){title='Execution is the biggest lever right now.';text='Recent adherence is '+(t.adh?t.adh.toFixed(0):'below target')+'%. The system will stabilize the plan before making aggressive changes.'}
    else if(Math.abs(t.weekly)>.1){title='Your trend is moving.';text='Observed weight trend is about '+Math.abs(t.weekly).toFixed(2)+' lb/week '+(t.weekly>=0?'down':'up')+'. Multi-week consistency will determine the next adjustment.'}
  }else if(score>=75){title='Today is on track.';text='Your current daily score is '+score+'/100. Keep the basics moving before chasing more complexity.'}
  el('homeInsightTitle').textContent=title;el('homeInsightText').textContent=text;
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
function toggleDenseCard(cls,btn){
  const card=document.querySelector('.'+cls);if(!card)return;
  const open=card.classList.toggle('expanded');
  if(btn)btn.textContent=open?'Hide':(cls==='scheduleCard'?'Customize':'Details');
}
function toggleSnapshot(btn){
  const card=document.querySelector('.quickLogCard');if(!card)return;
  const open=card.classList.toggle('expanded');
  if(btn)btn.textContent=open?'Show less':'View all data';
}
function renderConciergeNow(){
  if(!el('conciergeNowTitle'))return;
  const tasks=adherenceTasks(),next=tasks.find(x=>!x.done),day=dayType(today()),food=dayFoodTotals(today()),r=readinessAdvice();
  const btn=el('conciergeNowButton');
  if(next){el('conciergeNowTitle').textContent=next.title;el('conciergeNowDetail').textContent=next.detail;btn.textContent='Do this now';btn.onclick=()=>showTab(next.tab)}
  else{el('conciergeNowTitle').textContent='You’re covered for today';el('conciergeNowDetail').textContent='Core actions are done. Keep the rest simple and recover well.';btn.textContent='Ask AI Coach';btn.onclick=()=>showTab('coach')}
  el('conciergeTraining').textContent=day.type==='training'?(state.workoutLogs.some(w=>w.date===today()&&w.workout===day.title)?'Done':day.title):day.type==='rest'?'Recovery':'Cardio';
  el('conciergeNutrition').textContent=state.macro?Math.round(food.p)+'/'+state.macro.protein+'g P':'Set target';
  el('conciergeRecovery').textContent=r.score!=null?r.score+'/100':'Log check-in';
}
function renderDashboard(){
  renderSchedule();renderDriftMonitor();renderProfilePhoto();renderConciergeNow();
  if(el('simpleWorkoutLabel')){const d=dayType(today());el('simpleWorkoutLabel').textContent=d.type==='training'?'Start workout':d.type==='rest'?'Recovery day':'Cardio / recovery'}
  const latest=[...state.logs].reverse().find(x=>x.weight),t=trend();
  el('welcome').innerHTML=state.profile.name?'Welcome back,<br><span class="welcomeNameGradient">'+escapeHtml(state.profile.name)+'.</span>':'Build your baseline';
  const metric=state.profile.units==='metric'; el('dashCalories').textContent=state.macro?state.macro.calories:'—';el('dashWeight').textContent=latest?(metric?(latest.weight/2.20462).toFixed(1)+' kg':latest.weight.toFixed(1)+' lb'):state.profile.weight?(metric?(state.profile.weight/2.20462).toFixed(1)+' kg':state.profile.weight.toFixed(1)+' lb'):'—';el('dashAdherence').textContent=t&&t.adh?t.adh.toFixed(0)+'%':'—';if(el('dashStreak'))el('dashStreak').textContent=logStreak()+'d';if(el('dailyScore')){const ds=dailyScore(),ring=el('dailyScore').parentElement;el('dailyScore').textContent=ds||'—';ring.style.setProperty('--score',(ds||0)+'%');const st=ring.querySelector('.scoreStatus');if(st)st.textContent=ds>=90?'Elite':ds>=75?'Strong':ds>=55?'Building':ds?'Recover':'Live'};if(el('timeGreeting')){const h=new Date().getHours();el('timeGreeting').textContent=(h<12?'GOOD MORNING':h<17?'GOOD AFTERNOON':'GOOD EVENING')+'  /  '+(state.profile.goal==='fatloss'?'FAT LOSS':state.profile.goal==='gain'?'MUSCLE GAIN':state.profile.goal==='recomp'?'RECOMP':'MAINTENANCE')} el('homeCoach').textContent=adaptive();renderGettingStarted();renderToday();renderTodayMetricsSnapshot();renderAdjustment();renderHomeInsight();draw('weightChart','weight','Weight');draw('waistChart','waist','Waist');
}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function coachContext(){
  const t=trend(),x=currentLog(),m=state.macro,p=state.profile,work=todaysWorkout(),food=dayFoodTotals(today()),day=dayType(today()),activityKcal=activityCalories(today());
  return{t,x,m,p,work,food,day,activityKcal,readiness:readinessAdvice(),lastWorkout:state.workoutLogs[state.workoutLogs.length-1]||null,flag:recentTrainingFlag()};
}
function coachReply(q){
  const {t,x,m,p,work,food,day,activityKcal,readiness,lastWorkout,flag}=coachContext(),s=q.toLowerCase(),name=p.name?(', '+p.name):'';
  if(s.includes('chest pain')||s.includes('faint')||s.includes('passed out')||s.includes('severe pain'))return'I don’t want to coach through that symptom. Stop the session and get appropriate medical evaluation, especially for chest pain, fainting, trouble breathing, or severe/unusual symptoms.';
  if(s.includes('hungry')||s.includes('hunger'))return'Your hunger'+name+' should be interpreted with adherence and recovery, not in isolation. '+(x?.hunger>=8?'You logged high hunger today. ':'')+(t?.sleep&&t.sleep<6.5?'Sleep has also been low, which can amplify appetite. ':'')+'Keep protein on target, use high-volume produce and lean protein, distribute meals around the hardest part of your day, and don’t cut calories further just because hunger is present.';
  if(s.includes('stall')||s.includes('plateau')||s.includes('scale'))return t?'Your current trend is '+Math.abs(t.weekly).toFixed(2)+' lb/week '+(t.weekly>=0?'down':'up')+' with roughly '+(t.adh?t.adh.toFixed(0):'unknown')+'% adherence. '+(t.days<14?'That is not enough time for a confident plateau call yet. Keep collecting data.':t.adh<85?'I would fix execution before changing the prescription.':getAdjustment()?'Your data qualifies for a small target adjustment. Review the recommendation above.':'I would hold the plan right now; the data does not justify a change.'):'I need at least 7–14 days of weight and adherence data before calling a plateau.';
  if(s.includes('water')||s.includes('hydr'))return'Your current hydration target is '+(p.units==='metric'?((p.waterGoalOz||100)/33.814).toFixed(1)+' L':Math.round(p.waterGoalOz||100)+' oz')+' per day. '+(x?.water?'Today you’ve logged '+(p.units==='metric'?(x.water/33.814).toFixed(1)+' L':Math.round(x.water)+' oz')+'. ':'')+'Use that as a practical baseline and increase intake when heat, sweat, or training demand rises.';
  if(s.includes('step')||s.includes('walk'))return'Your daily step target is '+(p.stepGoal||8000).toLocaleString()+'. '+(x?.steps?'You are at '+x.steps.toLocaleString()+' today. ':'')+(x?.steps<(p.stepGoal||8000)?'A short walk after meals is the easiest way to close the gap without adding much fatigue.':'You’ve reached the target today; more is optional, not mandatory.');
  if(s.includes('tweak')||s.includes('hurt')||s.includes('pain')||s.includes('injur')||s.includes('modify'))return flag?'Your latest training note was '+[flag.exercise||flag.workout,flag.area,flag.sensation,flag.severity?flag.severity+'/10':''].filter(Boolean).join(' • ')+'. '+flagAdvice(flag)+' In Training, use “Analyze & modify from here” and I can automatically reduce stress, substitute the movement, or end the workout based on what you entered. I won’t diagnose the injury.':'Log the area, sensation, severity and what movement triggered it in the Training tab. If pain is sharp, severe, unstable, associated with a pop/snap, numbness/tingling, or worsening weakness, stop loading it and get appropriate clinical evaluation.';
  if(s.includes('sore')||s.includes('recovery')||s.includes('fatigue'))return(t?.recovery&&t.recovery<=4?'Recovery has been trending low. ':'')+'Keep the distinction between normal muscular soreness and injury-type pain. For normal soreness, preserve movement, sleep, protein and hydration, and reduce training effort if performance is clearly suppressed. Sharp, unstable, or worsening pain should not be trained through.';
  if(s.includes('cardio'))return day.type==='training'?'Today is a lifting day. Keep optional cardio easy unless it is specifically programmed so it does not compete with the session.':cardioPrescription().title+': '+cardioPrescription().text+(activityKcal?' You have logged about '+activityKcal+' exercise kcal today.':'');
  if(s.includes('rest day')||s.includes('recovery day'))return day.type==='training'?'Today is currently a programmed lifting day. If recovery is unusually poor, use your Recovery score and symptoms to decide whether to reduce volume or move the session rather than forcing it.':cardioPrescription().text;
  if(s.includes('missed')||s.includes('skip')||s.includes('workout'))return work?'Today’s programmed session is '+work.name+'. If you missed a prior session, don’t double up as punishment. Move the highest-priority session forward and continue the sequence; cut low-priority isolation volume before compressing recovery.':'Today is not a programmed lifting day. Use the cardio/recovery recommendation in Log rather than inventing an extra lifting session.';
  if(s.includes('meal')||s.includes('food')||s.includes('macro')||s.includes('protein'))return m?'Your target is '+m.calories+' kcal with '+m.protein+'g protein, '+m.carbs+'g carbs and '+m.fat+'g fat. Today you have logged '+Math.round(food.cal)+' kcal, '+Math.round(food.p)+'g protein, '+Math.round(food.c)+'g carbs and '+Math.round(food.f)+'g fat. '+(food.cal<m.calories?'You have about '+Math.max(0,Math.round(m.calories-food.cal))+' kcal remaining. ':'You are at or above the calorie target, so focus on accuracy rather than forcing extra food.')+' Use the Log tab for actual intake and the Meals tab for planning.':'Complete your profile first so I can coach against an actual calorie and macro target.';
  if(s.includes('travel')||s.includes('restaurant'))return'For travel, simplify the hierarchy: protein first, stay reasonably near calories, keep steps up, hydrate, and choose meals you can estimate. One imperfect travel meal matters far less than turning the entire trip into an untracked stretch.';
  if(s.includes('adjust')||s.includes('calorie')||s.includes('change plan')){const adj=getAdjustment();return adj?'Based on your logged trend and adherence, I’d propose '+(adj.delta>0?'+':'')+adj.delta+' kcal/day, bringing you to about '+adj.next+' kcal. You can apply that recommendation above.':'I would not adjust calories yet. The current data does not meet the beta’s threshold for a justified change.'}
  if(s.includes('ready')||s.includes('readiness')||s.includes('train today'))return readiness.title+': '+readiness.text;
  if(s.includes('rpe')||s.includes('rir'))return'Use RIR set by set because effort drifts as fatigue accumulates. For hypertrophy, the useful question is “how many clean reps were left?” PhysiqueOS converts that to approximate RPE automatically. Then rate one Session RPE after the workout to capture total difficulty. That gives useful detail without making you enter two redundant effort scores for every set.';
  if(s.includes('execute this exercise')||s.includes('what should i feel')||s.includes('why is this exercise')){const item=work?.items?.[0];if(!item)return'Open your programmed workout and use the Execution guide inside each exercise. It shows setup, execution, key cues, target muscles and common mistakes.';const g=exerciseGuide(item);return item.name+' targets '+g.target+'. Setup: '+g.setup+' Execution: '+g.execute+' Key cues: '+g.cues.join(', ')+'.';}
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
function importData(inp){const f=inp.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{state=JSON.parse(r.result);state.profile=state.profile||{};state.logs=state.logs||[];state.mealPlan=state.mealPlan||[];state.trainingPlan=state.trainingPlan||[];state.workoutLogs=state.workoutLogs||[];state.coachMessages=state.coachMessages||[];state.foodLogs=state.foodLogs||[];state.activityLogs=state.activityLogs||[];state.recoveryLogs=state.recoveryLogs||[];state.mealPrefs=state.mealPrefs||{meals:Number(state.profile?.meals)||4,snacks:1,distribution:'balanced'};state.dayMealPrefs=state.dayMealPrefs||{};state.trainingFlags=state.trainingFlags||[];state.trainingDrafts=state.trainingDrafts||{};state.favoriteFoods=state.favoriteFoods||[];state.foodDayTemplates=state.foodDayTemplates||[];state.foodWeekTemplates=state.foodWeekTemplates||[];state.workoutFavorites=state.workoutFavorites||[];state.schedule=state.schedule||{wake:'07:00',checkin:'07:15',meal:'08:00',workout:'17:30',bed:'23:00',mealGap:4,mode:'lifestyle',reminder:15};state.timezone=deviceTimezone();state.driftControls=state.driftControls||{sensitivity:'balanced',adherence:85,gap:2,stall:21};state.rescueMode=state.rescueMode||null;state.driftDismissedUntil=state.driftDismissedUntil||null;state.notificationSettings=state.notificationSettings||{checkin:true,meals:true,workout:true,steps:true,hydration:true,drift:true,recovery:true,quietStart:'22:30',quietEnd:'07:00',escalation:'balanced'};state.notifications=state.notifications||[];state.notificationSent=state.notificationSent||{};save();renderAll();alert('Backup imported.')}catch(e){alert('Invalid backup.')}};r.readAsText(f)}
async function resetAll(){
  if(!confirm('Erase ALL local PhysiqueOS data on this device, including progress photos? This cannot be undone.'))return;
  localStorage.removeItem('physiqueOS');
  try{await new Promise(resolve=>{const req=indexedDB.deleteDatabase('PhysiqueOSPhotos');req.onsuccess=req.onerror=req.onblocked=()=>resolve()})}catch(e){}
  location.reload();
}
function renderAll(){loadProfile();loadSchedule();loadDriftControls();loadNotificationSettings();renderDashboard();renderNutrition();renderMeals();renderTraining();renderReadiness();renderHistory();renderFoodDiary();renderRecentFoods();renderSavedNutrition();loadDailyMetrics();renderActivityHistory();renderDayRecommendation();renderRecoveryHistory();previewActivityBurn();renderCoachChat();renderFaqQuestions();renderAdjustment();renderWeeklyReview();renderPhotoGallery();renderNotificationCenter();renderMenuProfile();syncRangeOutputs();if(el('logDayScore'))el('logDayScore').textContent=dailyScore()}
document.body.dataset.view='dashboard';
renderAll();
if(el('coachInput'))el('coachInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendCoachMessage()}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeAppMenu();if(el('notificationCenter'))el('notificationCenter').classList.add('hidden')}});
setInterval(()=>{if(el('timezoneStatus'))renderSchedule();processSmartReminders()},60000);
setTimeout(processSmartReminders,2500);
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js?v=52').then(r=>r.update()).catch(()=>{});