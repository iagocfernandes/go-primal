import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyEvidence } from "@/lib/proof/verify";
import { queueActivityReview } from "@/lib/proof/review";

const Body = z.object({
  category: z.enum(["train","focus","move"]),
  startedAt: z.string().datetime(),
  elapsedSeconds: z.number().int().min(60).max(12 * 3600),
  distanceMeters: z.number().nonnegative().max(500_000).nullable().optional(),
  proofStoragePath: z.string().min(1).max(500).nullable().optional(),
  note: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const body = Body.parse(await req.json());
  const { user } = await requireUser();
  const admin = createSupabaseAdminClient();
  if (body.proofStoragePath && !body.proofStoragePath.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: "INVALID_PROOF_PATH" }, { status: 400 });
  }
  const started = new Date(body.startedAt);
  const ended = new Date(started.getTime() + body.elapsedSeconds * 1000);
  const externalId = `manual:${crypto.randomUUID()}`;

  const evidence = {
    provider: "manual" as const,
    externalId,
    sourceName: "GO PRIMAL manual proof",
    deviceName: null,
    manual: true,
    hasGps: false,
    hasHeartRate: false,
    providerFlagged: false,
    startedAt: started.toISOString(),
    endedAt: ended.toISOString(),
    elapsedSeconds: body.elapsedSeconds,
    distanceMeters: body.distanceMeters ?? null,
    metadata: { hasPhoto: Boolean(body.proofStoragePath), note: body.note ?? null },
  };
  const verification = verifyEvidence([evidence]);

  const { data: activity, error } = await admin.from("activities").insert({
    user_id: user.id,
    title: body.category === "train" ? "Manual training" : body.category === "focus" ? "Manual focus" : "Manual movement",
    category: body.category,
    started_at: started.toISOString(),
    ended_at: ended.toISOString(),
    elapsed_seconds: body.elapsedSeconds,
    distance_meters: body.distanceMeters ?? null,
    source_primary: "manual",
    verification_level: verification.level,
    verification_score: verification.internalScore,
    risk_flags: verification.riskFlags,
    reward_status: body.proofStoragePath ? "pending" : "rejected",
  }).select("id").single();
  if (error || !activity) return NextResponse.json({ error: error?.message ?? "ACTIVITY_CREATE_FAILED" }, { status: 400 });

  await admin.from("activity_evidence").insert({
    activity_id: activity.id,
    user_id: user.id,
    provider: "manual",
    external_id: externalId,
    source_name: evidence.sourceName,
    manual: true,
    has_gps: false,
    has_heart_rate: false,
    provider_flagged: false,
    started_at: evidence.startedAt,
    ended_at: evidence.endedAt,
    elapsed_seconds: body.elapsedSeconds,
    distance_meters: body.distanceMeters ?? null,
    metadata: evidence.metadata,
  });
  await admin.from("activity_verifications").insert({
    activity_id: activity.id,
    level: verification.level,
    internal_score: verification.internalScore,
    risk_flags: verification.riskFlags,
    reasons: verification.reasons,
    ruleset_version: "proof-v1",
  });
  if (body.proofStoragePath) {
    await admin.from("activity_media").insert({ activity_id: activity.id, user_id: user.id, storage_path: body.proofStoragePath });
    await queueActivityReview(activity.id, ["manual_proof"]);
  }

  // Manual proofs are intentionally queued for Alpha review before economic reward.
  return NextResponse.json({ activityId: activity.id, verification: verification.level, reviewRequired: true });
}
