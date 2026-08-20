import crypto from "node:crypto";
import { after, NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { processQueuedStravaEvents } from "@/lib/integrations/strava/events";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const verifyToken = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && verifyToken === process.env.STRAVA_WEBHOOK_VERIFY_TOKEN && challenge) {
    return NextResponse.json({ "hub.challenge": challenge });
  }
  return NextResponse.json({ error: "WEBHOOK_VERIFICATION_FAILED" }, { status: 403 });
}

export async function POST(req: NextRequest) {
  const payload = await req.json();
  const externalEventId = crypto.createHash("sha256").update(JSON.stringify({
    owner_id: payload.owner_id,
    object_type: payload.object_type,
    object_id: payload.object_id,
    aspect_type: payload.aspect_type,
    event_time: payload.event_time,
    subscription_id: payload.subscription_id,
  })).digest("hex");

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("integration_events").upsert({
    provider: "strava",
    external_event_id: externalEventId,
    provider_user_id: payload.owner_id ? String(payload.owner_id) : null,
    object_type: payload.object_type ?? null,
    object_id: payload.object_id ? String(payload.object_id) : null,
    aspect_type: payload.aspect_type ?? null,
    payload,
    status: "queued",
  }, { onConflict: "provider,external_event_id", ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: "EVENT_PERSIST_FAILED" }, { status: 500 });

  // Strava expects a fast 2xx response. Vercel's after() lets us continue work
  // after the response without making the webhook wait for Strava/API/database work.
  after(async () => {
    try {
      await processQueuedStravaEvents(10);
    } catch (error) {
      console.error("[GO PRIMAL][STRAVA_WEBHOOK_BACKGROUND]", error);
    }
  });

  return NextResponse.json({ ok: true });
}
