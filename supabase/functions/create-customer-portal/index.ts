import Stripe from "npm:stripe";
import { createClient } from "npm:@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok",{headers:corsHeaders});
  try {
    const auth=req.headers.get("Authorization");
    if(!auth) throw new Error("Missing authorization");
    const supabase=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:auth}}});
    const {data:{user}}=await supabase.auth.getUser();
    if(!user) throw new Error("Unauthorized");

    const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const {data:billing}=await admin.from("billing_customers").select("stripe_customer_id").eq("user_id",user.id).single();
    if(!billing) throw new Error("Billing customer not found");

    const stripe=new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
    const body=await req.json().catch(()=>({}));
    const session=await stripe.billingPortal.sessions.create({
      customer:billing.stripe_customer_id,
      return_url:body.returnUrl || Deno.env.get("SITE_URL")!
    });
    return Response.json({url:session.url},{headers:corsHeaders});
  } catch(e) {
    return Response.json({error:String(e?.message||e)},{status:400,headers:corsHeaders});
  }
});
