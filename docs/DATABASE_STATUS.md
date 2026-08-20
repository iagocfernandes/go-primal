# Dedicated Supabase Status — 2026-08-19

Project: `go-primal`
Project ref: `csrlvhbmrvblpzogibug`

Applied production foundation:
- Core player/Gorilla/Village/Kingdom schema
- Resource ledger
- Proof Engine
- Strava-ready integration/event queue
- Authoritative game functions
- Alliance consent + solo PvP
- Production hardening and manual review primitives
- Alpha seed Kingdoms: Black Fang / Red Skull
- Security function grant cleanup

The repository migrations are the source of truth from this point forward.

## Remaining environment-only setup
- `SUPABASE_SERVICE_ROLE_KEY`
- `INTEGRATION_ENCRYPTION_KEY`
- `STRAVA_CLIENT_ID`
- `STRAVA_CLIENT_SECRET`
- `STRAVA_WEBHOOK_VERIFY_TOKEN`
- `CRON_SECRET`

Do not commit real server-only secrets.
