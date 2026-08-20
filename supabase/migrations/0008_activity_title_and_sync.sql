-- GO PRIMAL Production Alpha 0.1.2
-- Canonical activities need a user-facing title independent from provider sport type.
alter table public.activities add column if not exists title text;
comment on column public.activities.title is 'User-facing canonical activity title, e.g. Strava activity name.';
