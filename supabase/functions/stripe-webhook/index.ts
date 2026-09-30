import Stripe from "npm:stripe";
import { createClient } from "npm:@supabase/supabase-js";

const stripe=new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

async function syncSubscription(sub: Stripe.Subscription) {
  const userId = sub.metadata?.supabase_user_id;
  let resolvedUserId=userId;

  if(!resolvedUserId && typeof sub.customer==="string") {
    const {data} = await admin.from("billing_customers").select("user_id").eq("stripe_customer_id",sub.customer).maybeSingle();
    resolvedUserId=data?.user_id;
  }
  if(!resolvedUserId) throw new Error("No user mapping for subscription");

  const item=sub.items.data[0];
  await admin.from("subscriptions").upsert({
    user_id:resolvedUserId,
    stripe_subscription_id:sub.id,
    stripe_price_id:item?.price?.id ?? null,
    status:sub.status,
    current_period_start:new Date(sub.current_period_start*1000).toISOString(),
    current_period_end:new Date(sub.current_period_end*1000).toISOString(),
    cancel_at_period_end:sub.cancel_at_period_end,
    trial_end:sub.trial_end ? new Date(sub.trial_end*1000).toISOString() : null,
    updated_at:new Date().toISOString()
  },{onConflict:"stripe_subscription_id"});

  const active=["active","trialing"].includes(sub.status);
  await admin.from("entitlements").upsert({
    user_id:resolvedUserId,
    code:"app_access",
    source:"stripe",
    active,
    ends_at: active ? new Date(sub.current_period_end*1000).toISOString() : new Date().toISOString(),
    metadata:{stripe_subscription_id:sub.id,price_id:item?.price?.id}
  },{onConflict:"user_id,code,source"});
}

Deno.serve(async (req) => {
  const sig=req.headers.get("stripe-signature");
  if(!sig) return new Response("Missing signature",{status:400});

  const body=await req.text();
  let event: Stripe.Event;
  try {
    event=await stripe.webhooks.constructEventAsync(body,sig,Deno.env.get("STRIPE_WEBHOOK_SECRET")!);
  } catch(e) {
    return new Response("Invalid signature",{status:400});
  }

  const {data:existing}=await admin.from("billing_events").select("stripe_event_id,processed_at").eq("stripe_event_id",event.id).maybeSingle();
  if(existing?.processed_at) return new Response("already processed",{status:200});

  await admin.from("billing_events").upsert({stripe_event_id:event.id,event_type:event.type,payload:event});

  try {
    if([
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted"
    ].includes(event.type)) {
      await syncSubscription(event.data.object as Stripe.Subscription);
    }

    await admin.from("billing_events").update({processed_at:new Date().toISOString(),error:null}).eq("stripe_event_id",event.id);
    return new Response("ok",{status:200});
  } catch(e) {
    await admin.from("billing_events").update({error:String(e?.message||e)}).eq("stripe_event_id",event.id);
    return new Response("processing failed",{status:500});
  }
});
