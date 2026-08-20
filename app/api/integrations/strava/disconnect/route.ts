import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/server/crypto";
import { revokeStravaToken } from "@/lib/integrations/strava/client";

export async function POST() {
  try {
    const { user } = await requireUser();
    const admin = createSupabaseAdminClient();
    const { data: integration, error } = await admin.from("integrations").select("*").eq("user_id", user.id).eq("provider", "strava").maybeSingle();
    if (error) throw error;
    if (!integration) return NextResponse.json({ disconnected: true });
    let remoteWarning: string | null = null;
    if (integration.refresh_token_encrypted) {
      try { await revokeStravaToken(decryptSecret(integration.refresh_token_encrypted), "refresh_token"); }
      catch (e) { remoteWarning = e instanceof Error ? e.message : String(e); }
    }
    await admin.from("integrations").update({ status: "revoked", access_token_encrypted: null, refresh_token_encrypted: null, expires_at: null, updated_at: new Date().toISOString() }).eq("id", integration.id);
    return NextResponse.json({ disconnected: true, remoteWarning });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
