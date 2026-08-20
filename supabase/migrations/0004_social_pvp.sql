-- GO PRIMAL Production Alpha 0.1 - Alliance consent and authoritative asynchronous raids
alter table public.villages add column if not exists raid_shield_until timestamptz;

create or replace function public.request_alliance(p_target_village_id uuid)
returns uuid
language plpgsql security definer set search_path=public as $$
declare
  uid uuid := auth.uid();
  own_village public.villages%rowtype;
  target public.villages%rowtype;
  rel_id uuid;
begin
  if uid is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into own_village from public.villages where user_id=uid;
  select * into target from public.villages where id=p_target_village_id;
  if own_village.id is null or target.id is null then raise exception 'VILLAGE_NOT_FOUND'; end if;
  if own_village.id=target.id then raise exception 'SELF_RELATIONSHIP'; end if;
  if own_village.kingdom_id is distinct from target.kingdom_id then raise exception 'CROSS_KINGDOM_ALLIANCE_LOCKED'; end if;

  insert into public.village_relationships(requester_village_id,responder_village_id,status)
  values(own_village.id,target.id,'pending')
  returning id into rel_id;

  insert into public.notifications(user_id,type,title,body,payload)
  values(target.user_id,'alliance_request','Alliance request',own_village.name||' wants to form an alliance.',jsonb_build_object('relationshipId',rel_id,'villageId',own_village.id));
  return rel_id;
exception when unique_violation then
  raise exception 'RELATIONSHIP_ALREADY_OPEN';
end;
$$;
grant execute on function public.request_alliance(uuid) to authenticated;

create or replace function public.respond_alliance(p_relationship_id uuid, p_accept boolean)
returns public.relationship_status
language plpgsql security definer set search_path=public as $$
declare
  uid uuid := auth.uid();
  rel public.village_relationships%rowtype;
  responder public.villages%rowtype;
  requester public.villages%rowtype;
  new_status public.relationship_status;
begin
  if uid is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into rel from public.village_relationships where id=p_relationship_id for update;
  if rel.id is null or rel.status <> 'pending' then raise exception 'RELATIONSHIP_NOT_PENDING'; end if;
  select * into responder from public.villages where id=rel.responder_village_id;
  if responder.user_id <> uid then raise exception 'NOT_RELATIONSHIP_RESPONDER'; end if;
  select * into requester from public.villages where id=rel.requester_village_id;
  new_status := case when p_accept then 'active'::public.relationship_status else 'declined'::public.relationship_status end;
  update public.village_relationships set status=new_status, responded_at=now() where id=rel.id;
  insert into public.notifications(user_id,type,title,body,payload)
  values(requester.user_id,'alliance_response',case when p_accept then 'Alliance accepted' else 'Alliance declined' end,
    responder.name||case when p_accept then ' accepted your alliance.' else ' declined your alliance.' end,
    jsonb_build_object('relationshipId',rel.id,'villageId',responder.id,'accepted',p_accept));
  return new_status;
end;
$$;
grant execute on function public.respond_alliance(uuid,boolean) to authenticated;

create or replace function public.resolve_solo_raid(p_target_village_id uuid)
returns uuid
language plpgsql security definer set search_path=public as $$
declare
  uid uuid := auth.uid();
  attacker public.villages%rowtype;
  defender public.villages%rowtype;
  attacker_power integer;
  defender_power integer;
  energy_cost integer := 60;
  p numeric;
  roll numeric;
  won boolean;
  same_kingdom boolean;
  vulnerable_gold bigint;
  defender_gold bigint;
  base_loot bigint;
  loot bigint := 0;
  rep_delta integer := 0;
  raid_uuid uuid := gen_random_uuid();
  active_alliance boolean;
begin
  if uid is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into attacker from public.villages where user_id=uid;
  select * into defender from public.villages where id=p_target_village_id;
  if attacker.id is null or defender.id is null then raise exception 'VILLAGE_NOT_FOUND'; end if;
  if attacker.id=defender.id then raise exception 'SELF_RAID'; end if;
  if defender.created_at > now()-interval '48 hours' then raise exception 'TARGET_NEW_PLAYER_PROTECTION'; end if;
  if defender.raid_shield_until is not null and defender.raid_shield_until > now() then raise exception 'TARGET_SHIELDED'; end if;
  if exists(select 1 from public.raids where attacker_village_id=attacker.id and defender_village_id=defender.id and created_at > now()-interval '24 hours') then raise exception 'TARGET_COOLDOWN'; end if;

  select exists(
    select 1 from public.village_relationships r
    where r.status='active' and
    ((r.requester_village_id=attacker.id and r.responder_village_id=defender.id) or
     (r.requester_village_id=defender.id and r.responder_village_id=attacker.id))
  ) into active_alliance;
  if active_alliance then raise exception 'ALLIED_VILLAGES_CANNOT_RAID'; end if;

  attacker_power := public.player_village_power(attacker.id);
  defender_power := public.player_village_power(defender.id);
  p := greatest(0.18, least(0.86, 0.32 + 0.38 * (attacker_power::numeric / greatest(1,defender_power)::numeric)));
  roll := random();
  won := roll < p;
  same_kingdom := attacker.kingdom_id is not distinct from defender.kingdom_id;

  perform public.apply_resource_transaction('profile',uid,'energy',-energy_cost,'raid',raid_uuid,'raid:'||raid_uuid||':energy',jsonb_build_object('target',defender.id));

  if same_kingdom then rep_delta := -12; end if;
  if won then
    select balance into defender_gold from public.resource_balances where owner_type='village' and owner_id=defender.id and resource='gold' for update;
    vulnerable_gold := greatest(0, coalesce(defender_gold,0) - defender.protected_gold);
    base_loot := least(200, floor(vulnerable_gold * 0.15)::bigint);
    if same_kingdom then base_loot := floor(base_loot * 0.70); end if;
    if attacker_power > defender_power * 1.5 then base_loot := floor(base_loot * 0.25); end if;
    loot := greatest(0, base_loot);
    if loot > 0 then
      perform public.apply_resource_transaction('village',defender.id,'gold',-loot,'raid_loss',raid_uuid,'raid:'||raid_uuid||':defender_gold','{}'::jsonb);
      perform public.apply_resource_transaction('village',attacker.id,'gold',loot,'raid_win',raid_uuid,'raid:'||raid_uuid||':attacker_gold','{}'::jsonb);
    end if;
    update public.villages set raid_shield_until=now()+interval '8 hours' where id=defender.id;
    perform public.apply_resource_transaction('profile',uid,'xp',75,'raid_win',raid_uuid,'raid:'||raid_uuid||':xp','{}'::jsonb);
  else
    perform public.apply_resource_transaction('profile',uid,'xp',25,'raid_loss',raid_uuid,'raid:'||raid_uuid||':xp','{}'::jsonb);
  end if;

  if rep_delta <> 0 then update public.villages set reputation=reputation+rep_delta where id=attacker.id; end if;

  insert into public.raids(id,attacker_village_id,defender_village_id,kind,energy_cost,attacker_power_snapshot,defender_power_snapshot,probability,random_roll,result,loot_gold,reputation_delta,metadata)
  values(raid_uuid,attacker.id,defender.id,'solo',energy_cost,attacker_power,defender_power,p,roll,case when won then 'win' else 'loss' end,loot,rep_delta,jsonb_build_object('sameKingdom',same_kingdom));

  insert into public.notifications(user_id,type,title,body,payload)
  values(defender.user_id,'raid_received',case when won then 'Your village was raided' else 'You defended your village' end,
    attacker.name||case when won then ' stole '||loot||' Gold.' else ' failed to break your defenses.' end,
    jsonb_build_object('raidId',raid_uuid,'attackerVillageId',attacker.id,'loot',loot,'wonByAttacker',won));

  return raid_uuid;
end;
$$;
grant execute on function public.resolve_solo_raid(uuid) to authenticated;
