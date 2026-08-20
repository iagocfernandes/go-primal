-- GO PRIMAL: explicit reward eligibility is separate from proof verification.
alter table public.activities
  add column if not exists reward_eligible boolean not null default false,
  add column if not exists reward_eligibility_reason text not null default 'not_evaluated';

create index if not exists activities_reward_eligibility_idx
  on public.activities(user_id, reward_eligible, started_at desc);
