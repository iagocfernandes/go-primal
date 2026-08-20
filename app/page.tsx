import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ProductionNav from "@/components/ProductionNav";
import UpgradeButton from "@/components/UpgradeButton";

const BUILDING_LABELS: Record<string,string> = { hall:"Great Hall", forge:"Forge", barracks:"Barracks", lab:"Research Lab" };
const STAGES=["Outpost","Encampment","Strong Village","Fortress","Primal Citadel"];
function stageFromHall(level:number){return level>=9?5:level>=6?4:level>=4?3:level>=2?2:1}
function balance(rows:any[]|null,owner:string,resource:string){return Number(rows?.find(r=>r.owner_type===owner&&r.resource===resource)?.balance??0)}

export default async function ProductionHome(){
  const supabase=await createSupabaseServerClient();
  const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
  const [{data:profile},{data:gorilla},{data:village},{data:balances},{data:integration},{data:activities}]=await Promise.all([
    supabase.from('profiles').select('*').eq('id',user.id).maybeSingle(),
    supabase.from('gorillas').select('*').eq('user_id',user.id).maybeSingle(),
    supabase.from('villages').select('*').eq('user_id',user.id).maybeSingle(),
    supabase.from('resource_balances').select('*'),
    supabase.from('integrations').select('provider,status,last_sync_at').eq('provider','strava').maybeSingle(),
    supabase.from('activities').select('id,category,sport_type,started_at,elapsed_seconds,distance_meters,verification_level,reward_status').order('started_at',{ascending:false}).limit(5),
  ]);
  if(!profile||!gorilla||!village)redirect('/onboarding');
  const {data:buildings}=await supabase.from('village_buildings').select('building_key,level').eq('village_id',village.id).order('building_key');
  const hall=Number(buildings?.find(b=>b.building_key==='hall')?.level??1);const stage=stageFromHall(hall);
  const energy=balance(balances??[],'profile','energy'),knowledge=balance(balances??[],'profile','knowledge'),exploration=balance(balances??[],'profile','exploration'),xp=balance(balances??[],'profile','xp'),gold=balance(balances??[],'village','gold');

  return <><ProductionNav/><main className="prod-shell">
    <section className="prod-hero-head"><div><p className="prod-kicker">{STAGES[stage-1].toUpperCase()} · {village.name}</p><h1>{village.name}</h1><p>Your real life builds this world.</p></div><div className="prod-resources"><span>⚡ {energy}</span><span>● {gold}</span><span>▧ {knowledge}</span><span>⌁ {exploration}</span><span>XP {xp}</span></div></section>
    <section className="prod-world"><img src={`/assets/village-stage-${stage}.jpg`} alt={`${STAGES[stage-1]} village`}/><div className="prod-world-overlay"><div><span>STAGE {stage}</span><strong>{STAGES[stage-1]}</strong></div><Link className="prod-primary" href="/activity">DO SOMETHING REAL</Link></div></section>
    <section className="prod-grid-2">
      <div className="prod-section"><p className="prod-kicker">PERSISTENT PROGRESSION</p><h2>Build bigger, not shinier.</h2><div className="prod-building-list">{(buildings??[]).map((b:any)=><article key={b.building_key}><img src={`/assets/building-${b.building_key}-${Math.min(5,Math.max(1,b.level))}.jpg`} alt={BUILDING_LABELS[b.building_key]}/><div><strong>{BUILDING_LABELS[b.building_key]}</strong><span>Level {b.level}</span><UpgradeButton building={b.building_key}/></div></article>)}</div></div>
      <div className="prod-section"><p className="prod-kicker">PROOF ENGINE</p><h2>Your effort has provenance.</h2><div className="prod-integration"><div><strong>Strava</strong><span>{integration?.status==='active'?'Connected':'Not connected'}</span></div><Link className={integration?.status==='active'?"prod-secondary":"prod-primary"} href="/activity">{integration?.status==='active'?'VIEW ACTIVITY FEED':'CONNECT STRAVA'}</Link></div><div className="prod-activity-list">{activities?.length?activities.map((a:any)=><div key={a.id}><span><b>{a.sport_type??a.category}</b><small>{new Date(a.started_at).toLocaleDateString()}</small></span><em className={`verify ${a.verification_level}`}>{a.verification_level}</em></div>):<p>No imported activity yet. That is the next thing to change.</p>}</div></div>
    </section>
    <section className="prod-gorilla-strip"><img src={`/assets/gorilla-stage-${xp>=2000?5:xp>=1200?4:xp>=650?3:xp>=250?2:1}.png`} alt={gorilla.name}/><div><p className="prod-kicker">YOUR GORILLA</p><h2>{gorilla.name}</h2><p>Physical progression is persistent. Cosmetics express identity; effort changes age, scale and presence.</p></div></section>
  </main></>;
}
