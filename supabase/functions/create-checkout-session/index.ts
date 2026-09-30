import Stripe from "npm:stripe@22.6.0";
import {createClient} from "npm:@supabase/supabase-js@2.57.4";
import {corsHeaders,json,configured} from "../_shared/cors.ts";
import {returnUrl} from "../_shared/billing-logic.mjs";
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response(null,{headers:corsHeaders(req)});
  if(req.method!=="POST")return json(req,{error:"Method not allowed"},405);
  if(!configured())return json(req,{error:"Billing setup is not complete"},503);
  const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let reservation: string|null=null;
  try{
    const token=req.headers.get("Authorization")?.replace(/^Bearer /i,"");
    if(!token)return json(req,{error:"Sign in first"},401);
    const {data:{user},error:authError}=await admin.auth.getUser(token);
    if(authError||!user)return json(req,{error:"Sign in first"},401);
    if(!user.email_confirmed_at)return json(req,{error:"Confirm your email first"},403);
    const raw=await req.text();
    if(raw.length>4096)return json(req,{error:"Request too large"},413);
    const body=JSON.parse(raw);
    const match=/^(core|founding|pro|elite|concierge)_(monthly|annual)$/.exec(body.planCode||"");
    if(!match)return json(req,{error:"Invalid plan"},400);
    const [,tier,cadence]=match;
    const success=returnUrl(body.successUrl,Deno.env.get("SITE_URL"));
    const cancel=returnUrl(body.cancelUrl,Deno.env.get("SITE_URL"));
    const {data:plan,error:planError}=await admin.from("plan_catalog").select("*").eq("code",tier).single();
    if(planError||!plan?.public)return json(req,{error:"This tier is not open for enrollment"},409);
    const priceId=cadence==="annual"?plan.stripe_annual_price_id:plan.stripe_monthly_price_id;
    if(!priceId)return json(req,{error:"Billing interval unavailable"},400);
    const {data:rid,error:reserveError}=await admin.rpc("reserve_checkout",{target_user:user.id,tier});
    if(reserveError)return json(req,{error:reserveError.message},409);
    reservation=rid;
    const stripe=new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
    const {data:billing,error:billingError}=await admin.from("billing_customers").select("stripe_customer_id").eq("user_id",user.id).maybeSingle();
    if(billingError)throw billingError;
    let customerId=billing?.stripe_customer_id;
    if(!customerId){
      const customer=await stripe.customers.create({email:user.email,metadata:{supabase_user_id:user.id}},{idempotencyKey:"physiqueos-customer-"+user.id});
      customerId=customer.id;
      const {error}=await admin.from("billing_customers").upsert({user_id:user.id,stripe_customer_id:customerId},{onConflict:"user_id"});
      if(error)throw error;
    }
    const session=await stripe.checkout.sessions.create({
      mode:"subscription",customer:customerId,line_items:[{price:priceId,quantity:1}],
      success_url:success,cancel_url:cancel,expires_at:Math.floor(Date.now()/1000)+1800,
      integration_identifier:"physiqueos_checkout_mqstbkrz",client_reference_id:user.id,
      metadata:{reservation_id:rid},
      subscription_data:{metadata:{supabase_user_id:user.id,physiqueos_tier:tier,reservation_id:rid}}
    },{idempotencyKey:"physiqueos-checkout-"+rid});
    const {error}=await admin.from("checkout_reservations").update({stripe_session_id:session.id}).eq("id",rid);
    if(error){await stripe.checkout.sessions.expire(session.id);throw error;}
    return json(req,{url:session.url});
  }catch(error){
    if(reservation)await admin.from("checkout_reservations").update({state:"expired"}).eq("id",reservation);
    console.error("checkout failed",error instanceof Error?error.name:"unknown");
    return json(req,{error:"Checkout unavailable. Please try again."},500);
  }
});
