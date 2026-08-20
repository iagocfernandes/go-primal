-- GO PRIMAL Production Alpha 0.1 - Authoritative ledger and core game actions

create or replace function public.apply_resource_transaction(
  p_owner_type text,
  p_owner_id uuid,
  p_resource public.resource_type,
  p_amount bigint,
  p_source_type text,
  p_source_id uuid,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  current_balance bigint;
  new_balance bigint;
  prior_balance bigint;
begin
  select balance_after into prior_balance
  from public.resource_transactions
  where idempotency_key = p_idempotency_key;
  if found then return prior_balance; end if;

  insert into public.resource_balances(owner_type, owner_id, resource, balance)
  values(p_owner_type, p_owner_id, p_resource, 0)
  on conflict do nothing;

  select balance into current_balance
  from public.resource_balances
  where owner_type=p_owner_type and owner_id=p_owner_id and resource=p_resource
  for update;

  new_balance := current_balance + p_amount;
  if new_balance < 0 then raise exception 'INSUFFICIENT_BALANCE'; end if;

  update public.resource_balances
  set balance=new_balance, updated_at=now()
  where owner_type=p_owner_type and owner_id=p_owner_id and resource=p_resource;

  insert into public.resource_transactions(
    owner_type, owner_id, resource, amount, balance_after, source_type, source_id, idempotency_key, metadata
  ) values(
    p_owner_type, p_owner_id, p_resource, p_amount, new_balance, p_source_type, p_source_id, p_idempotency_key, p_metadata
  );

  return new_balance;
end;
$$;
revoke all on function public.apply_resource_transaction(text,uuid,public.resource_type,bigint,text,uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.apply_resource_transaction(text,uuid,public.resource_type,bigint,text,uuid,text,jsonb) to service_role;

create or replace function public.player_village_power(p_village_id uuid)
returns integer
language sql
stable
set search_path = public
as $$
  select (
    110
    + coalesce(sum(case b.building_key when 'forge' then b.level*52 when 'hall' then b.level*66 when 'barracks' then b.level*78 when 'lab' then b.level*32 else 0 end),0)
    + (case
        when g.xp >= 2000 then 5
        when g.xp >= 1200 then 4
        when g.xp >= 650 then 3
        when g.xp >= 250 then 2
        else 1 end) * 35
  )::integer
  from public.villages v
  join public.gorillas g on g.user_id=v.user_id
  left join public.village_buildings b on b.village_id=v.id
  where v.id=p_village_id
  group by g.xp;
$$;
grant execute on function public.player_village_power(uuid) to authenticated, service_role;

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
begin
  if uid is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_building_key not in ('hall','forge','barracks','lab') then raise exception 'INVALID_BUILDING'; end if;

  select id into vid from public.villages where user_id=uid;
  if vid is null then raise exception 'NO_VILLAGE'; end if;

  select level into current_level from public.village_buildings where village_id=vid and building_key=p_building_key for update;
  if current_level is null then raise exception 'BUILDING_NOT_FOUND'; end if;

  energy_cost := (case p_building_key when 'hall' then 80 when 'forge' then 70 when 'barracks' then 90 else 25 end) + ((current_level-1)*24);
  gold_cost := (case p_building_key when 'hall' then 100 when 'forge' then 95 when 'barracks' then 110 else 90 end) + ((current_level-1)*65);
  knowledge_cost := (case p_building_key when 'lab' then 55 else 0 end) + (case when p_building_key='lab' then ((current_level-1)*25) else 0 end);

  perform public.apply_resource_transaction('profile',uid,'energy',-energy_cost,'building_upgrade',vid,p_idempotency_key||':energy',jsonb_build_object('building',p_building_key,'from',current_level));
  perform public.apply_resource_transaction('village',vid,'gold',-gold_cost,'building_upgrade',vid,p_idempotency_key||':gold',jsonb_build_object('building',p_building_key,'from',current_level));
  if knowledge_cost > 0 then
    perform public.apply_resource_transaction('profile',uid,'knowledge',-knowledge_cost,'building_upgrade',vid,p_idempotency_key||':knowledge',jsonb_build_object('building',p_building_key,'from',current_level));
  end if;

  update public.village_buildings set level=level+1, updated_at=now() where village_id=vid and building_key=p_building_key;
  return current_level+1;
end;
$$;
grant execute on function public.upgrade_own_building(text,text) to authenticated;
