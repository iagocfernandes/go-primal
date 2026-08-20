-- GO PRIMAL Production Alpha 0.1 - Proof Engine and integrations
DO $$ BEGIN
  create type public.integration_provider as enum ('strava','healthkit','health_connect','go_primal');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  create type public.integration_status as enum ('active','revoked','error');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  create type public.activity_category as enum ('train','focus','move');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  create type public.verification_level as enum ('verified','connected','proof_submitted','unverified');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  create type public.reward_status as enum ('pending','awarded','rejected','reversed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

create table if not exists public.integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider public.integration_provider not null,
  status public.integration_status not null default 'active',
  provider_user_id text,
  scopes text[] not null default '{}',
  access_token_encrypted text,
  refresh_token_encrypted text,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  last_sync_at timestamptz,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, provider)
);

create table if not exists public.integration_events (
  id uuid primary key default gen_random_uuid(),
  provider public.integration_provider not null,
  external_event_id text not null,
  provider_user_id text,
  object_type text,
  object_id text,
  aspect_type text,
  payload jsonb not null,
  status text not null default 'queued' check(status in ('queued','processing','processed','ignored','error')),
  attempts integer not null default 0,
  last_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique(provider, external_event_id)
);
create index if not exists integration_events_queue_idx on public.integration_events(status, received_at);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category public.activity_category not null,
  sport_type text,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  moving_seconds integer,
  elapsed_seconds integer,
  distance_meters numeric,
  elevation_meters numeric,
  calories numeric,
  source_primary text,
  verification_level public.verification_level not null default 'unverified',
  verification_score integer not null default 0 check(verification_score between 0 and 100),
  risk_flags text[] not null default '{}',
  reward_status public.reward_status not null default 'pending',
  merged_into_activity_id uuid references public.activities(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(ended_at >= started_at)
);
create index if not exists activities_user_time_idx on public.activities(user_id, started_at desc);

create table if not exists public.activity_evidence (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check(provider in ('strava','healthkit','health_connect','go_primal','manual')),
  external_id text not null,
  source_name text,
  device_name text,
  manual boolean not null default false,
  has_gps boolean not null default false,
  has_heart_rate boolean not null default false,
  provider_flagged boolean not null default false,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  moving_seconds integer,
  elapsed_seconds integer,
  distance_meters numeric,
  metadata jsonb not null default '{}'::jsonb,
  raw_payload jsonb,
  payload_checksum text,
  created_at timestamptz not null default now(),
  unique(provider, user_id, external_id)
);
create index if not exists activity_evidence_activity_idx on public.activity_evidence(activity_id);

create table if not exists public.activity_verifications (
  activity_id uuid primary key references public.activities(id) on delete cascade,
  level public.verification_level not null,
  internal_score integer not null check(internal_score between 0 and 100),
  risk_flags text[] not null default '{}',
  reasons jsonb not null default '[]'::jsonb,
  ruleset_version text not null,
  verified_at timestamptz not null default now()
);

create table if not exists public.activity_rewards (
  activity_id uuid primary key references public.activities(id) on delete cascade,
  policy_version text not null,
  rewards jsonb not null,
  awarded_at timestamptz,
  reversed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.activity_media (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  media_type text not null default 'photo',
  created_at timestamptz not null default now()
);

-- Daily movement supports future HealthKit/Health Connect aggregate steps without fabricating a workout.
create table if not exists public.daily_movement (
  user_id uuid not null references public.profiles(id) on delete cascade,
  local_date date not null,
  steps integer not null default 0 check(steps >= 0),
  distance_meters numeric not null default 0 check(distance_meters >= 0),
  verification_level public.verification_level not null default 'unverified',
  evidence jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key(user_id, local_date)
);

alter table public.integrations enable row level security;
alter table public.integration_events enable row level security;
alter table public.activities enable row level security;
alter table public.activity_evidence enable row level security;
alter table public.activity_verifications enable row level security;
alter table public.activity_rewards enable row level security;
alter table public.activity_media enable row level security;
alter table public.daily_movement enable row level security;

create policy "integrations own read" on public.integrations for select to authenticated using(user_id=auth.uid());
create policy "activities own read" on public.activities for select to authenticated using(user_id=auth.uid());
create policy "evidence own read" on public.activity_evidence for select to authenticated using(user_id=auth.uid());
create policy "verification own read" on public.activity_verifications for select to authenticated using(
  exists(select 1 from public.activities a where a.id=activity_id and a.user_id=auth.uid())
);
create policy "rewards own read" on public.activity_rewards for select to authenticated using(
  exists(select 1 from public.activities a where a.id=activity_id and a.user_id=auth.uid())
);
create policy "media own read" on public.activity_media for select to authenticated using(user_id=auth.uid());
create policy "movement own read" on public.daily_movement for select to authenticated using(user_id=auth.uid());

-- Intentionally no client insert/update policies for integrations, evidence, rewards, transactions or raw events.
-- Trusted server code owns those mutations.
