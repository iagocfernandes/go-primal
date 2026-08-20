import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/server/auth";
import { stravaAuthorizeUrl } from "@/lib/integrations/strava/client";

export async function GET() {
  await requireUser();
  const state = crypto.randomBytes(24).toString("base64url");
  const jar = await cookies();
  jar.set("strava_oauth_state", state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 600, path: "/" });
  return NextResponse.redirect(stravaAuthorizeUrl(state));
}
