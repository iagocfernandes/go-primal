# GO PRIMAL — Production Alpha Architecture

## Principle
The browser renders state and sends intent. The server decides economic state, activity rewards, raid outcomes, reputation changes and other competitive consequences.

## Runtime
- Next.js web app: UI, server routes, auth session.
- Supabase Auth: identity.
- Supabase Postgres: authoritative state + RLS.
- Supabase Storage: activity proof/media (later in P1).
- Strava OAuth + webhooks: first connected activity source.
- Worker/cron: processes webhook queue outside the webhook acknowledgement path.

## Server authority boundaries
Never trust the client for:
- resource balances;
- XP;
- verification status;
- building costs;
- raid probability/result;
- alliance acceptance;
- war score;
- activity source/provenance.

## Event chain
Strava activity -> webhook -> integration_events -> worker -> provider API -> normalize -> dedupe -> evidence -> verification -> reward policy -> immutable ledger -> game state.

## Data ownership
- `activities` is the canonical real-world activity.
- `activity_evidence` may contain several representations of the same activity.
- `resource_transactions` is immutable economic history.
- `resource_balances` is a materialized current balance.
- `gorillas.xp` is synchronized from the XP ledger for convenient reads.

## Deployment gates
1. Local migrations run cleanly.
2. Auth bootstrap works for two accounts.
3. Ledger cannot be mutated from client.
4. Strava webhook deduplicates retries.
5. Same external Strava activity cannot reward twice.
6. Raid resolver runs only on server/database.
7. RLS tests pass for cross-user access.
