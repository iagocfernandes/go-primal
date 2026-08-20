-- GO PRIMAL Production Alpha 0.1 - closed-alpha seed factions
-- Safe to remove/replace before public launch.
insert into public.kingdoms(id,name,slug,visibility,emblem_key)
values
  ('11111111-1111-4111-8111-111111111111','Black Fang','black-fang','open','black-fang'),
  ('22222222-2222-4222-8222-222222222222','Red Skull','red-skull','open','red-skull')
on conflict(slug) do update set name=excluded.name, visibility=excluded.visibility, emblem_key=excluded.emblem_key;
