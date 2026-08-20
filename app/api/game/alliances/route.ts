import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/server/auth";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("request"), targetVillageId: z.string().uuid() }),
  z.object({ action: z.literal("respond"), relationshipId: z.string().uuid(), accept: z.boolean() }),
]);

export async function POST(req: NextRequest) {
  const body = Body.parse(await req.json());
  const { supabase } = await requireUser();
  if (body.action === "request") {
    const { data, error } = await supabase.rpc("request_alliance", { p_target_village_id: body.targetVillageId });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ relationshipId: data, status: "pending" });
  }
  const { data, error } = await supabase.rpc("respond_alliance", { p_relationship_id: body.relationshipId, p_accept: body.accept });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ status: data });
}
