-- GO PRIMAL Production Alpha 0.1 - hardening pass
-- Adds idempotent game actions, activity review/admin primitives, local-day counting,
-- and tighter client grants before real users are invited.

DO $$ BEGIN
  create type public.activity_review_status as enum ('queued','approved','rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;

create table if not exists public.admin_users (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_reviews (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null unique references public.activities(id) on delete cascade,
  status public.activity_review_status not null default 'queued',
  reasons text[] not null default '{}',
  notes text,
  reviewer_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists activity_reviews_status_idx on public.activity_reviews(status, created_at);

create table if not exists public.game_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  action_type text not null,
  idempotency_key text not null,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(user_id, idempotency_key)
);

alter table public.admin_users enable row level security;
alter table public.activity_reviews enable row level security;
alter table public.game_actions enable row level security;
-- No browser policies: these tables are accessed by trusted server code/functions only.

-- A user may only mark a notification as read; payload/title/body are server-owned.
revoke update on public.notifications from authenticated;
grant update(read_at) on public.notifications to authenticated;

-- Count already rewarded activities using the player's IANA timezone rather than UTC.
create or replace function public.count_rewarded_activities_local_day(
  p_user_id uuid,
  p_category public.activity_category,
  p_started_at timestamptz
) returns integer
language sql
stable
security definer
set search_path=public
as $$
  select count(*)::integer
  from public.activities a
  join public.profiles p on p.id=a.user_id
  where a.user_id=p_user_id
    and a.category=p_category
    and a.reward_status='awarded'
    and (a.started_at at time zone p.timezone)::date = (p_started_at at time zone p.timezone)::date;
$$;
revoke all on function public.count_rewarded_activities_local_day(uuid,public.activity_category,timestamptz) from public, anon, authenticated;
grant execute on function public.count_rewarded_activities_local_day(uuid,public.activity_category,timestamptz) to service_role;

-- Idempotent building upgrade. Replaying the same action returns the prior level
-- instead of upgrading twice without charging twice.
create or replace function public.upgrade_own_building(
  p_building_key text,
  p_idempotency_key text
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  vid uuid;
  current_level integer;
  energy_cost bigint;
  gold_cost bigint;
  knowledge_cost bigint;
  prior_result jsonb;
begin
  if uid is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_building_key not in ('hall','forge','barracks','lab') then raise exception 'INVALID_BUILDING'; end if;
  if nullif(trim(p_idempotency_key),'') is null then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;

  select result into prior_result from public.game_actions
  where user_id=uid and idempotency_key=p_idempotency_key and action_type='building_upgrade';
  if found then return (prior_result->>'level')::integer; end if;

  select id into vid from public.villages where user_id=uid;
  if vid is null then raise exception 'NO_VILLAGE'; end if;

  select level into current_level from public.village_buildings
  where village_id=vid and building_key=p_building_key for update;
  if current_level is null then raise exception 'BUILDING_NOT_FOUND'; end if;

  energy_cost := (case p_building_key when 'hall' then 80 when 'forge' then 70 when 'barracks' then 90 else 25 end) + ((current_level-1)*24);
  gold_cost := (case p_building_key when 'hall' then 100 when 'forge' then 95 when 'barracks' then 110 else 90 end) + ((current_level-1)*65);
  knowledge_cost := (case p_building_key when 'lab' then 55 else 0 end) + (case when p_building_key='lab' then ((current_level-1)*25) else 0 end);

  perform public.apply_resource_transaction('profile',uid,'energy',-energy_cost,'building_upgrade',vid,p_idempotency_key||':energy',jsonb_build_object('building',p_building_key,'from',current_level));
  perform public.apply_resource_transaction('village',vid,'gold',-gold_cost,'building_upgrade',vid,p_idempotency_key||':gold',jsonb_build_object('building',p_building_key,'from',current_level));
  if knowledge_cost > 0 then
    perform public.apply_resource_transaction('profile',uid,'knowledge',-knowledge_cost,'building_upgrade',vid,p_idempotency_key||':knowledge',jsonb_build_object('building',p_building_key,'from',current_level));
  end if;

  update public.village_buildings set level=level+1, updated_at=now()
  where village_id=vid and building_key=p_building_key;

  insert into public.game_actions(user_id,action_type,idempotency_key,result)
  values(uid,'building_upgrade',p_idempotency_key,jsonb_build_object('building',p_building_key,'level',current_level+1));

  return current_level+1;
end;
$$;
revoke all on function public.upgrade_own_building(text,text) from public, anon;
grant execute on function public.upgrade_own_building(text,text) to authenticated;

-- Wrap the original raid resolver with an action idempotency boundary.
create or replace function public.resolve_solo_raid_idempotent(
  p_target_village_id uuid,
  p_idempotency_key text
) returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  uid uuid := auth.uid();
  prior_result jsonb;
  rid uuid;
begin
  if uid is null then raise exception 'UNAUTHENTICATED'; end if;
  if nullif(trim(p_idempotency_key),'') is null then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;

  select result into prior_result from public.game_actions
  where user_id=uid and idempotency_key=p_idempotency_key and action_type='solo_raid';
  if found then return (prior_result->>'raidId')::uuid; end if;

  rid := public.resolve_solo_raid(p_target_village_id);
  insert into public.game_actions(user_id,action_type,idempotency_key,result)
  values(uid,'solo_raid',p_idempotency_key,jsonb_build_object('raidId',rid,'targetVillageId',p_target_village_id));
  return rid;
end;
$$;
revoke all on function public.resolve_solo_raid(uuid) from public, anon, authenticated;
grant execute on function public.resolve_solo_raid(uuid) to service_role;
revoke all on function public.resolve_solo_raid_idempotent(uuid,text) from public, anon;
grant execute on function public.resolve_solo_raid_idempotent(uuid,text) to authenticated;

-- Review-triggered reversal. It is intentionally strict: if already-spent resources
-- make an exact reversal impossible, the transaction aborts and the item stays for
-- admin resolution instead of silently creating negative balances.
create or replace function public.reverse_activity_reward(
  p_activity_id uuid,
  p_reason text
) returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  a public.activities%rowtype;
  r public.activity_rewards%rowtype;
  amount bigint;
  resource_name text;
begin
  select * into a from public.activities where id=p_activity_id for update;
  if a.id is null then raise exception 'ACTIVITY_NOT_FOUND'; end if;
  if a.reward_status='reversed' then return; end if;
  if a.reward_status<>'awarded' then
    update public.activities set reward_status='rejected', updated_at=now() where id=p_activity_id;
    return;
  end if;

  select * into r from public.activity_rewards where activity_id=p_activity_id;
  if r.activity_id is null then raise exception 'ACTIVITY_REWARD_NOT_FOUND'; end if;

  foreach resource_name in array array['energy','knowledge','exploration','xp'] loop
    amount := coalesce((r.rewards->>resource_name)::bigint,0);
    if amount > 0 then
      perform public.apply_resource_transaction(
        'profile',a.user_id,resource_name::public.resource_type,-amount,
        'activity_reward_reversal',p_activity_id,
        'activity:'||p_activity_id||':'||resource_name||':reversal:v1',
        jsonb_build_object('reason',p_reason)
      );
    end if;
  end loop;

  update public.activity_rewards set reversed_at=now(), metadata=metadata||jsonb_build_object('reversalReason',p_reason)
  where activity_id=p_activity_id;
  update public.activities set reward_status='reversed', updated_at=now() where id=p_activity_id;
end;
$$;
revoke all on function public.reverse_activity_reward(uuid,text) from public, anon, authenticated;
grant execute on function public.reverse_activity_reward(uuid,text) to service_role;

-- Tighten bootstrap: invite-only Kingdoms cannot be self-selected through the public RPC.
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
  target_visibility text;
begin
  if uid is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_kingdom_id is not null then
    select visibility into target_visibility from public.kingdoms where id=p_kingdom_id;
    if target_visibility is null then raise exception 'KINGDOM_NOT_FOUND'; end if;
    if target_visibility <> 'open' then raise exception 'INVITE_REQUIRED'; end if;
  end if;

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

-- Private manual-proof bucket. Uploads are performed through trusted server code;
-- no direct browser object policies are granted in the Alpha.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('activity-proofs','activity-proofs',false,8388608,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
