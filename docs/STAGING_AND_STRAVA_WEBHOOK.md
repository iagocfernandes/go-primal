# GO PRIMAL — Staging + Strava Webhook

## Vercel environment variables
Set these for Preview and Production before deploying the full app:

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

## Public webhook receiver
A Supabase Edge Function named `strava-webhook` is used as the public receiver. It only validates the subscription handshake, persists an idempotent event into `integration_events`, and returns quickly.

The Next.js backend owns the processing queue. `/api/jobs/process-strava-events` remains a protected recovery endpoint; the Next.js webhook route can also process via `after()` once the Vercel app is public.

## Reward integrity
Historical backfill is history-only. New eligible activities are rewarded once. Deleting a rewarded provider activity attempts an immediate resource reversal and falls back to admin review if exact reversal is impossible.
