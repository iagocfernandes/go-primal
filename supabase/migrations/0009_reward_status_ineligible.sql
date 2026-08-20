-- Distinguish valid history from rejected/suspicious activity.
alter type public.reward_status add value if not exists 'ineligible' after 'pending';
