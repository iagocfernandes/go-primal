# GO PRIMAL Production Alpha 0.1.5 — Reward Integrity Hardening

- Historical Strava backfill remains visible but is reward-ineligible.
- Connected activities receive a 24h first-connection grace window; older history never pays resources.
- Activity reward policy uses moving/active time before elapsed wall-clock time.
- Proof Engine V2 promotes strong Strava provenance (device + GPS/HR) to VERIFIED.
- Extreme elapsed-vs-moving duration is preserved as source data but flagged as `elapsed_time_outlier`.
- Activity feed shows moving time and explicit `History · no reward` state.
- Reward ledger policy/idempotency version moves to activity-v2.
