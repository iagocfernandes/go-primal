import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ProductionNav from "@/components/ProductionNav";
import ManualProofForm from "@/components/ManualProofForm";
import DisconnectStrava from "@/components/DisconnectStrava";
import SyncStrava from "@/components/SyncStrava";

function rewardText(activity: any) {
  if (activity.reward_status === "ineligible" || activity.reward_eligible === false) return "History · no reward";
  const relation = activity.activity_rewards;
  const rewards = Array.isArray(relation) ? relation[0]?.rewards : relation?.rewards;
  if (!rewards) return activity.reward_status === "awarded" ? "Rewarded" : activity.reward_status;
  const labels: string[] = [];
  if (rewards.energy) labels.push(`+${rewards.energy} Energy`);
  if (rewards.knowledge) labels.push(`+${rewards.knowledge} Knowledge`);
  if (rewards.exploration) labels.push(`+${rewards.exploration} Exploration`);
  if (rewards.xp) labels.push(`+${rewards.xp} XP`);
  return labels.join(" · ") || activity.reward_status;
}

function evidenceText(activity: any) {
  const rows = Array.isArray(activity.activity_evidence) ? activity.activity_evidence : [];
  if (!rows.length) return "No evidence details";
  const e = rows[0];
  const parts = [String(e.provider ?? "evidence").toUpperCase()];
  if (e.device_name) parts.push(e.device_name);
  if (e.has_gps) parts.push("GPS");
  if (e.has_heart_rate) parts.push("HR");
  if (e.manual) parts.push("MANUAL");
  return parts.join(" · ");
}

export default async function ActivityPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (!profile) redirect("/onboarding");

  const [{ data: integration }, { data: activities }] = await Promise.all([
    supabase.from("integrations")
      .select("provider,status,scopes,last_sync_at,connected_at,metadata")
      .eq("provider", "strava")
      .maybeSingle(),
    supabase.from("activities")
      .select("id,title,category,sport_type,started_at,moving_seconds,elapsed_seconds,distance_meters,verification_level,reward_status,reward_eligible,reward_eligibility_reason,risk_flags,activity_rewards(rewards),activity_evidence(provider,device_name,manual,has_gps,has_heart_rate)")
      .order("started_at", { ascending: false })
      .limit(20),
  ]);

  return <>
    <ProductionNav />
    <main className="prod-shell prod-narrow">
      <p className="prod-kicker">REAL ACTION → VIRTUAL CONSEQUENCE</p>
      <h1>Activity proof.</h1>
      <p className="prod-lead">Connected data is the default. Manual proof is the fallback.</p>

      <section className="prod-connect-card">
        <div>
          <strong>STRAVA</strong>
          <span>{integration?.status === "active" ? "CONNECTED" : "NOT CONNECTED"}</span>
          <p>{integration?.status === "active"
            ? `Last sync: ${integration.last_sync_at ? new Date(integration.last_sync_at).toLocaleString() : "ready for first sync"}`
            : "Recorded workouts can enter the Proof Engine as private evidence."}</p>
        </div>
        {integration?.status === "active" ? <div className="prod-strava-controls">
          <span className="prod-connected">✓ CONNECTED</span>
          <SyncStrava />
          <DisconnectStrava />
        </div> : <a className="prod-primary" href="/api/integrations/strava/connect">CONNECT STRAVA</a>}
      </section>

      <section className="prod-section">
        <p className="prod-kicker">CANONICAL ACTIVITY FEED</p>
        <h2>One real action. One activity. Multiple evidence sources.</h2>
        {activities?.length ? <div className="prod-feed">{activities.map((a: any) => <article key={a.id}>
          <div>
            <strong>{a.title ?? a.sport_type ?? a.category.toUpperCase()}</strong>
            <span>{new Date(a.started_at).toLocaleString()} · {Math.round((a.moving_seconds ?? a.elapsed_seconds ?? 0) / 60)} min{a.distance_meters ? ` · ${(Number(a.distance_meters) / 1000).toFixed(1)} km` : ""}</span>
            <small className="prod-evidence-line">{evidenceText(a)}</small>
          </div>
          <div>
            <em className={`verify ${a.verification_level}`}>✓ {String(a.verification_level).replace("_", " ")}</em>
            <small className="prod-reward-line">{rewardText(a)}</small>
          </div>
        </article>)}</div> : <div className="prod-empty">
          <strong>No activity yet.</strong>
          <p>Your Strava account is connected. Use <b>SYNC STRAVA</b> to import recent activities into the Proof Engine.</p>
        </div>}
      </section>

      <section className="prod-section">
        <p className="prod-kicker">FALLBACK</p>
        <h2>Manual proof.</h2>
        <p className="prod-lead">Use this only when a connected source cannot prove the action. Manual proof is reviewed before reward.</p>
        <ManualProofForm />
      </section>
      <Link href="/" className="prod-secondary">BACK TO VILLAGE</Link>
    </main>
  </>;
}
