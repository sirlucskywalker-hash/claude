export function portalProductsFromPrices(entries,{livemode}){
 const groups=new Map(),seen=new Set();
 for(const {price,amount,interval} of entries){
  if(!price?.active||price.livemode!==livemode||price.currency!=='usd'||price.unit_amount!==amount||price.recurring?.interval!==interval||(price.recurring?.interval_count??1)!==1||price.type!=='recurring')throw new Error('Price does not match approved amount, currency, interval or environment');
  const product=typeof price.product==='string'?price.product:price.product?.id;
  if(!/^prod_/.test(product||'')||!/^price_/.test(price.id||'')||seen.has(price.id))throw new Error('Unique product and price IDs required');
  seen.add(price.id);
  const group=groups.get(product)||{product,prices:[],intervals:new Set()};
  if(group.intervals.has(interval))throw new Error('Stripe requires unique billing intervals per portal product; use separate products for Core, Pro and Elite');
  group.intervals.add(interval);group.prices.push(price.id);groups.set(product,group);
 }
 if(!groups.size)throw new Error('Plan prices required');
 return [...groups.values()].map(({product,prices})=>({product,prices}));
}
export function portalConfiguration({products,siteUrl}){
 if(!Array.isArray(products)||!products.length||products.some(p=>!/^prod_/.test(p.product||'')||!p.prices?.length||p.prices.some(id=>!/^price_/.test(id))))throw new Error('Grouped products and plan prices required');
 const url=new URL(siteUrl);if(url.protocol!=='https:')throw new Error('Secure site URL required');
 return {business_profile:{headline:'Manage your PhysiqueOS membership'},default_return_url:url.href,
  features:{invoice_history:{enabled:true},payment_method_update:{enabled:true},
   subscription_cancel:{enabled:true,mode:'at_period_end',proration_behavior:'none',cancellation_reason:{enabled:true,options:['too_expensive','missing_features','switched_service','unused','customer_service','too_complex','low_quality','other']}},
   subscription_update:{enabled:true,default_allowed_updates:['price'],proration_behavior:'always_invoice',products,schedule_at_period_end:{conditions:[{type:'decreasing_item_amount'},{type:'shortening_interval'}]}}
  },metadata:{integration:'physiqueos',policy:'prorated-upgrades-period-end-downgrades-v1'}};
}
export function validatePortalPolicy(configuration){
 const f=configuration?.features,u=f?.subscription_update,c=f?.subscription_cancel;
 const conditions=u?.schedule_at_period_end?.conditions?.map(x=>x.type)||[];
 if(!configuration?.active||!u?.enabled||!u.default_allowed_updates?.includes('price')||u.proration_behavior!=='always_invoice'||!conditions.includes('decreasing_item_amount')||!conditions.includes('shortening_interval')||!c?.enabled||c.mode!=='at_period_end'||c.proration_behavior!=='none')throw new Error('Billing portal policy not configured');
 return true;
}
