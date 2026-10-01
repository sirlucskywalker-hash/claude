import Stripe from "npm:stripe@22.6.0";
import {createClient} from "npm:@supabase/supabase-js@2.57.4";
import {corsHeaders,json,configured} from "../_shared/cors.ts";
import {returnUrl} from "../_shared/billing-logic.mjs";
import {validatePortalPolicy} from "../_shared/portal-policy.mjs";
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response(null,{headers:corsHeaders(req)});
  if(req.method!=="POST")return json(req,{error:"Method not allowed"},405);
  if(!configured()||!Deno.env.get("STRIPE_PORTAL_CONFIGURATION_ID"))return json(req,{error:"Billing setup is not complete"},503);
  try{
    const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token=req.headers.get("Authorization")?.replace(/^Bearer /i,"");
    if(!token)return json(req,{error:"Sign in first"},401);
    const {data:{user},error:authError}=await admin.auth.getUser(token);
    if(authError||!user)return json(req,{error:"Sign in first"},401);
    const {data:billing,error}=await admin.from("billing_customers").select("stripe_customer_id").eq("user_id",user.id).maybeSingle();
    if(error)throw error;
    if(!billing)return json(req,{error:"No paid subscription yet"},404);
    const body=await req.json();
    const stripe=new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
    const configurationId=Deno.env.get("STRIPE_PORTAL_CONFIGURATION_ID")!;
    validatePortalPolicy(await stripe.billingPortal.configurations.retrieve(configurationId));
    const session=await stripe.billingPortal.sessions.create({
      customer:billing.stripe_customer_id,configuration:configurationId,return_url:returnUrl(body.returnUrl,Deno.env.get("SITE_URL"))
    });
    return json(req,{url:session.url});
  }catch(error){
    console.error("portal failed",error instanceof Error?error.name:"unknown");
    return json(req,{error:"Billing portal unavailable"},500);
  }
});
