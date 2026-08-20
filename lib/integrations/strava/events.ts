import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  processStravaActivityCreate,
  processStravaActivityUpdate,
  processStravaDelete,
  processStravaDeauthorization,
} from "@/lib/integrations/strava/processing";

export type ProcessQueueResult = {
  processed: number;
  results: Array<{ id: string; ok: boolean; error?: string }>;
};

export async function processQueuedStravaEvents(limit = 10): Promise<ProcessQueueResult> {
  const admin = createSupabaseAdminClient();
  const { data: events, error } = await admin.from("integration_events")
    .select("*")
    .eq("provider", "strava")
    .in("status", ["queued", "error"])
    .lt("attempts", 5)
    .order("received_at", { ascending: true })
    .limit(Math.max(1, Math.min(25, limit)));
  if (error) throw error;

  const results: Array<{ id: string; ok: boolean; error?: string }> = [];
  for (const event of events ?? []) {
    const attempts = Number(event.attempts ?? 0) + 1;
    const { data: claimed, error: claimError } = await admin.from("integration_events")
      .update({ status: "processing", attempts, last_error: null })
      .eq("id", event.id)
      .in("status", ["queued", "error"])
      .select("id")
      .maybeSingle();
    if (claimError) {
      results.push({ id: event.id, ok: false, error: claimError.message });
      continue;
    }
    if (!claimed) continue;

    try {
      if (event.object_type === "activity" && event.aspect_type === "create") {
        await processStravaActivityCreate(String(event.provider_user_id), String(event.object_id));
      } else if (event.object_type === "activity" && event.aspect_type === "update") {
        await processStravaActivityUpdate(String(event.provider_user_id), String(event.object_id));
      } else if (event.object_type === "activity" && event.aspect_type === "delete") {
        await processStravaDelete(String(event.provider_user_id), String(event.object_id));
      } else if (
        event.object_type === "athlete" &&
        event.aspect_type === "update" &&
        String(event.payload?.updates?.authorized) === "false"
      ) {
        await processStravaDeauthorization(String(event.provider_user_id));
      }

      await admin.from("integration_events").update({
        status: "processed",
        processed_at: new Date().toISOString(),
        last_error: null,
      }).eq("id", event.id);
      results.push({ id: event.id, ok: true });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const finalStatus = attempts >= 5 ? "error" : "queued";
      await admin.from("integration_events").update({
        status: finalStatus,
        last_error: message,
      }).eq("id", event.id);
      results.push({ id: event.id, ok: false, error: message });
    }
  }

  return { processed: results.length, results };
}
