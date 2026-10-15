-- Report syncs written by the current app, retaining timestamps from older clients.
-- Keep the existing column order and invoker security; underlying RLS still applies.
create or replace view public.admin_client_overview_v2 with (security_invoker=true) as
select p.user_id,p.email,p.full_name,p.created_at,
 cp.onboarding_complete,cp.goal,cp.starting_weight_kg,cp.goal_weight_kg,
 lc.last_checkin_date,lc.latest_weight_kg,lc.adherence_pct,
 s.status as subscription_status,s.stripe_price_id,s.current_period_end,
 e.active as has_app_access,e.source as access_source,
 greatest(st.updated_at,snapshot.updated_at) as last_cloud_sync
from public.profiles p
left join public.client_profiles cp on cp.user_id=p.user_id
left join lateral (
 select d.checkin_date as last_checkin_date,d.weight_kg as latest_weight_kg,d.adherence_pct
 from public.daily_checkins d where d.user_id=p.user_id order by d.checkin_date desc limit 1
) lc on true
left join lateral (
 select s1.status,s1.stripe_price_id,s1.current_period_end from public.subscriptions s1
 where s1.user_id=p.user_id order by s1.updated_at desc limit 1
) s on true
left join lateral (
 select e1.active,e1.source from public.entitlements e1
 where e1.user_id=p.user_id and e1.code='app_access' and e1.active
 and (e1.ends_at is null or e1.ends_at>now()) order by e1.created_at desc limit 1
) e on true
left join public.user_app_state st on st.user_id=p.user_id
left join public.user_state_snapshots snapshot on snapshot.user_id=p.user_id;
revoke all on public.admin_client_overview_v2 from public,anon,authenticated;
grant select on public.admin_client_overview_v2 to authenticated;
