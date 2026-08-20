-- GO PRIMAL Production Alpha 0.1 - Core game model
create extension if not exists pgcrypto;

DO $$ BEGIN
  create type public.resource_type as enum ('energy','gold','knowledge','exploration','xp');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  create type public.relationship_status as enum ('pending','active','declined','ended');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  create type public.raid_result as enum ('win','loss');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  create type public.raid_kind as enum ('solo','warband');
EXCEPTION WHEN duplicate_object THEN null; END $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text unique,
  display_name text not null default 'Player',
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kingdoms (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  visibility text not null default 'open' check (visibility in ('open','invite_only')),
  emblem_key text,
  created_at timestamptz not null default now()
);

create table if not exists public.kingdom_memberships (
  id uuid primary key default gen_random_uuid(),
  kingdom_id uuid not null references public.kingdoms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('member','officer','leader')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  unique(kingdom_id, user_id)
);
create unique index if not exists one_active_kingdom_per_user
  on public.kingdom_memberships(user_id) where left_at is null;

create table if not exists public.gorillas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  name text not null,
  xp bigint not null default 0 check (xp >= 0),
  fur_key text not null default 'brown',
  hair_key text not null default 'tuft',
  face_key text not null default 'default',
  style jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.villages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  kingdom_id uuid references public.kingdoms(id),
  name text not null,
  reputation integer not null default 100,
  protected_gold bigint not null default 0 check (protected_gold >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.village_buildings (
  village_id uuid not null references public.villages(id) on delete cascade,
  building_key text not null check (building_key in ('hall','forge','barracks','lab')),
  level integer not null default 1 check (level >= 1 and level <= 50),
  updated_at timestamptz not null default now(),
  primary key(village_id, building_key)
);

create table if not exists public.resource_balances (
  owner_type text not null check (owner_type in ('profile','village','kingdom')),
  owner_id uuid not null,
  resource public.resource_type not null,
  balance bigint not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now(),
  primary key(owner_type, owner_id, resource)
);

create table if not exists public.resource_transactions (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('profile','village','kingdom')),
  owner_id uuid not null,
  resource public.resource_type not null,
  amount bigint not null check (amount <> 0),
  balance_after bigint not null check (balance_after >= 0),
  source_type text not null,
  source_id uuid,
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists resource_tx_owner_idx
  on public.resource_transactions(owner_type, owner_id, resource, created_at desc);

create table if not exists public.village_relationships (
  id uuid primary key default gen_random_uuid(),
  requester_village_id uuid not null references public.villages(id) on delete cascade,
  responder_village_id uuid not null references public.villages(id) on delete cascade,
  status public.relationship_status not null default 'pending',
  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  ended_at timestamptz,
  check (requester_village_id <> responder_village_id)
);
create unique index if not exists one_open_relationship_pair
  on public.village_relationships(
    least(requester_village_id, responder_village_id),
    greatest(requester_village_id, responder_village_id)
  ) where status in ('pending','active');

create table if not exists public.raids (
  id uuid primary key default gen_random_uuid(),
  attacker_village_id uuid not null references public.villages(id),
  defender_village_id uuid not null references public.villages(id),
  kind public.raid_kind not null default 'solo',
  energy_cost integer not null check (energy_cost > 0),
  attacker_power_snapshot integer not null check (attacker_power_snapshot > 0),
  defender_power_snapshot integer not null check (defender_power_snapshot > 0),
  probability numeric(6,5) not null check (probability >= 0 and probability <= 1),
  random_roll numeric(6,5) not null check (random_roll >= 0 and random_roll <= 1),
  result public.raid_result not null,
  loot_gold bigint not null default 0 check (loot_gold >= 0),
  reputation_delta integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (attacker_village_id <> defender_village_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);

-- Bootstrap helper: profile + gorilla + village + default buildings and balances.
create or replace function public.bootstrap_player(
  p_display_name text,
  p_gorilla_name text,
  p_village_name text,
  p_kingdom_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  village_uuid uuid;
begin
  if uid is null then raise exception 'UNAUTHENTICATED'; end if;

  insert into public.profiles(id, display_name)
  values(uid, coalesce(nullif(trim(p_display_name),''),'Player'))
  on conflict(id) do update set display_name = excluded.display_name, updated_at = now();

  insert into public.gorillas(user_id, name)
  values(uid, coalesce(nullif(trim(p_gorilla_name),''),'Gorilla'))
  on conflict(user_id) do nothing;

  insert into public.villages(user_id, kingdom_id, name)
  values(uid, p_kingdom_id, coalesce(nullif(trim(p_village_name),''),'Village'))
  on conflict(user_id) do update set kingdom_id = coalesce(excluded.kingdom_id, public.villages.kingdom_id)
  returning id into village_uuid;

  if village_uuid is null then select id into village_uuid from public.villages where user_id = uid; end if;

  insert into public.village_buildings(village_id, building_key, level)
  select village_uuid, k, 1 from unnest(array['hall','forge','barracks','lab']) k
  on conflict do nothing;

  insert into public.resource_balances(owner_type, owner_id, resource, balance)
  values
    ('profile', uid, 'energy', 0),
    ('profile', uid, 'knowledge', 0),
    ('profile', uid, 'exploration', 0),
    ('profile', uid, 'xp', 0),
    ('village', village_uuid, 'gold', 180)
  on conflict do nothing;

  if p_kingdom_id is not null then
    insert into public.kingdom_memberships(kingdom_id, user_id)
    values(p_kingdom_id, uid)
    on conflict(kingdom_id, user_id) do update set left_at = null;
  end if;

  return village_uuid;
end;
$$;

grant execute on function public.bootstrap_player(text,text,text,uuid) to authenticated;

-- Keep Gorilla display XP synchronized with the authoritative XP ledger balance.
create or replace function public.sync_gorilla_xp_from_balance()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.owner_type='profile' and new.resource='xp' then
    update public.gorillas set xp=new.balance, updated_at=now() where user_id=new.owner_id;
  end if;
  return new;
end;
$$;
drop trigger if exists resource_balance_sync_gorilla_xp on public.resource_balances;
create trigger resource_balance_sync_gorilla_xp
after insert or update of balance on public.resource_balances
for each row execute function public.sync_gorilla_xp_from_balance();

-- RLS
alter table public.profiles enable row level security;
alter table public.kingdoms enable row level security;
alter table public.kingdom_memberships enable row level security;
alter table public.gorillas enable row level security;
alter table public.villages enable row level security;
alter table public.village_buildings enable row level security;
alter table public.resource_balances enable row level security;
alter table public.resource_transactions enable row level security;
alter table public.village_relationships enable row level security;
alter table public.raids enable row level security;
alter table public.notifications enable row level security;

create policy "profiles own read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "profiles own update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "kingdoms auth read" on public.kingdoms for select to authenticated using (true);
create policy "memberships auth read" on public.kingdom_memberships for select to authenticated using (true);
create policy "gorillas auth read" on public.gorillas for select to authenticated using (true);
create policy "gorillas own update cosmetics" on public.gorillas for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "villages auth read" on public.villages for select to authenticated using (true);
create policy "buildings auth read" on public.village_buildings for select to authenticated using (true);
create policy "balances own read" on public.resource_balances for select to authenticated using (
  (owner_type='profile' and owner_id=auth.uid()) or
  (owner_type='village' and exists(select 1 from public.villages v where v.id=owner_id and v.user_id=auth.uid()))
);
create policy "transactions own read" on public.resource_transactions for select to authenticated using (
  (owner_type='profile' and owner_id=auth.uid()) or
  (owner_type='village' and exists(select 1 from public.villages v where v.id=owner_id and v.user_id=auth.uid()))
);
create policy "relationships participant read" on public.village_relationships for select to authenticated using (
  exists(select 1 from public.villages v where v.user_id=auth.uid() and v.id in (requester_village_id,responder_village_id))
);
create policy "raids auth read" on public.raids for select to authenticated using (true);
create policy "notifications own read" on public.notifications for select to authenticated using (user_id=auth.uid());
create policy "notifications own update" on public.notifications for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

-- Column-level hardening: users may customize identity, never progression values.
revoke update on public.gorillas from authenticated;
grant update(name, fur_key, hair_key, face_key, style) on public.gorillas to authenticated;
