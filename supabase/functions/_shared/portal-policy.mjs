export function portalConfiguration({product,prices,siteUrl}){
 if(!product||!prices?.length||prices.some(p=>!/^price_/.test(p)))throw new Error('Product and plan prices required');
 const url=new URL(siteUrl);if(url.protocol!=='https:')throw new Error('Secure site URL required');
 return {business_profile:{headline:'Manage your PhysiqueOS membership'},default_return_url:url.href,
  features:{invoice_history:{enabled:true},payment_method_update:{enabled:true},
   subscription_cancel:{enabled:true,mode:'at_period_end',proration_behavior:'none',cancellation_reason:{enabled:true,options:['too_expensive','missing_features','switched_service','unused','customer_service','too_complex','low_quality','other']}},
   subscription_update:{enabled:true,default_allowed_updates:['price'],proration_behavior:'always_invoice',products:[{product,prices}],schedule_at_period_end:{conditions:[{type:'decreasing_item_amount'},{type:'shortening_interval'}]}}
  },metadata:{integration:'physiqueos',policy:'prorated-upgrades-period-end-downgrades-v1'}};
}
export function validatePortalPolicy(configuration){
 const f=configuration?.features,u=f?.subscription_update,c=f?.subscription_cancel;
 const conditions=u?.schedule_at_period_end?.conditions?.map(x=>x.type)||[];
 if(!configuration?.active||!u?.enabled||!u.default_allowed_updates?.includes('price')||u.proration_behavior!=='always_invoice'||!conditions.includes('decreasing_item_amount')||!conditions.includes('shortening_interval')||!c?.enabled||c.mode!=='at_period_end'||c.proration_behavior!=='none')throw new Error('Billing portal policy not configured');
 return true;
}
