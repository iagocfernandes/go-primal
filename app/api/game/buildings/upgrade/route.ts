import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/server/auth";

const Body = z.object({
  building: z.enum(["hall","forge","barracks","lab"]),
  idempotencyKey: z.string().min(8).max(160).optional(),
});

export async function POST(req: NextRequest) {
  const body = Body.parse(await req.json());
  const { supabase } = await requireUser();
  const headerKey = req.headers.get("idempotency-key") ?? undefined;
  const actionKey = body.idempotencyKey ?? headerKey ?? `upgrade:${crypto.randomUUID()}`;
  const { data, error } = await supabase.rpc("upgrade_own_building", {
    p_building_key: body.building,
    p_idempotency_key: actionKey,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: error.message.includes("INSUFFICIENT") ? 409 : 400 });
  return NextResponse.json({ level: data, idempotencyKey: actionKey });
}
