import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({ ok: true, service: "go-primal-production-alpha", now: new Date().toISOString() });
}
