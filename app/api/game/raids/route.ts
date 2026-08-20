import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/server/auth";

const Body = z.object({
  targetVillageId: z.string().uuid(),
  idempotencyKey: z.string().min(8).max(160).optional(),
});

export async function POST(req: NextRequest) {
  const body = Body.parse(await req.json());
  const { supabase } = await requireUser();
  const headerKey = req.headers.get("idempotency-key") ?? undefined;
  const actionKey = body.idempotencyKey ?? headerKey ?? `raid:${crypto.randomUUID()}`;
  const { data, error } = await supabase.rpc("resolve_solo_raid_idempotent", {
    p_target_village_id: body.targetVillageId,
    p_idempotency_key: actionKey,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: error.message.includes("INSUFFICIENT") ? 409 : 400 });
  return NextResponse.json({ raidId: data, idempotencyKey: actionKey });
}
