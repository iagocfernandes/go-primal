import { requireUser } from "@/lib/server/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function requireAdmin() {
  const { user } = await requireUser();
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("FORBIDDEN");
  return { user, admin };
}
