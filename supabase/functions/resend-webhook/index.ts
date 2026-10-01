import {createClient} from 'npm:@supabase/supabase-js@2.57.4';
import {Webhook} from 'npm:svix@1.76.1';
Deno.serve(async req=>{
 if(req.method!=='POST')return new Response('Method not allowed',{status:405});
 const secret=Deno.env.get('RESEND_WEBHOOK_SECRET');if(!secret)return new Response('Email webhook setup incomplete',{status:503});
 let event:any;
 try{event=new Webhook(secret).verify(await req.text(),{'svix-id':req.headers.get('svix-id')||'','svix-timestamp':req.headers.get('svix-timestamp')||'','svix-signature':req.headers.get('svix-signature')||''});}
 catch{return new Response('Invalid signature',{status:400});}
 if(!['email.sent','email.delivered','email.delivery_delayed','email.failed','email.bounced','email.complained'].includes(event.type))return new Response('Ignored',{status:200});
 if(!event.data?.email_id||!Array.isArray(event.data.to)||event.data.to.length>50)return new Response('Invalid event',{status:400});
 const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
 const {error}=await admin.rpc('record_lifecycle_delivery',{event_id:req.headers.get('svix-id'),message_id:event.data.email_id,event_type:event.type,recipients:event.data.to});
 if(error)return new Response('Processing failed',{status:500});
 return new Response('ok');
});
