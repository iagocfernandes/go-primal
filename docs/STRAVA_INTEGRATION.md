# GO PRIMAL × Strava — Production Alpha

## What the integration does
- OAuth 2.0 connection with `read,activity:read_all`.
- Tokens are encrypted server-side and never exposed to the browser.
- Initial sync checks the last 7 days, max 20 activities.
- Re-sync is idempotent: known Strava activity IDs are skipped before detailed API calls.
- New activities become canonical GO PRIMAL activities, receive evidence, verification, deduplication and then server-authoritative rewards.
- The user's own Activity screen may display their own Strava-derived evidence. Strava data must not be exposed to other GO PRIMAL users.

## Rate-limit discipline
The Alpha uses one list request per sync plus one detail request only for each newly discovered activity. This is intentional because backfill/polling can exhaust Strava read limits. Webhooks are the next step for incremental updates.

## Important product/legal gate
As of the June 1, 2026 Strava developer terms and current developer site, Strava explicitly warns that API access can be revoked for uses that enable virtual races or competitions. GO PRIMAL is a competitive strategy game whose resources can be influenced by real-world effort, so this is a material review risk.

For the internal single-player Production Alpha, Strava is treated as a private proof provider. Before Strava-derived rewards are used in a public competitive mode or a multi-user closed alpha, obtain clarification/approval from Strava (developers@strava.com) and keep Apple Health / Health Connect / GO PRIMAL native evidence as independent production paths.
