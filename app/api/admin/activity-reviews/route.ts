import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin";

export async function GET(req: NextRequest) {
  try {
    const { admin } = await requireAdmin();
    const status = new URL(req.url).searchParams.get("status") ?? "queued";
    const { data, error } = await admin.from("activity_reviews")
      .select("*,activities(*,activity_evidence(*),activity_verifications(*),activity_rewards(*))")
      .eq("status", status)
      .order("created_at", { ascending: true })
      .limit(50);
    if (error) throw error;
    return NextResponse.json({ reviews: data ?? [] });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: message === "FORBIDDEN" ? 403 : 401 });
  }
}
