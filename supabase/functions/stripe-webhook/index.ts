import Stripe from "npm:stripe@22.6.0";
import {createClient} from "npm:@supabase/supabase-js@2.57.4";
import {subscriptionId,normalizeSubscription} from "../_shared/billing-logic.mjs";
Deno.serve(async(req)=>{
  if(req.method!=="POST")return new Response("Method not allowed",{status:405});
  const key=Deno.env.get("STRIPE_SECRET_KEY"),secret=Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if(!key||!secret)return new Response("Billing setup incomplete",{status:503});
  const signature=req.headers.get("stripe-signature");
  if(!signature)return new Response("Missing signature",{status:400});
  const stripe=new Stripe(key);
  let event: Stripe.Event;
  try{event=await stripe.webhooks.constructEventAsync(await req.text(),signature,secret);}
  catch{return new Response("Invalid signature",{status:400});}
  const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try{
    const id=subscriptionId(event);
    if(id){
      const sub=normalizeSubscription(await stripe.subscriptions.retrieve(id));
      const {error}=await admin.rpc("record_billing_subscription",{
        event_id:event.id,event_type:event.type,event_created:event.created,event_payload:event,sub
      });
      if(error)throw error;
    }else{
      const {error}=await admin.from("billing_events").upsert({
        stripe_event_id:event.id,event_type:event.type,payload:event,processed_at:new Date().toISOString()
      },{onConflict:"stripe_event_id",ignoreDuplicates:true});
      if(error)throw error;
    }
    return new Response("ok",{status:200});
  }catch(error){
    console.error("billing event failed",event.id,error instanceof Error?error.name:"database");
    return new Response("Processing failed",{status:500});
  }
});
