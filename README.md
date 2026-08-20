# GO PRIMAL — Production Alpha 0.1.6

> **Your real life builds this world.**

GO PRIMAL is a competitive strategy game where meaningful real-world effort powers a persistent virtual civilization.

This repository is the production-oriented source of truth for the current closed-alpha build.

## Current product loop

```text
Real-world activity
        ↓
Connected provider / proof
        ↓
Proof Engine
        ↓
Canonical activity
        ↓
Verification + risk checks
        ↓
Reward ledger
        ↓
Gorilla / Village progression
        ↓
Social strategy, alliances and raids
```

## What is already implemented

- Supabase authentication
- Persistent player, Gorilla and Village
- Kingdom membership
- Great Hall, Forge, Barracks and Research Lab
- Immutable resource ledger
- Energy, XP, Knowledge and Exploration foundations
- Strava OAuth
- Initial Strava sync and historical backfill
- Canonical activity model
- Activity evidence and provider provenance
- Proof Engine V2
- Verification states and risk flags
- Reward eligibility separate from verification
- Historical backfill with no reward
- Reward reversal
- Manual proof fallback
- Alliance request / accept flow
- Server-authoritative raid foundations
- Strava webhook queue
- Public Supabase Edge Function webhook receiver
- Staging / webhook deployment preparation
- Visual prototype assets and current production UI

## Production principle

**The browser never owns competitive truth.**

Resource balances, rewards, raid outcomes, relationship changes and future War Score are calculated server-side and are auditable.

## Repository structure

```text
app/                    Next.js App Router pages and API routes
components/             Product UI components
lib/                    Game, Proof Engine, integrations and server logic
public/assets/          Current game / visual prototype assets
supabase/migrations/    Versioned database schema
supabase/functions/     Edge Functions, including the Strava webhook receiver
docs/                   Architecture, roadmap, Proof Engine and Master Blueprint
```

## Local development

```bash
cp .env.example .env.local
npm install
npm run typecheck
npm run build
npm run dev
```

Then open:

```text
http://localhost:3000
```

## Required local environment variables

See `.env.example`.

Never commit:

- `SUPABASE_SERVICE_ROLE_KEY`
- `STRAVA_CLIENT_SECRET`
- `INTEGRATION_ENCRYPTION_KEY`
- `CRON_SECRET`
- provider access/refresh tokens

The Supabase project URL and publishable/anon key are client-side values and may be present in `.env.example`.

## Current milestone

The real-world activity pipeline has been proven with real Strava activities:

```text
Strava
→ Initial Sync
→ Canonical Activity
→ Evidence
→ Proof Engine
→ Reward policy
→ Resource ledger
```

The next major milestone is:

```text
New real activity
→ Strava webhook
→ automatic ingestion
→ one-time reward
→ visible consequence in the Village
```

After that, priority moves to the **game experience layer**: reward moments, visible Village change, Gorilla progression, multiplayer pressure and closed-alpha testing.

## Important product rule

Connected hardware must improve **credibility**, not directly create pay-to-win power.

A player without an expensive wearable must still be able to play. Stronger evidence can unlock high-trust competitive actions or special missions, but hardware ownership is not a raw power multiplier.

## Documentation

Start with:

- `docs/GO_PRIMAL_Master_Blueprint_v1_1.docx`
- `docs/ARCHITECTURE.md`
- `docs/PROOF_ENGINE.md`
- `docs/ROADMAP.md`
- `docs/STRAVA_INTEGRATION.md`
- `docs/STAGING_AND_STRAVA_WEBHOOK.md`

## Status

**Production Alpha — private development / closed-alpha preparation.**

Not ready for public release.
