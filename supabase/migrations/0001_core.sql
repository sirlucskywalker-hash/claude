-- PhysiqueOS production-oriented core schema
create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active' check (status in ('active','suspended','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  timezone text default 'America/New_York',
  status text not null default 'active' check (status in ('active','disabled','deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','coach','client','analyst')),
  status text not null default 'active' check (status in ('invited','active','suspended')),
  created_at timestamptz not null default now(),
  unique(organization_id,user_id)
);

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  token_hash text not null unique,
  email text,
  role text not null default 'client' check (role in ('admin','coach','client','analyst')),
  campaign text,
  source text,
  expires_at timestamptz,
  max_uses int not null default 1 check (max_uses > 0),
  uses int not null default 0 check (uses >= 0),
  claimed_by uuid references auth.users(id),
  claimed_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.client_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sex text,
  birth_date date,
  height_cm numeric(6,2),
  starting_weight_kg numeric(7,3),
  goal_weight_kg numeric(7,3),
  body_fat_pct numeric(5,2),
  goal text,
  aggressiveness text,
  experience text,
  activity_level numeric(5,2),
  training_days int,
  meals_per_day int,
  food_budget_weekly numeric(10,2),
  postal_code text,
  preferred_stores text[],
  diet_restrictions text[],
  foods_avoid text[],
  injuries_limitations text,
  equipment text[],
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  checkin_date date not null,
  weight_kg numeric(7,3),
  steps int,
  water_ml int,
  sleep_hours numeric(4,2),
  calories int,
  protein_g numeric(7,2),
  carbs_g numeric(7,2),
  fat_g numeric(7,2),
  adherence_pct numeric(5,2) check (adherence_pct between 0 and 100),
  hunger int check (hunger between 1 and 10),
  energy int check (energy between 1 and 10),
  stress int check (stress between 1 and 10),
  notes text,
  created_at timestamptz not null default now(),
  unique(user_id,checkin_date)
);

create table if not exists public.measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  measured_at date not null,
  waist_cm numeric(7,2),
  neck_cm numeric(7,2),
  shoulders_cm numeric(7,2),
  chest_cm numeric(7,2),
  arm_left_cm numeric(7,2),
  arm_right_cm numeric(7,2),
  hips_cm numeric(7,2),
  thigh_left_cm numeric(7,2),
  thigh_right_cm numeric(7,2),
  calf_left_cm numeric(7,2),
  calf_right_cm numeric(7,2),
  created_at timestamptz not null default now(),
  unique(user_id,measured_at)
);

create table if not exists public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  storage_path text not null,
  pose text,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  starts_on date not null,
  ends_on date,
  target_calories int,
  target_protein_g int,
  target_carbs_g int,
  target_fat_g int,
  plan jsonb not null default '{}'::jsonb,
  version int not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.training_programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  starts_on date not null,
  ends_on date,
  program jsonb not null default '{}'::jsonb,
  version int not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  program_id uuid references public.training_programs(id) on delete set null,
  performed_at timestamptz not null default now(),
  session jsonb not null default '{}'::jsonb,
  rpe numeric(4,2),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.coach_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_user_id uuid not null references auth.users(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  visibility text not null default 'staff' check (visibility in ('staff','client')),
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.billing_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_subscription_id text not null unique,
  stripe_price_id text,
  status text not null,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  trial_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  source text not null check (source in ('stripe','beta','admin','promo')),
  active boolean not null default true,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(user_id,code,source)
);

create table if not exists public.billing_events (
  stripe_event_id text primary key,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

create table if not exists public.consent_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  consent_type text not null check (consent_type in ('terms','privacy','marketing','health_data')),
  document_version text not null,
  granted boolean not null,
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists public.attribution_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  invite_id uuid references public.invites(id) on delete set null,
  anonymous_id text,
  event_name text not null,
  source text,
  medium text,
  campaign text,
  referrer text,
  landing_path text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.product_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  anonymous_id text,
  event_name text not null,
  properties jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index if not exists product_events_user_time_idx on public.product_events(user_id,occurred_at desc);
create index if not exists checkins_user_date_idx on public.daily_checkins(user_id,checkin_date desc);

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.beta_import_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  payload_hash text not null,
  imported_at timestamptz not null default now(),
  unique(user_id,payload_hash)
);

create or replace function public.is_org_member(org uuid)
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.memberships m where m.organization_id=org and m.user_id=auth.uid() and m.status='active') $$;

create or replace function public.has_org_role(org uuid, allowed text[])
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.memberships m where m.organization_id=org and m.user_id=auth.uid() and m.status='active' and m.role=any(allowed)) $$;

alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.client_profiles enable row level security;
alter table public.daily_checkins enable row level security;
alter table public.measurements enable row level security;
alter table public.progress_photos enable row level security;
alter table public.meal_plans enable row level security;
alter table public.training_programs enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.coach_notes enable row level security;
alter table public.billing_customers enable row level security;
alter table public.subscriptions enable row level security;
alter table public.entitlements enable row level security;
alter table public.consent_events enable row level security;
alter table public.attribution_events enable row level security;
alter table public.product_events enable row level security;
alter table public.audit_log enable row level security;
alter table public.beta_import_receipts enable row level security;

create policy profiles_self_select on public.profiles for select using (user_id=auth.uid());
create policy profiles_self_update on public.profiles for update using (user_id=auth.uid()) with check (user_id=auth.uid());

create policy memberships_member_select on public.memberships for select using (user_id=auth.uid() or public.is_org_member(organization_id));

create policy client_profile_read on public.client_profiles for select using (user_id=auth.uid() or public.has_org_role(organization_id,array['owner','admin','coach']));
create policy client_profile_write_self on public.client_profiles for all using (user_id=auth.uid()) with check (user_id=auth.uid());

create policy checkins_read on public.daily_checkins for select using (user_id=auth.uid() or public.has_org_role(organization_id,array['owner','admin','coach']));
create policy checkins_self_write on public.daily_checkins for all using (user_id=auth.uid()) with check (user_id=auth.uid());

create policy measurements_read on public.measurements for select using (user_id=auth.uid() or public.has_org_role(organization_id,array['owner','admin','coach']));
create policy measurements_self_write on public.measurements for all using (user_id=auth.uid()) with check (user_id=auth.uid());

create policy photos_read on public.progress_photos for select using (user_id=auth.uid() or public.has_org_role(organization_id,array['owner','admin','coach']));
create policy photos_self_write on public.progress_photos for all using (user_id=auth.uid()) with check (user_id=auth.uid());

create policy mealplans_read on public.meal_plans for select using (user_id=auth.uid() or public.has_org_role(organization_id,array['owner','admin','coach']));
create policy mealplans_staff_write on public.meal_plans for all using (user_id=auth.uid() or public.has_org_role(organization_id,array['owner','admin','coach'])) with check (user_id=auth.uid() or public.has_org_role(organization_id,array['owner','admin','coach']));

create policy training_read on public.training_programs for select using (user_id=auth.uid() or public.has_org_role(organization_id,array['owner','admin','coach']));
create policy training_staff_write on public.training_programs for all using (user_id=auth.uid() or public.has_org_role(organization_id,array['owner','admin','coach'])) with check (user_id=auth.uid() or public.has_org_role(organization_id,array['owner','admin','coach']));

create policy workouts_read on public.workout_sessions for select using (user_id=auth.uid() or public.has_org_role(organization_id,array['owner','admin','coach']));
create policy workouts_self_write on public.workout_sessions for all using (user_id=auth.uid()) with check (user_id=auth.uid());

create policy coachnotes_read on public.coach_notes for select using (
  (client_user_id=auth.uid() and visibility='client') or public.has_org_role(organization_id,array['owner','admin','coach'])
);
create policy coachnotes_staff_write on public.coach_notes for all using (public.has_org_role(organization_id,array['owner','admin','coach'])) with check (public.has_org_role(organization_id,array['owner','admin','coach']));

create policy billing_customer_self on public.billing_customers for select using (user_id=auth.uid());
create policy subscriptions_self on public.subscriptions for select using (user_id=auth.uid());
create policy entitlements_self on public.entitlements for select using (user_id=auth.uid());

create policy consent_self_read on public.consent_events for select using (user_id=auth.uid());
create policy consent_self_insert on public.consent_events for insert with check (user_id=auth.uid());

create policy attribution_self_insert on public.attribution_events for insert with check (user_id is null or user_id=auth.uid());
create policy attribution_self_read on public.attribution_events for select using (user_id=auth.uid());

create policy productevents_self_insert on public.product_events for insert with check (user_id is null or user_id=auth.uid());
create policy productevents_self_read on public.product_events for select using (user_id=auth.uid());

create policy imports_self on public.beta_import_receipts for select using (user_id=auth.uid());

-- Storage: create a private bucket named progress-photos in the Supabase dashboard or deployment automation.
