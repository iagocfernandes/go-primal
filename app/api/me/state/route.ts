import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth";

export async function GET() {
  const { user, supabase } = await requireUser();
  const [{ data: profile }, { data: gorilla }, { data: village }, { data: balances }, { data: activities }, { data: integrations }, { data: notifications }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("gorillas").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("villages").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("resource_balances").select("owner_type,owner_id,resource,balance"),
    supabase.from("activities").select("id,title,category,sport_type,started_at,elapsed_seconds,distance_meters,verification_level,reward_status").order("started_at", { ascending: false }).limit(10),
    supabase.from("integrations").select("provider,status,provider_user_id,last_sync_at,connected_at"),
    supabase.from("notifications").select("id,type,title,body,payload,read_at,created_at").order("created_at", { ascending: false }).limit(20),
  ]);

  let buildings: unknown[] = [];
  if (village?.id) {
    const { data } = await supabase.from("village_buildings").select("building_key,level,updated_at").eq("village_id", village.id);
    buildings = data ?? [];
  }

  return NextResponse.json({ user: { id: user.id, email: user.email }, profile, gorilla, village, buildings, balances, activities, integrations, notifications });
}
