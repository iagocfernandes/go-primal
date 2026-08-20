import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const ALLOWED = new Map([["image/jpeg","jpg"],["image/png","png"],["image/webp","webp"]]);
const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireUser();
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "FILE_REQUIRED" }, { status: 400 });
    const ext = ALLOWED.get(file.type);
    if (!ext) return NextResponse.json({ error: "UNSUPPORTED_IMAGE_TYPE" }, { status: 415 });
    if (file.size <= 0 || file.size > MAX_BYTES) return NextResponse.json({ error: "FILE_TOO_LARGE" }, { status: 413 });

    const path = `${user.id}/${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}.${ext}`;
    const admin = createSupabaseAdminClient();
    const { error } = await admin.storage.from("activity-proofs").upload(path, await file.arrayBuffer(), {
      contentType: file.type, upsert: false, cacheControl: "3600",
    });
    if (error) throw error;
    return NextResponse.json({ path });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
