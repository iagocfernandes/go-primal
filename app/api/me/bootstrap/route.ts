import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/server/auth";

const Body = z.object({
  displayName: z.string().trim().min(1).max(50),
  gorillaName: z.string().trim().min(1).max(40),
  villageName: z.string().trim().min(1).max(50),
  kingdomId: z.string().uuid().nullable().optional(),
});

export async function POST(req: NextRequest) {
  const body = Body.parse(await req.json());
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("bootstrap_player", {
    p_display_name: body.displayName,
    p_gorilla_name: body.gorillaName,
    p_village_name: body.villageName,
    p_kingdom_id: body.kingdomId ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ villageId: data });
}
