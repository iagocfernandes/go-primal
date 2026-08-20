# Production Alpha 0.1.2 — First Real Loop

- Added initial Strava sync (7 days, max 20 activities).
- Added manual `SYNC STRAVA` action.
- OAuth callback now attempts a small automatic initial sync.
- Added canonical activity titles (`Corrida matinal`, etc.).
- Added evidence details to Activity feed (provider, device, GPS, HR, manual status).
- Added activity reward display from the immutable ledger/reward record.
- Sync is idempotent and skips known external IDs before detail calls.
- Updated Strava API data hostname for the 2026 v3 transition.
- Added Strava compliance/rate-limit notes.
- Includes Auth Fix 0.1.1 (signup, forgot password, reset password).
