import {test} from 'node:test';
import assert from 'node:assert/strict';
import {returnUrl,subscriptionId,normalizeSubscription} from '../supabase/functions/_shared/billing-logic.mjs';
test('return URLs only accept configured origin',()=>{
  assert.equal(returnUrl('https://example.com/app?billing=success','https://example.com'),'https://example.com/app?billing=success');
  for(const url of ['https://evil.com','https://example.com.evil.com','https://user:pass@example.com','http://example.com'])
    assert.throws(()=>returnUrl(url,'https://example.com'));
});
test('current item-level periods normalize',()=>{
  const result=normalizeSubscription({id:'sub_test',customer:'cus_test',status:'active',items:{data:[{price:{id:'price_test'},current_period_start:1790730000,current_period_end:1793322000}]},cancel_at_period_end:true});
  assert.equal(result.period_end,new Date(1793322000*1000).toISOString());
  assert.equal(result.cancel_at_period_end,true);
  assert.throws(()=>normalizeSubscription({items:{data:[]}}));
});
test('legacy subscription periods remain readable',()=>{
  assert.ok(normalizeSubscription({id:'sub_old',customer:{id:'cus_old'},status:'trialing',items:{data:[{price:{id:'price_old'}}]},current_period_start:1790730000,current_period_end:1793322000}).period_end);
});
test('invoices, asynchronous checkout and cancellations resolve correctly',()=>{
  assert.equal(subscriptionId({type:'invoice.paid',data:{object:{parent:{subscription_details:{subscription:'sub_invoice'}}}}}),'sub_invoice');
  assert.equal(subscriptionId({type:'checkout.session.async_payment_succeeded',data:{object:{subscription:'sub_checkout'}}}),'sub_checkout');
  assert.equal(subscriptionId({type:'customer.subscription.deleted',data:{object:{id:'sub_cancel'}}}),'sub_cancel');
  assert.equal(subscriptionId({type:'charge.refunded',data:{object:{id:'ch_test'}}}),null);
});
