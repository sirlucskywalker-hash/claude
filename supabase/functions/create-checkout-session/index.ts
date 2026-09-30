import Stripe from "npm:stripe";
import { createClient } from "npm:@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";

const PRICE_MAP: Record<string,string> = {
  core_monthly: "price_1ULEM2QbcyKGduUYuINH0jFU",
  core_annual: "price_1ULEMNQbcyKGduUYXezyDSib",
  founding_monthly: "price_1ULEMPQbcyKGduUYCWAHIjpJ",
  pro_monthly: "price_1ULEMRQbcyKGduUYetoaBdCp",
  pro_annual: "price_1ULEMTQbcyKGduUYifT3HsuZ",
  elite_monthly: "price_1ULEMVQbcyKGduUYrYLJL0gy",
  elite_annual: "price_1ULEMXQbcyKGduUYS53pcpuR",
  concierge_monthly: "price_1ULEMZQbcyKGduUYXuZhd1UM"
};

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

    const {planCode, successUrl, cancelUrl} = await req.json();
    const priceId = PRICE_MAP[planCode];
    if (!priceId) throw new Error("Invalid plan");

    const admin = createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);

    let {data:billing} = await admin.from("billing_customers").select("stripe_customer_id").eq("user_id",user.id).maybeSingle();
    let customerId = billing?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email:user.email,
        metadata:{supabase_user_id:user.id}
      });
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
      subscription_data:{
        metadata:{
          supabase_user_id:user.id,
          physiqueos_plan_code:planCode
        }
      }
    });

    return Response.json({url:session.url},{headers:corsHeaders});
  } catch (e) {
    return Response.json({error:String(e?.message||e)},{status:400,headers:corsHeaders});
  }
});
