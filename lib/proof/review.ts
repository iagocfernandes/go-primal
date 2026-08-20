import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const AUTO_REVIEW_FLAGS = new Set([
  "provider_flagged",
  "possible_duplicate",
  "provider_deleted",
  "provider_updated_after_reward",
]);

export async function queueActivityReview(activityId: string, reasons: string[]) {
  const admin = createSupabaseAdminClient();
  const normalized = [...new Set(reasons)].filter(Boolean);
  const { error } = await admin.from("activity_reviews").upsert({
    activity_id: activityId,
    status: "queued",
    reasons: normalized,
    updated_at: new Date().toISOString(),
  }, { onConflict: "activity_id" });
  if (error) throw error;
}
