import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lifecycleEmail,retryStatus} from '../supabase/functions/_shared/lifecycle-logic.mjs';
import {portalConfiguration,validatePortalPolicy} from '../supabase/functions/_shared/portal-policy.mjs';
test('lifecycle emails escape account text, include plain text, and reject insecure app links',()=>{
 const result=lifecycleEmail({name:'<img src=x>',payload:{title:'Welcome & begin',body:'<script>bad</script>'}},'https://example.com/app/');
 assert.ok(result.html.includes('&lt;script&gt;'));assert.ok(!result.html.includes('<script>'));assert.ok(result.text.includes('Open PhysiqueOS: https://example.com/app/'));
 assert.throws(()=>lifecycleEmail({payload:{}},'javascript:alert(1)'));
 assert.ok(result.html.length<102*1024);
});
test('delivery failures retry only transient provider responses',()=>{
 assert.equal(retryStatus(429),'pending');assert.equal(retryStatus(503),'pending');assert.equal(retryStatus(422),'failed');assert.equal(retryStatus(401),'failed');
});
test('billing policy protects paid time and requires prorated upgrades',()=>{
 const policy=portalConfiguration({product:'prod_test',prices:['price_core','price_pro'],siteUrl:'https://example.com/'});
 assert.equal(validatePortalPolicy({...policy,active:true}),true);
 const bad=structuredClone(policy);bad.features.subscription_update.proration_behavior='none';assert.throws(()=>validatePortalPolicy({...bad,active:true}));
 const immediate=structuredClone(policy);immediate.features.subscription_cancel.mode='immediately';assert.throws(()=>validatePortalPolicy({...immediate,active:true}));
 assert.throws(()=>portalConfiguration({product:'prod',prices:[],siteUrl:'https://example.com'}));
});
