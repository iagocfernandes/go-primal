import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/server/auth";

const Body = z.object({ timezone: z.string().min(1).max(100) });

function isValidIanaTimezone(value: string) {
  try { new Intl.DateTimeFormat("en-US", { timeZone: value }).format(); return true; }
  catch { return false; }
}

export async function POST(req: NextRequest) {
  try {
    const body = Body.parse(await req.json());
    if (!isValidIanaTimezone(body.timezone)) return NextResponse.json({ error: "INVALID_TIMEZONE" }, { status: 400 });
    const { user, supabase } = await requireUser();
    const { error } = await supabase.from("profiles").update({ timezone: body.timezone, updated_at: new Date().toISOString() }).eq("id", user.id);
    if (error) throw error;
    return NextResponse.json({ timezone: body.timezone });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
