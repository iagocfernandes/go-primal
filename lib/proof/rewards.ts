import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { rewardActivity } from "@/lib/game/policy";
import { AUTO_REVIEW_FLAGS, queueActivityReview } from "@/lib/proof/review";

export async function awardActivityById(activityId: string, userId: string, options: { reviewApproved?: boolean } = {}) {
  const admin = createSupabaseAdminClient();
  const { data: activity, error: activityError } = await admin.from("activities").select("*").eq("id", activityId).eq("user_id", userId).single();
  if (activityError || !activity) throw activityError ?? new Error("ACTIVITY_NOT_FOUND");
  if (activity.reward_status === "awarded") return { awarded: true, alreadyAwarded: true };
  if (["rejected", "reversed", "ineligible"].includes(activity.reward_status)) return { awarded: false, reason: activity.reward_status };
  if (activity.reward_eligible === false) {
    const reason = activity.reward_eligibility_reason ?? "ineligible";
    const { error: eligibilityError } = await admin.from("activities").update({
      reward_status: "ineligible",
      updated_at: new Date().toISOString(),
    }).eq("id", activityId);
    if (eligibilityError) throw eligibilityError;
    return { awarded: false, reason };
  }

  const risky = (activity.risk_flags ?? []).filter((flag: string) => AUTO_REVIEW_FLAGS.has(flag));
  const autoEligible = ["verified", "connected"].includes(activity.verification_level) && risky.length === 0;
  if (!autoEligible && !options.reviewApproved) {
    await queueActivityReview(activityId, risky.length ? risky : [`verification:${activity.verification_level}`]);
    return { awarded: false, reviewQueued: true };
  }

  const { data: localCount, error: countError } = await admin.rpc("count_rewarded_activities_local_day", {
    p_user_id: userId,
    p_category: activity.category,
    p_started_at: activity.started_at,
  });
  if (countError) throw countError;

  const bundle = rewardActivity({
    category: activity.category,
    verifiedLevel: activity.verification_level,
    elapsedSeconds: activity.moving_seconds ?? activity.elapsed_seconds,
    distanceMeters: activity.distance_meters,
    validActivitiesToday: Number(localCount ?? 0),
  });

  const entries = [
    ["energy", bundle.energy],
    ["knowledge", bundle.knowledge],
    ["exploration", bundle.exploration],
    ["xp", bundle.xp],
  ] as const;

  for (const [resource, amount] of entries) {
    if (!amount) continue;
    const { error } = await admin.rpc("apply_resource_transaction", {
      p_owner_type: "profile",
      p_owner_id: userId,
      p_resource: resource,
      p_amount: amount,
      p_source_type: "activity_reward",
      p_source_id: activityId,
      p_idempotency_key: `activity:${activityId}:${resource}:v2`,
      p_metadata: { verification: activity.verification_level, category: activity.category, policy: "activity-v2", eligibility: activity.reward_eligibility_reason },
    });
    if (error) throw error;
  }

  const { error: rewardError } = await admin.from("activity_rewards").upsert({
    activity_id: activityId,
    policy_version: "activity-v2",
    rewards: bundle,
    awarded_at: new Date().toISOString(),
    metadata: { reviewed: Boolean(options.reviewApproved) },
  });
  if (rewardError) throw rewardError;
  const { error: activityUpdateError } = await admin.from("activities").update({ reward_status: "awarded", updated_at: new Date().toISOString() }).eq("id", activityId);
  if (activityUpdateError) throw activityUpdateError;
  return { awarded: true, rewards: bundle };
}
