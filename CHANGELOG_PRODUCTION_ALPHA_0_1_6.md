# GO PRIMAL Production Alpha 0.1.6

## Webhook automation + staging readiness

- Strava webhook persists events idempotently and acknowledges immediately.
- Uses Next.js `after()` to process queued Strava events after the webhook response.
- Shared queue worker for webhook background processing and manual recovery endpoint.
- Retries failed events up to five attempts.
- Provider activity deletion reverses previously awarded resources when possible.
- Manual protected worker endpoint remains available at `/api/jobs/process-strava-events`.
- Production version bumped to 0.1.6.

## Required production secrets

- NEXT_PUBLIC_APP_URL
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- INTEGRATION_ENCRYPTION_KEY
- STRAVA_CLIENT_ID
- STRAVA_CLIENT_SECRET
- STRAVA_WEBHOOK_VERIFY_TOKEN
- CRON_SECRET
