# GO PRIMAL — Staging + Strava Webhook

Last verified: 2026-08-19

## Deployment

Production is served by Vercel at `https://go-primal.vercel.app`.

`vercel.json` pins `framework: nextjs`, the build command and the output
directory. **Do not delete it.** The Vercel project was originally created with
`framework: null`, which made it publish only `public/` as a static site: the
build reported READY while every app route returned a plain-text 404 from the
edge. Declaring the framework in the repo is what keeps that from coming back.

Diagnostic for a future 404: compare an app route against a static file in
`public/`.

```bash
curl -sS -o /dev/null -w "%{http_code} %{content_type}\n" https://go-primal.vercel.app/api/health
curl -sS -o /dev/null -w "%{http_code} %{content_type}\n" https://go-primal.vercel.app/assets/gorilla-base.jpg
```

Static 200 + route 404 `text/plain` means framework detection, not a missing route.

## Vercel environment variables

Set these for Preview and Production:

- NEXT_PUBLIC_APP_URL
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- INTEGRATION_ENCRYPTION_KEY
- STRAVA_CLIENT_ID
- STRAVA_CLIENT_SECRET
- STRAVA_WEBHOOK_VERIFY_TOKEN
- CRON_SECRET

Never commit server-only values.

`NEXT_PUBLIC_APP_URL` must be the real domain in Vercel and stay
`http://localhost:3000` in `.env.local`. It is inlined at build time, so
changing it requires a redeploy. It is only read by `stravaAuthorizeUrl()` in
`lib/integrations/strava/client.ts`, meaning a wrong value stays invisible until
somebody runs a *fresh* Strava connect.

## Auth URL configuration (Supabase)

- Site URL: `https://go-primal.vercel.app`
- Redirect URLs:
  - `http://localhost:3000/**` (local development)
  - `https://go-primal.vercel.app/**` (production)
  - `https://go-primal-*-iagocfernandes-4464s-projects.vercel.app/**` (preview deploys)

## Public webhook receiver

The active receiver is the **Next.js route**:

```
https://go-primal.vercel.app/api/integrations/strava/webhook
```

Strava push subscription: **id 367106**, application 273280.

`GET` answers the subscription handshake. `POST` hashes the event into an
idempotent `external_event_id`, upserts it into `integration_events` as
`queued`, and returns immediately — the actual work runs in `after()`, because
Strava expects a fast 2xx. `/api/jobs/process-strava-events` remains a protected
recovery endpoint for replaying a stuck queue.

Strava allows **one push subscription per application**. The Supabase Edge
Function `strava-webhook` predates the working Vercel deploy and is now dormant:
it receives nothing. Pointing the subscription at it would silence the Next
route, and vice versa — they cannot both be live.

### Testing the handshake without creating anything

```bash
set -a && . ./.env.local && set +a
curl -sS "https://go-primal.vercel.app/api/integrations/strava/webhook?hub.mode=subscribe&hub.challenge=ping&hub.verify_token=$STRAVA_WEBHOOK_VERIFY_TOKEN"
```

Expected: `{"hub.challenge":"ping"}`. A wrong token must return 403
`WEBHOOK_VERIFICATION_FAILED`. This is the first thing to run when the webhook
goes quiet — it proves both the route and `STRAVA_WEBHOOK_VERIFY_TOKEN` in the
Vercel environment.

### Listing or removing the subscription

```bash
set -a && . ./.env.local && set +a
curl -sS "https://www.strava.com/api/v3/push_subscriptions?client_id=$STRAVA_CLIENT_ID&client_secret=$STRAVA_CLIENT_SECRET"
```

Always redact the secret before pasting output anywhere.

## Strava callback domain

The Strava application accepts a **single** Authorization Callback Domain, now
set to `go-primal.vercel.app`. Consequence: the Strava OAuth connect flow no
longer works on `localhost` or on preview deploys. Everything else — Supabase
auth, Village, Activity, manual sync — still works locally. To develop against
Strava locally, register a second Strava application for development and use its
credentials in `.env.local`.

## Reward integrity

Historical backfill is history-only. New eligible activities are rewarded once.
Deleting a rewarded provider activity attempts an immediate resource reversal and
falls back to admin review if exact reversal is impossible.
