import {corsHeaders,json} from './cors.ts';
import {validateVideoRequest,validateReport,providerPayload,responseText} from './video-assessment-logic.mjs';
export function createVideoAssessmentHandler({env,createClient,engine:E,fetch:fetchFn=globalThis.fetch}){
 return async(req)=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:corsHeaders(req)});
 if(req.method!=='POST')return json(req,{error:'Method not allowed'},405);
 const authorization=req.headers.get('Authorization');
 if(!authorization?.startsWith('Bearer '))return json(req,{error:'Sign in first'},401);
 const url=env('SUPABASE_URL'),anon=env('SUPABASE_ANON_KEY');
 const client=createClient(url,anon,{global:{headers:{Authorization:authorization}}});
 const {data:{user},error:authError}=await client.auth.getUser(authorization.slice(7));
 if(authError||!user)return json(req,{error:'Sign in first'},401);
 if(!user.email_confirmed_at)return json(req,{error:'Confirm your email first'},403);
 const [feature,owner]=await Promise.all([client.rpc('has_feature',{feature:'ai_video_assessment'}),client.rpc('is_physiqueos_owner')]);
 if(feature.error||owner.error)return json(req,{error:'Access verification unavailable'},503);
 if(!feature.data&&!owner.data)return json(req,{error:'Premium AI video access is unavailable for this account'},403);
 const key=env('OPENAI_API_KEY'),model=env('AI_VIDEO_MODEL');
 if(env('AI_VIDEO_ENABLED')!=='true'||!key||!model||!env('SITE_URL'))return json(req,{error:'Premium AI video is awaiting configuration and validation'},503);
 let jobId,admin;
 try{
  const text=await req.text();if(text.length>1200000)return json(req,{error:'Video request too large'},413);
  const body=validateVideoRequest(JSON.parse(text));
  const {data:snapshot,error:snapshotError}=await client.from('user_state_snapshots').select('state').eq('user_id',user.id).maybeSingle();
  if(snapshotError||!snapshot?.state?.startingAssessment)return json(req,{error:'Save and synchronize your written assessment first'},409);
  const written=E.validate(snapshot.state.startingAssessment.answers),screen=E.evaluate(written,snapshot.state.profile||{});
  if(screen.paused)return json(req,{error:'Your written screening needs review before a video assessment'},409);
  const {data:reservation,error:reserveError}=await client.rpc('reserve_ai_video_assessment',{request_id:body.requestId,written,camera_view:body.view,consent:body.consent});
  if(reserveError)return json(req,{error:reserveError.message},409);
  if(!reservation.created)return reservation.status==='needs_review'?json(req,{report:reservation.report,status:'needs_review'}):json(req,{error:'This assessment request already exists; refresh its recorded status'},409);
  jobId=body.requestId;admin=createClient(url,env('SUPABASE_SERVICE_ROLE_KEY'));
  const response=await fetchFn('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(providerPayload(model,body,written)),signal:AbortSignal.timeout(40000)});
  if(!response.ok)throw Error('Provider unavailable');
  const report=validateReport(JSON.parse(responseText(await response.json())));
  const {error}=await admin.from('assessment_records').update({report,status:'needs_review',completed_at:new Date().toISOString()}).eq('id',jobId).eq('user_id',user.id);
  if(error)throw Error('Report save failed');
  return json(req,{report,status:'needs_review'});
 }catch{
  if(jobId&&admin)await admin.from('assessment_records').update({status:'failed',completed_at:new Date().toISOString()}).eq('id',jobId).eq('user_id',user.id);
  return json(req,{error:'Video assessment unavailable. Your written assessment remains saved; no program was changed.'},503);
 }
 };
}
