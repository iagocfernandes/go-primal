# GO PRIMAL — Proof Engine V1

## Goal
Competitive rewards must be based on credible real-world effort without making expensive hardware pay-to-win.

## Public levels
- VERIFIED: strong connected evidence.
- CONNECTED: trusted provider activity with reasonable provenance.
- PROOF SUBMITTED: manual activity with user evidence, normally reviewable.
- UNVERIFIED: insufficient evidence; no competitive reward.

The internal score is not shown to players. It is an anti-abuse input, not a prestige score.

## Canonicalization
One real activity may arrive from several systems. GO PRIMAL stores one canonical `activity` and many `activity_evidence` rows.

Example:
- Apple Watch workout -> HealthKit evidence.
- Strava imports the same workout -> Strava evidence.
- User attaches a photo -> manual/media evidence.
All should enrich one activity, not pay three rewards.

## Dedupe V1
Candidate activities must share the category. Score similarities in:
- start time;
- duration;
- distance when applicable.
Auto-merge >=85, review 65–84, keep separate <65.

## Risk flags
Initial flags:
- manual_entry
- provider_flagged
- possible_duplicate
- provider_deleted
- impossible_speed (planned)
- overlapping_rewarded_activity (planned)
- suspicious_volume (planned)
- source_changed_after_reward (planned)

## Reward rule
Hardware quality must not multiply normal rewards. Verification gates eligibility and high-impact missions; it should not turn Apple Watch ownership into military advantage.

## Strava P1
- OAuth2 connection.
- Webhook queue for create/delete/update events.
- Fetch detailed activity server-side.
- Store token encrypted at rest with application key.
- Normalize into canonical model.
- Dedupe and verify.
- Award via immutable ledger.

## Native health sources P2
HealthKit and Health Connect join the same evidence model. The web product remains the game; small native companion clients can sync platform-only health data before a full native app exists.
