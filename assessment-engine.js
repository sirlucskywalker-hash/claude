/* Written screening rules and camera-dependent pose observations. No diagnoses. */
(function(root){
 'use strict';
 const enums={experience:['new','returning','consistent'],breakLength:['none','short','long'],pain:['no','yes','unsure'],injury:['none','resolved','restricted','unreviewed'],mobility:['comfortable','limited','assisted'],symptoms:['no','yes','unsure'],condition:['no','yes','unsure']};
 function validate(input){
  if(!input||typeof input!=='object')throw Error('Complete the written assessment first.');
  const a={};for(const [key,values] of Object.entries(enums)){if(!values.includes(input[key]))throw Error('Answer every assessment question.');a[key]=input[key];}
  for(const [key,min,max] of [['days',1,6],['minutes',15,90]]){const n=Number(input[key]);if(!Number.isInteger(n)||n<min||n>max)throw Error('Check your available days and minutes.');a[key]=n;}
  a.notes=String(input.notes||'').trim();if(a.notes.length>3000)throw Error('Keep assessment notes within 3,000 characters.');
  a.areas=Array.isArray(input.areas)?[...new Set(input.areas)]:[];
  if(a.areas.some(x=>!['shoulder','elbow','wrist','low back','hip','knee','ankle'].includes(x)))throw Error('Unknown movement limitation.');
  return a;
 }
 function evaluate(input,profile={}){
  if(!input)return null;
  let a;try{a=validate(input);}catch{return {paused:true,videoAllowed:false,label:'Assessment incomplete',reasons:['Update your assessment before generating a new program.']};}
  const reasons=[];
  if(a.symptoms!=='no'||profile.redFlag)reasons.push('Symptoms such as chest discomfort, unusual breathlessness, fainting or unexplained weakness need medical evaluation before exercise testing. If severe or happening now, seek urgent care.');
  if(a.condition!=='no')reasons.push('Ask your clinician about exercise guidance for the condition you reported. This app cannot establish medical clearance.');
  if(a.pain!=='no'||profile.acuteInjury)reasons.push('Pain or a possible acute injury needs appropriate review before automated loading or movement testing.');
  if(['restricted','unreviewed'].includes(a.injury))reasons.push('Injury-specific programming needs a clinician-provided plan and qualified review. Written restrictions are saved for review, not interpreted as clearance.');
  if(a.mobility==='assisted')reasons.push('Arrange an accessible, supervised assessment for movements that require assistance or feel unstable. No balance or mobility challenge is prescribed here.');
  const cautious=a.experience!=='consistent'||a.breakLength==='long'||a.mobility==='limited'||a.injury==='resolved';
  return {paused:reasons.length>0,videoAllowed:reasons.length===0,label:reasons.length?'Review before programming':cautious?'Gradual starting plan':'Current training baseline',reasons,
   days:Math.min(a.days,Number(profile.days)||a.days,cautious?3:6),minutes:Math.min(a.minutes,Number(profile.sessionLength)||a.minutes),maxSets:cautious?2:4,minRir:cautious?4:2,beginner:cautious,
   areas:a.areas,reviewAfter:'Reassess after two weeks, or sooner if symptoms, restrictions or tolerance change.'};
 }
 function angle(a,b,c,w=1,h=1){
  const p=[(a.x-b.x)*w,(a.y-b.y)*h],q=[(c.x-b.x)*w,(c.y-b.y)*h],d=Math.hypot(...p)*Math.hypot(...q);
  if(!d||!Number.isFinite(d))return null;return Math.acos(Math.max(-1,Math.min(1,(p[0]*q[0]+p[1]*q[1])/d)))*180/Math.PI;
 }
 function summarize(frames,width,height,view='side'){
  const triples={leftElbow:[11,13,15],rightElbow:[12,14,16],leftKnee:[23,25,27],rightKnee:[24,26,28]};
  const ranges=Object.fromEntries(Object.keys(triples).map(k=>[k,[]]));let usable=0,multiple=0;
  for(const poses of frames){
   if(poses?.length>1){multiple++;continue;}const p=poses?.[0];if(!p||p.length<33)continue;
   let valid=false;
   for(const [name,indices] of Object.entries(triples)){
    const points=indices.map(i=>p[i]);
    if(points.some(x=>!x||!Number.isFinite(x.x)||!Number.isFinite(x.y)||(x.visibility??0)<.8||x.x<.02||x.x>.98||x.y<.02||x.y>.98))continue;
    const n=angle(...points,width,height);if(n!==null){ranges[name].push(n);valid=true;}
   }
   if(valid)usable++;
  }
  const enough=frames.length>=10&&usable/frames.length>=.7&&multiple===0;
  const jointMotion=Object.fromEntries(Object.entries(ranges).filter(([,v])=>enough&&view==='side'&&v.length>=10).map(([k,v])=>[k,{sampledFrames:v.length,projectedAngleSpanDegrees:Math.round((Math.max(...v)-Math.min(...v))/5)*5}]));
  return {version:1,method:'mediapipe-pose-lite-local',sampledFrames:frames.length,usableFrames:usable,multiplePersonFrames:multiple,quality:enough?'preliminary':'insufficient',view,jointMotion,
   limitations:'Camera-dependent 2D pose observations, not clinical range of motion, strength, diagnosis, injury risk, or clearance. They do not override your written screening or change your program automatically.'};
 }
 root.PhysiqueAssessment={validate,evaluate,angle,summarize};
})(globalThis);
