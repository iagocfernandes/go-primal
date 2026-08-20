import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// The hosted production function uses the same verification token registered with Strava.
// Prefer setting this as a Supabase Edge Function secret before public alpha.
const VERIFY_TOKEN = Deno.env.get("STRAVA_WEBHOOK_VERIFY_TOKEN") ?? "SET_IN_SUPABASE_SECRETS";

function adminClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const secretMap = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
  const key = secretMap.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const verifyToken = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && verifyToken === VERIFY_TOKEN && challenge) {
      return json({ "hub.challenge": challenge });
    }
    return json({ error: "WEBHOOK_VERIFICATION_FAILED" }, 403);
  }
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  let payload: any;
  try { payload = await req.json(); } catch { return json({ error: "INVALID_JSON" }, 400); }

  const externalEventId = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify({
      owner_id: payload.owner_id,
      object_type: payload.object_type,
      object_id: payload.object_id,
      aspect_type: payload.aspect_type,
      event_time: payload.event_time,
      subscription_id: payload.subscription_id,
    })),
  ).then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join(""));

  const admin = adminClient();
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

  if (error) {
    console.error("[GO PRIMAL][STRAVA_WEBHOOK]", error.message);
    return json({ error: "EVENT_PERSIST_FAILED" }, 500);
  }
  return json({ ok: true });
});
