import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth";

export async function GET() {
  const { user, supabase } = await requireUser();
  const { data, error } = await supabase.from("activities")
    .select("id,title,category,sport_type,started_at,ended_at,elapsed_seconds,moving_seconds,distance_meters,verification_level,verification_score,risk_flags,reward_status,activity_rewards(rewards,policy_version,awarded_at)")
    .eq("user_id", user.id)
    .is("merged_into_activity_id", null)
    .order("started_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ activities: data ?? [] });
}
