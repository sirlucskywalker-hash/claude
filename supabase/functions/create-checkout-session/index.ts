import Stripe from "npm:stripe";
import { createClient } from "npm:@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok",{headers:corsHeaders});
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) throw new Error("Missing authorization");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {global:{headers:{Authorization:auth}}}
    );
    const {data:{user}} = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const {priceId, successUrl, cancelUrl} = await req.json();
    const allowed = [Deno.env.get("STRIPE_PRICE_MONTHLY"),Deno.env.get("STRIPE_PRICE_ANNUAL"),Deno.env.get("STRIPE_PRICE_BETA")].filter(Boolean);
    if (!allowed.includes(priceId)) throw new Error("Invalid price");

    const admin = createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);

    let {data:billing} = await admin.from("billing_customers").select("stripe_customer_id").eq("user_id",user.id).maybeSingle();
    let customerId = billing?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({email:user.email,metadata:{supabase_user_id:user.id}});
      customerId = customer.id;
      await admin.from("billing_customers").insert({user_id:user.id,stripe_customer_id:customerId});
    }

    const session = await stripe.checkout.sessions.create({
      mode:"subscription",
      customer:customerId,
      line_items:[{price:priceId,quantity:1}],
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes:true,
      subscription_data:{metadata:{supabase_user_id:user.id}}
    });

    return Response.json({url:session.url},{headers:corsHeaders});
  } catch (e) {
    return Response.json({error:String(e?.message||e)},{status:400,headers:corsHeaders});
  }
});
