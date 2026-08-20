-- Restrict public/anon execution on SECURITY DEFINER functions.
revoke all on function public.bootstrap_player(text,text,text,uuid) from public,anon;
grant execute on function public.bootstrap_player(text,text,text,uuid) to authenticated;
revoke all on function public.request_alliance(uuid) from public,anon;
grant execute on function public.request_alliance(uuid) to authenticated;
revoke all on function public.respond_alliance(uuid,boolean) from public,anon;
grant execute on function public.respond_alliance(uuid,boolean) to authenticated;
revoke all on function public.upgrade_own_building(text,text) from public,anon;
grant execute on function public.upgrade_own_building(text,text) to authenticated;
revoke all on function public.resolve_solo_raid_idempotent(uuid,text) from public,anon;
grant execute on function public.resolve_solo_raid_idempotent(uuid,text) to authenticated;
revoke all on function public.sync_gorilla_xp_from_balance() from public,anon,authenticated;
grant execute on function public.sync_gorilla_xp_from_balance() to service_role;
revoke all on function public.player_village_power(uuid) from public,anon;
grant execute on function public.player_village_power(uuid) to authenticated,service_role;
