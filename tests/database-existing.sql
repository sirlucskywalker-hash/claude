
create table public.user_state_snapshots(user_id uuid primary key references auth.users(id),state jsonb not null default '{}',client_version text,device_id text,updated_at timestamptz not null default now());
alter table public.user_state_snapshots enable row level security;
create policy snapshots_self_read on public.user_state_snapshots for select to authenticated using(user_id=auth.uid() or public.can_manage_user(user_id));
create policy snapshots_self_write on public.user_state_snapshots for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create table public.plans(code text primary key);
create table public.features(code text primary key,name text,category text,description text);
create table public.plan_features(plan_code text references public.plans(code),feature_code text references public.features(code),enabled boolean,limits jsonb default '{}',primary key(plan_code,feature_code));
create table public.plan_catalog(code text primary key,name text,monthly_cents int,annual_cents int,stripe_monthly_price_id text,stripe_annual_price_id text,public boolean default false,sort_order int,features jsonb);
insert into public.plans values ('beta'),('core'),('founding'),('pro'),('elite'),('concierge');
insert into public.features(code) values('tracking'),('nutrition_targets'),('adaptive_coach'),('priority_support'),('human_review'),('concierge_messaging'),('wearables'),('form_feedback');
insert into public.plan_features select p.code,f.code,true,'{}' from public.plans p cross join public.features f;
insert into public.plan_catalog(code,name,public,stripe_monthly_price_id) values
('core','Core',false,'price_core'),('founding','Founding',false,'price_founding'),('pro','Pro',false,'price_pro'),('elite','Elite',false,'price_elite'),('concierge','Concierge',false,'price_concierge');
grant select,insert,update,delete on all tables in schema public to authenticated,service_role;
grant usage,select on all sequences in schema public to authenticated,service_role;
