// Operator-only. Defaults to a local dry run; writes require explicit environment selection.
import {portalConfiguration,portalProductsFromPrices} from '../supabase/functions/_shared/portal-policy.mjs';
const args=process.argv.slice(2);
if(args.length>1||args.some(a=>!['--dry-run','--apply-test','--apply-live'].includes(a)))throw new Error('Use --dry-run (default), --apply-test or --apply-live');
const apply=args[0]?.startsWith('--apply-'),livemode=args[0]==='--apply-live';
const plans=[['CORE_MONTHLY',2900,'month'],['CORE_ANNUAL',29000,'year'],['PRO_MONTHLY',5900,'month'],['PRO_ANNUAL',49900,'year'],['ELITE_MONTHLY',11900,'month'],['ELITE_ANNUAL',99900,'year']];
if(!apply){
 console.log(JSON.stringify({mode:'dry-run',network_requests:0,plans:plans.map(([code,amount,interval])=>({code,amount,currency:'usd',interval})),policy:'Prorated upgrades; period-end downgrades and cancellation',next:'Load server-only environment values and use --apply-test. Live configuration requires --apply-live.'},null,2));
}else{
 const key=process.env.STRIPE_SECRET_KEY;
 if(!new RegExp('^(sk|rk)_'+(livemode?'live':'test')+'_').test(key||''))throw new Error('Stripe key does not match the explicitly selected environment');
 if(!process.env.SITE_URL||plans.some(([code])=>!/^price_/.test(process.env['STRIPE_PRICE_'+code]||'')))throw new Error('Load SITE_URL and six Core/Pro/Elite price IDs');
 const site=new URL(process.env.SITE_URL);if(site.protocol!=='https:'||site.username||site.password||site.search||site.hash)throw new Error('A clean HTTPS application URL is required');
 const headers={Authorization:'Bearer '+key,'Stripe-Version':'2026-08-26.dahlia'};
 async function request(path,options={}){
  const response=await fetch('https://api.stripe.com/v1/'+path,{...options,headers:{...headers,...options.headers},signal:AbortSignal.timeout(20000)});
  const result=await response.json();
  if(!response.ok)throw new Error('Stripe configuration request failed: '+(result.error?.type||response.status));
  return result;
 }
 const entries=[];
 for(const [code,amount,interval]of plans){
  const id=process.env['STRIPE_PRICE_'+code];
  entries.push({price:await request('prices/'+encodeURIComponent(id)),amount,interval});
 }
 const products=portalProductsFromPrices(entries,{livemode});
 const policy=portalConfiguration({products,siteUrl:site.href});
 const form=new URLSearchParams();
 function encode(value,path){if(value&&typeof value==='object')for(const [key,v]of Object.entries(value))encode(v,path?path+'['+key+']':key);else form.append(path,String(value));}
 encode(policy,'');
 const result=await request('billing_portal/configurations',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:form});
 if(result.livemode!==livemode)throw new Error('Unexpected configuration environment');
 console.log('Set STRIPE_PORTAL_CONFIGURATION_ID='+result.id+' in the matching environment only. Enrollment and existing subscriptions were not changed.');
}
