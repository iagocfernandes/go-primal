import { NextRequest, NextResponse } from "next/server";
import { processQueuedStravaEvents } from "@/lib/integrations/strava/events";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  return NextResponse.json(await processQueuedStravaEvents(25));
}
