import {createClient} from 'npm:@supabase/supabase-js@2.57.4';
import {lifecycleEmail,retryStatus} from '../_shared/lifecycle-logic.mjs';
Deno.serve(async req=>{
 if(req.method!=='POST')return new Response('Method not allowed',{status:405});
 const secret=Deno.env.get('LIFECYCLE_WORKER_SECRET');
 if(!secret||secret.length<32||!Deno.env.get('RESEND_API_KEY')||!Deno.env.get('FROM_EMAIL')||!Deno.env.get('SITE_URL'))return new Response('Email setup incomplete',{status:503});
 if(req.headers.get('x-worker-token')!==secret)return new Response('Unauthorized',{status:401});
 const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
 try{
  // Validate templates before claiming jobs, so configuration faults cannot consume retries.
  lifecycleEmail({payload:{title:'Check',body:'Check'}},Deno.env.get('SITE_URL'));
  const {error:nudgeError}=await admin.rpc('queue_retention_nudges');if(nudgeError)throw nudgeError;
  const {data:jobs,error}=await admin.rpc('claim_lifecycle_emails');if(error)throw error;
  let accepted=0;
  for(const job of jobs){
   let status='failed',providerId=null,code=null;
   if(job.suppressed||!job.confirmed||!job.email){status='suppressed';code=job.suppressed?'suppressed_address':'unverified_account';}
   else try{
    const content=lifecycleEmail(job,Deno.env.get('SITE_URL'));
    const response=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(10000),headers:{Authorization:'Bearer '+Deno.env.get('RESEND_API_KEY'),'Content-Type':'application/json','Idempotency-Key':'physiqueos-'+job.id},body:JSON.stringify({from:Deno.env.get('FROM_EMAIL'),to:[job.email],...content})});
    if(response.ok){const result=await response.json();if(!result.id)throw new Error('Missing message ID');status='sent';providerId=result.id;accepted++;}
    else {status=retryStatus(response.status);code='provider_http_'+response.status;}
   }catch{status='pending';code='provider_network_or_response';}
   const {error:finishError}=await admin.rpc('finish_lifecycle_email',{job_id:job.id,lease:job.lease_token,result_status:status,message_id:providerId,failure_code:code});if(finishError)throw finishError;
  }
  return Response.json({processed:jobs.length,accepted});
 }catch{console.error('Lifecycle queue processing failed');return new Response('Processing failed',{status:500});}
});
