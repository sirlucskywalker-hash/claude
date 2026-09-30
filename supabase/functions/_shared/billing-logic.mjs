export function returnUrl(raw, siteUrl) {
  const site = new URL(siteUrl), target = new URL(raw || site.href);
  if (target.origin !== site.origin || target.username || target.password ||
      (target.protocol !== 'https:' && target.hostname !== 'localhost')) throw new Error('Invalid return URL');
  return target.href;
}
export function subscriptionId(event) {
  const o = event.data.object;
  if (event.type.startsWith('customer.subscription.')) return o.id;
  if (event.type.startsWith('checkout.session.')) return typeof o.subscription === 'string' ? o.subscription : o.subscription?.id;
  if (event.type.startsWith('invoice.')) {
    const sub = o.parent?.subscription_details?.subscription || o.subscription;
    return typeof sub === 'string' ? sub : sub?.id;
  }
  return null;
}
export function normalizeSubscription(sub) {
  const item = sub.items?.data?.[0];
  const iso = value => Number.isFinite(value) ? new Date(value * 1000).toISOString() : null;
  const start = iso(item?.current_period_start ?? sub.current_period_start);
  const end = iso(item?.current_period_end ?? sub.current_period_end);
  if (!item?.price?.id || !start || !end) throw new Error('Incomplete subscription');
  return {id:sub.id, customer:typeof sub.customer==='string'?sub.customer:sub.customer?.id,
    price_id:item.price.id,status:sub.status,period_start:start,period_end:end,
    cancel_at_period_end:!!sub.cancel_at_period_end,trial_end:iso(sub.trial_end)};
}
