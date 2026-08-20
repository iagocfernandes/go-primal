import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decryptSecret, encryptSecret } from "@/lib/server/crypto";
import { getStravaActivity, listStravaActivities, refreshStravaToken } from "./client";
import { normalizeStravaActivity } from "./normalize";
import { dedupeScore } from "@/lib/proof/dedupe";
import { verifyEvidence } from "@/lib/proof/verify";
import type { EvidenceCandidate } from "@/lib/proof/types";

import { AUTO_REVIEW_FLAGS, queueActivityReview } from "@/lib/proof/review";
import { awardActivityById } from "@/lib/proof/rewards";
import { connectedActivityRewardEligibility } from "@/lib/proof/eligibility";

async function integrationForAthlete(providerUserId: string, requireActive = true) {
  const admin = createSupabaseAdminClient();
  let query = admin.from("integrations").select("*").eq("provider", "strava").eq("provider_user_id", providerUserId);
  if (requireActive) query = query.eq("status", "active");
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("STRAVA_INTEGRATION_NOT_FOUND");
  return data;
}


async function integrationForUser(userId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("integrations").select("*")
    .eq("provider", "strava").eq("user_id", userId).eq("status", "active").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("STRAVA_INTEGRATION_NOT_FOUND");
  return data;
}

async function accessTokenForIntegration(integration: any) {
  const admin = createSupabaseAdminClient();
  const expiresAt = integration.expires_at ? new Date(integration.expires_at).getTime() : 0;
  if (expiresAt > Date.now() + 60_000 && integration.access_token_encrypted) {
    return decryptSecret(integration.access_token_encrypted);
  }
  if (!integration.refresh_token_encrypted) throw new Error("STRAVA_MISSING_REFRESH_TOKEN");
  const refreshed = await refreshStravaToken(decryptSecret(integration.refresh_token_encrypted));
  const { error } = await admin.from("integrations").update({
    access_token_encrypted: encryptSecret(refreshed.access_token),
    refresh_token_encrypted: encryptSecret(refreshed.refresh_token),
    expires_at: new Date(refreshed.expires_at * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", integration.id);
  if (error) throw error;
  return refreshed.access_token;
}

async function payloadChecksum(raw: Record<string, unknown>) {
  const checksum = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(raw)));
  return Array.from(new Uint8Array(checksum)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function recomputeVerification(activityId: string, extraRiskFlags: string[] = []) {
  const admin = createSupabaseAdminClient();
  const { data: evidenceRows, error: evReadError } = await admin.from("activity_evidence").select("*").eq("activity_id", activityId);
  if (evReadError) throw evReadError;

  const verification = verifyEvidence((evidenceRows ?? []).map((e: any): EvidenceCandidate => ({
    provider: e.provider,
    externalId: e.external_id,
    sourceName: e.source_name,
    deviceName: e.device_name,
    manual: e.manual,
    hasGps: e.has_gps,
    hasHeartRate: e.has_heart_rate,
    providerFlagged: e.provider_flagged,
    startedAt: e.started_at,
    endedAt: e.ended_at,
    movingSeconds: e.moving_seconds,
    elapsedSeconds: e.elapsed_seconds,
    distanceMeters: e.distance_meters,
    metadata: e.metadata,
    raw: e.raw_payload,
  })));

  const { data: activity } = await admin.from("activities").select("risk_flags").eq("id", activityId).single();
  const riskFlags = [...new Set([...(activity?.risk_flags ?? []), ...extraRiskFlags, ...verification.riskFlags])];

  const { error: verificationError } = await admin.from("activity_verifications").upsert({
    activity_id: activityId,
    level: verification.level,
    internal_score: verification.internalScore,
    risk_flags: riskFlags,
    reasons: verification.reasons,
    ruleset_version: "proof-v2",
    verified_at: new Date().toISOString(),
  });
  if (verificationError) throw verificationError;

  const { error: updateError } = await admin.from("activities").update({
    verification_level: verification.level,
    verification_score: verification.internalScore,
    risk_flags: riskFlags,
    updated_at: new Date().toISOString(),
  }).eq("id", activityId);
  if (updateError) throw updateError;

  return { ...verification, riskFlags };
}

export async function processStravaActivityCreate(
  providerUserId: string,
  objectId: string,
  options: { rewardMode?: "auto" | "history_only" } = {},
) {
  const admin = createSupabaseAdminClient();
  const integration = await integrationForAthlete(providerUserId);

  // Idempotency check comes before the detailed API request. Re-running a sync
  // therefore costs only the list request when every activity is already known.
  const { data: exactEvidence } = await admin.from("activity_evidence")
    .select("activity_id").eq("provider", "strava").eq("user_id", integration.user_id).eq("external_id", objectId).maybeSingle();
  if (exactEvidence?.activity_id) return exactEvidence.activity_id;

  const accessToken = await accessTokenForIntegration(integration);
  const raw = await getStravaActivity(accessToken, objectId);
  const { activity: candidate, evidence } = normalizeStravaActivity(integration.user_id, raw);
  const eligibility = connectedActivityRewardEligibility({
    startedAt: candidate.startedAt,
    connectedAt: integration.connected_at,
    mode: options.rewardMode ?? "auto",
  });

  const windowStart = new Date(new Date(candidate.startedAt).getTime() - 20 * 60_000).toISOString();
  const windowEnd = new Date(new Date(candidate.startedAt).getTime() + 20 * 60_000).toISOString();
  const { data: nearby } = await admin.from("activities").select("*")
    .eq("user_id", integration.user_id)
    .eq("category", candidate.category)
    .gte("started_at", windowStart)
    .lte("started_at", windowEnd)
    .is("merged_into_activity_id", null);

  let canonicalId: string | null = null;
  let reviewDuplicate = false;
  for (const existing of nearby ?? []) {
    const d = dedupeScore(candidate, {
      userId: existing.user_id,
      category: existing.category,
      sportType: existing.sport_type,
      startedAt: existing.started_at,
      endedAt: existing.ended_at,
      movingSeconds: existing.moving_seconds,
      elapsedSeconds: existing.elapsed_seconds,
      distanceMeters: existing.distance_meters,
      elevationMeters: existing.elevation_meters,
      calories: existing.calories,
    });
    if (d.action === "merge") { canonicalId = existing.id; break; }
    if (d.action === "review") reviewDuplicate = true;
  }

  if (!canonicalId) {
    const { data: inserted, error } = await admin.from("activities").insert({
      user_id: candidate.userId,
      title: candidate.title,
      category: candidate.category,
      sport_type: candidate.sportType,
      started_at: candidate.startedAt,
      ended_at: candidate.endedAt,
      moving_seconds: candidate.movingSeconds,
      elapsed_seconds: candidate.elapsedSeconds,
      distance_meters: candidate.distanceMeters,
      elevation_meters: candidate.elevationMeters,
      calories: candidate.calories,
      source_primary: "strava",
      risk_flags: reviewDuplicate ? ["possible_duplicate"] : [],
      reward_eligible: eligibility.eligible,
      reward_eligibility_reason: eligibility.reason,
      reward_status: eligibility.eligible ? "pending" : "ineligible",
    }).select("id").single();
    if (error || !inserted) throw error ?? new Error("ACTIVITY_INSERT_FAILED");
    canonicalId = inserted.id;
  }

  const { error: evidenceError } = await admin.from("activity_evidence").insert({
    activity_id: canonicalId,
    user_id: integration.user_id,
    provider: evidence.provider,
    external_id: evidence.externalId,
    source_name: evidence.sourceName,
    device_name: evidence.deviceName,
    manual: evidence.manual,
    has_gps: evidence.hasGps,
    has_heart_rate: evidence.hasHeartRate,
    provider_flagged: evidence.providerFlagged,
    started_at: evidence.startedAt,
    ended_at: evidence.endedAt,
    moving_seconds: evidence.movingSeconds,
    elapsed_seconds: evidence.elapsedSeconds,
    distance_meters: evidence.distanceMeters,
    metadata: evidence.metadata ?? {},
    raw_payload: evidence.raw ?? {},
    payload_checksum: await payloadChecksum(evidence.raw ?? {}),
  });
  if (evidenceError) throw evidenceError;

  if (!canonicalId) throw new Error("CANONICAL_ACTIVITY_ID_MISSING");
  if (eligibility.eligible) {
    await admin.from("activities").update({
      reward_eligible: true,
      reward_eligibility_reason: eligibility.reason,
      reward_status: "pending",
      updated_at: new Date().toISOString(),
    }).eq("id", canonicalId).neq("reward_status", "awarded");
  }

  const verification = await recomputeVerification(canonicalId, reviewDuplicate ? ["possible_duplicate"] : []);
  if (verification.riskFlags.some((f) => AUTO_REVIEW_FLAGS.has(f))) {
    await queueActivityReview(canonicalId, verification.riskFlags);
  }
  if (eligibility.eligible) await awardActivityById(canonicalId, integration.user_id);
  await admin.from("integrations").update({ last_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", integration.id);
  return canonicalId;
}

export async function processStravaActivityUpdate(providerUserId: string, objectId: string) {
  const admin = createSupabaseAdminClient();
  const integration = await integrationForAthlete(providerUserId);
  const accessToken = await accessTokenForIntegration(integration);
  const raw = await getStravaActivity(accessToken, objectId);
  const { activity: candidate, evidence } = normalizeStravaActivity(integration.user_id, raw);

  const { data: currentEvidence, error: lookupError } = await admin.from("activity_evidence")
    .select("*,activities(*)")
    .eq("provider", "strava").eq("user_id", integration.user_id).eq("external_id", evidence.externalId).maybeSingle();
  if (lookupError) throw lookupError;
  if (!currentEvidence) return processStravaActivityCreate(providerUserId, objectId);

  const existingActivity: any = currentEvidence.activities;
  const distanceBefore = Number(existingActivity?.distance_meters ?? 0);
  const distanceAfter = Number(candidate.distanceMeters ?? 0);
  const activeBefore = Number(existingActivity?.moving_seconds ?? existingActivity?.elapsed_seconds ?? 0);
  const activeAfter = Number(candidate.movingSeconds ?? candidate.elapsedSeconds ?? 0);
  const materiallyChanged = existingActivity && (
    existingActivity.category !== candidate.category ||
    Math.abs(distanceAfter - distanceBefore) > Math.max(250, distanceBefore * 0.05) ||
    Math.abs(activeAfter - activeBefore) > 180
  );
  const changedAfterReward = materiallyChanged && existingActivity?.reward_status === "awarded";

  const { error: evidenceUpdateError } = await admin.from("activity_evidence").update({
    device_name: evidence.deviceName,
    manual: evidence.manual,
    has_gps: evidence.hasGps,
    has_heart_rate: evidence.hasHeartRate,
    provider_flagged: evidence.providerFlagged,
    started_at: evidence.startedAt,
    ended_at: evidence.endedAt,
    moving_seconds: evidence.movingSeconds,
    elapsed_seconds: evidence.elapsedSeconds,
    distance_meters: evidence.distanceMeters,
    metadata: evidence.metadata ?? {},
    raw_payload: evidence.raw ?? {},
    payload_checksum: await payloadChecksum(evidence.raw ?? {}),
  }).eq("id", currentEvidence.id);
  if (evidenceUpdateError) throw evidenceUpdateError;

  const { error: activityUpdateError } = await admin.from("activities").update({
    title: candidate.title,
    category: candidate.category,
    sport_type: candidate.sportType,
    started_at: candidate.startedAt,
    ended_at: candidate.endedAt,
    moving_seconds: candidate.movingSeconds,
    elapsed_seconds: candidate.elapsedSeconds,
    distance_meters: candidate.distanceMeters,
    elevation_meters: candidate.elevationMeters,
    calories: candidate.calories,
    updated_at: new Date().toISOString(),
  }).eq("id", currentEvidence.activity_id);
  if (activityUpdateError) throw activityUpdateError;

  const extra = changedAfterReward ? ["provider_updated_after_reward"] : [];
  const verification = await recomputeVerification(currentEvidence.activity_id, extra);
  if (changedAfterReward || verification.riskFlags.some((f) => AUTO_REVIEW_FLAGS.has(f))) {
    await queueActivityReview(currentEvidence.activity_id, [...verification.riskFlags, ...extra]);
  } else if (existingActivity?.reward_eligible !== false) {
    await awardActivityById(currentEvidence.activity_id, integration.user_id);
  }
  await admin.from("integrations").update({ last_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", integration.id);
  return currentEvidence.activity_id;
}

export async function processStravaDelete(providerUserId: string, objectId: string) {
  const admin = createSupabaseAdminClient();
  const integration = await integrationForAthlete(providerUserId, false).catch(() => null);
  if (!integration) return;
  const { data: evidence } = await admin.from("activity_evidence").select("activity_id,metadata").eq("provider", "strava").eq("user_id", integration.user_id).eq("external_id", objectId).maybeSingle();
  if (!evidence) return;
  await admin.from("activity_evidence").update({ provider_flagged: true, metadata: { ...(evidence.metadata ?? {}), deletedAtProvider: true } }).eq("provider", "strava").eq("user_id", integration.user_id).eq("external_id", objectId);
  const { data: activity } = await admin.from("activities").select("risk_flags,reward_status").eq("id", evidence.activity_id).single();
  const riskFlags = [...new Set([...(activity?.risk_flags ?? []), "provider_deleted"])];
  await admin.from("activities").update({ risk_flags: riskFlags, verification_level: "unverified", updated_at: new Date().toISOString() }).eq("id", evidence.activity_id);
  if (activity?.reward_status === "awarded") {
    const { error: reversalError } = await admin.rpc("reverse_activity_reward", {
      p_activity_id: evidence.activity_id,
      p_reason: "strava_provider_deleted",
    });
    if (reversalError) {
      await queueActivityReview(evidence.activity_id, ["provider_deleted", "reward_reversal_failed"]);
    }
  } else {
    await queueActivityReview(evidence.activity_id, ["provider_deleted"]);
  }
}

export async function processStravaDeauthorization(providerUserId: string) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("integrations").update({
    status: "revoked",
    access_token_encrypted: null,
    refresh_token_encrypted: null,
    expires_at: null,
    updated_at: new Date().toISOString(),
  }).eq("provider", "strava").eq("provider_user_id", providerUserId);
  if (error) throw error;
}

export type StravaSyncResult = {
  fetched: number;
  fallbackUsed: boolean;
  imported: number;
  skippedExisting: number;
  errors: Array<{ objectId: string; error: string }>;
  activities: Array<{
    id: string;
    title: string | null;
    category: string;
    sport_type: string | null;
    started_at: string;
    moving_seconds: number | null;
    elapsed_seconds: number | null;
    distance_meters: number | null;
    reward_eligible: boolean;
    reward_eligibility_reason: string;
    verification_level: string;
    reward_status: string;
    activity_rewards?: { rewards?: Record<string, number> } | null;
  }>;
};

export async function syncStravaForUser(
  userId: string,
  options: { days?: number; limit?: number } = {},
): Promise<StravaSyncResult> {
  const admin = createSupabaseAdminClient();
  const integration = await integrationForUser(userId);
  if (!integration.provider_user_id) throw new Error("STRAVA_PROVIDER_USER_ID_MISSING");

  const accessToken = await accessTokenForIntegration(integration);
  const days = Math.max(1, Math.min(30, options.days ?? 7));
  const limit = Math.max(1, Math.min(20, options.limit ?? 20));
  const after = Math.floor((Date.now() - days * 86_400_000) / 1000);
  let summaries = await listStravaActivities(accessToken, { after, page: 1, perPage: limit });
  let fallbackUsed = false;

  // First-use rescue: a newly connected athlete may have no activity inside the
  // short incremental-sync window. If GO PRIMAL has never imported an activity
  // for this user, fetch the athlete's latest activities regardless of age so
  // the initial integration can be validated immediately. Subsequent syncs stay
  // on the short window to keep API usage predictable.
  if (!summaries.length) {
    const { count, error: countError } = await admin.from("activities")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if (countError) throw countError;
    if ((count ?? 0) === 0) {
      summaries = await listStravaActivities(accessToken, { page: 1, perPage: limit });
      fallbackUsed = true;
    }
  }

  const ordered = [...summaries].sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

  const ids = ordered.map((a) => String(a.id));
  const existingIds = new Set<string>();
  if (ids.length) {
    const { data: existing, error } = await admin.from("activity_evidence")
      .select("external_id")
      .eq("provider", "strava")
      .eq("user_id", userId)
      .in("external_id", ids);
    if (error) throw error;
    for (const row of existing ?? []) existingIds.add(String(row.external_id));
  }

  const importedIds: string[] = [];
  const errors: Array<{ objectId: string; error: string }> = [];
  for (const summary of ordered) {
    const objectId = String(summary.id);
    if (existingIds.has(objectId)) continue;
    try {
      importedIds.push(await processStravaActivityCreate(
        String(integration.provider_user_id),
        objectId,
        { rewardMode: fallbackUsed ? "history_only" : "auto" },
      ));
    } catch (e) {
      errors.push({ objectId, error: e instanceof Error ? e.message : String(e) });
    }
  }

  const now = new Date().toISOString();
  const syncSummary = {
    fetched: ordered.length,
    fallbackUsed,
    imported: importedIds.length,
    skippedExisting: existingIds.size,
    errors: errors.length,
    windowDays: days,
    checkedAt: now,
  };
  const { error: integrationUpdateError } = await admin.from("integrations").update({
    last_sync_at: now,
    metadata: { ...(integration.metadata ?? {}), lastSyncSummary: syncSummary },
    updated_at: now,
  }).eq("id", integration.id);
  if (integrationUpdateError) throw integrationUpdateError;

  let activities: StravaSyncResult["activities"] = [];
  if (importedIds.length) {
    const { data, error } = await admin.from("activities")
      .select("id,title,category,sport_type,started_at,moving_seconds,elapsed_seconds,distance_meters,verification_level,reward_status,reward_eligible,reward_eligibility_reason,activity_rewards(rewards)")
      .in("id", importedIds)
      .order("started_at", { ascending: false });
    if (error) throw error;
    activities = (data ?? []) as StravaSyncResult["activities"];
  }

  return { fetched: ordered.length, fallbackUsed, imported: importedIds.length, skippedExisting: existingIds.size, errors, activities };
}

