import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { syncStravaForUser } from "@/lib/integrations/strava/processing";

const Body = z.object({
  days: z.number().int().min(1).max(30).optional(),
  limit: z.number().int().min(1).max(20).optional(),
}).default({});

function describeError(error: unknown) {
  if (!(error instanceof Error)) return String(error);
  const cause = (error as Error & { cause?: unknown }).cause;
  if (cause instanceof Error) return `${error.message} | cause: ${cause.message}`;
  if (cause && typeof cause === "object" && "code" in cause) {
    return `${error.message} | cause: ${String((cause as { code?: unknown }).code)}`;
  }
  return error.message;
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireUser();
    let parsed: unknown = {};
    const text = await req.text();
    if (text.trim()) parsed = JSON.parse(text);
    const body = Body.parse(parsed);
    const result = await syncStravaForUser(user.id, body);
    return NextResponse.json(result);
  } catch (error) {
    const message = describeError(error);
    console.error("[GO PRIMAL][STRAVA_SYNC]", message, error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
