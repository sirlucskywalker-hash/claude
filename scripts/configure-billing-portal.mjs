// Operator-only configuration. Does not charge customers or change existing subscriptions.
import {portalConfiguration} from '../supabase/functions/_shared/portal-policy.mjs';
const required=['STRIPE_SECRET_KEY','STRIPE_PRODUCT_PHYSIQUEOS','SITE_URL','STRIPE_PRICE_CORE_MONTHLY','STRIPE_PRICE_CORE_ANNUAL','STRIPE_PRICE_PRO_MONTHLY','STRIPE_PRICE_PRO_ANNUAL','STRIPE_PRICE_ELITE_MONTHLY','STRIPE_PRICE_ELITE_ANNUAL'];
if(required.some(k=>!process.env[k]))throw new Error('Load required server environment values before configuring billing');
const policy=portalConfiguration({product:process.env.STRIPE_PRODUCT_PHYSIQUEOS,prices:required.filter(k=>k.startsWith('STRIPE_PRICE_')).map(k=>process.env[k]),siteUrl:process.env.SITE_URL});
const form=new URLSearchParams();
function encode(value,path){if(value&&typeof value==='object')for(const [key,v]of Object.entries(value))encode(v,path?path+'['+key+']':key);else form.append(path,String(value));}
encode(policy,'');
const response=await fetch('https://api.stripe.com/v1/billing_portal/configurations',{method:'POST',signal:AbortSignal.timeout(20000),headers:{Authorization:'Bearer '+process.env.STRIPE_SECRET_KEY,'Content-Type':'application/x-www-form-urlencoded','Stripe-Version':'2026-08-26.dahlia'},body:form});
const result=await response.json();if(!response.ok)throw new Error('Portal configuration failed: '+(result.error?.type||response.status));
console.log('Set STRIPE_PORTAL_CONFIGURATION_ID='+result.id+' in Edge Function secrets. Verify policy in the sandbox before opening enrollment.');
