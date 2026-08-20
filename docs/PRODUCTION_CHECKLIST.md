# Production Alpha 0.1 — Launch Checklist

## P0 Foundation — DONE / MOSTLY DONE
- [x] Dedicated Supabase project
- [x] Versioned database schema
- [x] RLS baseline
- [x] Immutable resource ledger
- [x] Alpha Kingdom seed data
- [x] Private activity-proof bucket
- [x] Add SUPABASE_SERVICE_ROLE_KEY locally and in hosting secrets
- [x] Configure final Auth redirect/site URLs after deployment

## P0.5 Proof Engine — BACKEND MODEL DONE
- [x] Canonical activities table
- [x] Activity evidence model
- [x] Verification level + internal score
- [x] Risk flags
- [x] Reward record + reversal
- [x] Daily movement aggregate model
- [x] Manual proof storage path
- [ ] End-to-end integration test with a real account

## P1 Strava — LIVE (webhook subscription 367106)
- [x] OAuth route scaffold
- [x] Callback scaffold
- [x] Webhook endpoint scaffold
- [x] Raw event queue model
- [x] Normalization/dedupe/verification code scaffold
- [x] Create/register Strava developer app
- [x] Add Client ID / Secret
- [x] Set callback URL
- [x] Register webhook subscription using deployed HTTPS URL
- [x] Connect Iago's Strava and import first real activity
- [ ] Validate duplicate handling

## P2 Core Game
- [x] Persistent buildings model
- [x] Server-side idempotent upgrade function
- [x] Village power function
- [ ] Production UI wired entirely to Supabase state
- [ ] Activity reward feedback uses real ledger values
- [ ] Visual Village stage changes from real building progression

## P3 Multiplayer
- [x] Village discovery data model
- [x] Alliance request and responder consent
- [x] Server-authoritative solo raid
- [x] Raid cooldown / shield / new-player protection
- [ ] Test with two separate real accounts
- [ ] Notifications UI
- [ ] Retaliate flow
- [ ] Warband after solo PvP is stable

## P4 Closed Alpha
- [x] Deploy staging
- [x] Deploy production alpha
- [ ] Invite 5 users
- [ ] Increase to max 10 after stability
- [ ] Instrument incremental-behavior question
- [ ] Weekly balance review

## Not yet
- Apple HealthKit companion
- Android Health Connect
- Screen Time / Focus verification
- Kingdom War production system
- World map
- Marketplace
- Deep equipment stats
