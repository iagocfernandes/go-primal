import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/server/auth";
import { exchangeStravaCode } from "@/lib/integrations/strava/client";
import { encryptSecret } from "@/lib/server/crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { syncStravaForUser } from "@/lib/integrations/strava/processing";

export async function GET(req: NextRequest) {
  const { user } = await requireUser();
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const jar = await cookies();
  const expectedState = jar.get("strava_oauth_state")?.value;
  jar.delete("strava_oauth_state");

  if (error) return NextResponse.redirect(new URL(`/activity?integration=strava&error=${encodeURIComponent(error)}`, req.url));
  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.json({ error: "INVALID_OAUTH_STATE" }, { status: 400 });
  }

  const token = await exchangeStravaCode(code);
  const admin = createSupabaseAdminClient();
  const connectedAt = new Date().toISOString();
  const { error: upsertError } = await admin.from("integrations").upsert({
    user_id: user.id,
    provider: "strava",
    status: "active",
    provider_user_id: token.athlete?.id ? String(token.athlete.id) : null,
    scopes: (url.searchParams.get("scope") ?? "").split(",").filter(Boolean),
    access_token_encrypted: encryptSecret(token.access_token),
    refresh_token_encrypted: encryptSecret(token.refresh_token),
    expires_at: new Date(token.expires_at * 1000).toISOString(),
    metadata: { athlete: token.athlete ?? null },
    last_sync_at: null,
    connected_at: connectedAt,
    updated_at: connectedAt,
  }, { onConflict: "user_id,provider" });
  if (upsertError) throw upsertError;

  // First connection should feel alive immediately. Import a small recent window,
  // but never fail OAuth itself if Strava sync is temporarily unavailable.
  let syncState = "ok";
  try {
    await syncStravaForUser(user.id, { days: 7, limit: 10 });
  } catch {
    syncState = "pending";
  }

  return NextResponse.redirect(new URL(`/activity?integration=strava&connected=1&sync=${syncState}`, req.url));
}
