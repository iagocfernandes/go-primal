import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ProductionNav from "@/components/ProductionNav";
import VillageActions from "@/components/VillageActions";

export default async function VillagePage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const supabase=await createSupabaseServerClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
 const [{data:own},{data:target}]=await Promise.all([supabase.from('villages').select('*').eq('user_id',user.id).maybeSingle(),supabase.from('villages').select('*').eq('id',id).maybeSingle()]);if(!own)redirect('/onboarding');if(!target)notFound();if(target.id===own.id)redirect('/');
 const [{data:g},{data:buildings},{data:rel}]=await Promise.all([
  supabase.from('gorillas').select('name,xp,fur_key,hair_key').eq('user_id',target.user_id).maybeSingle(),
  supabase.from('village_buildings').select('building_key,level').eq('village_id',target.id),
  supabase.from('village_relationships').select('*').or(`and(requester_village_id.eq.${own.id},responder_village_id.eq.${target.id}),and(requester_village_id.eq.${target.id},responder_village_id.eq.${own.id})`).in('status',['pending','active']).maybeSingle(),
 ]);
 const hall=Number(buildings?.find(b=>b.building_key==='hall')?.level??1);const stage=hall>=9?5:hall>=6?4:hall>=4?3:hall>=2?2:1;const allianceStatus=rel?.status==='active'?'active':rel?.status==='pending'?'pending':'none';
 return <><ProductionNav/><main className="prod-shell"><section className="prod-target"><img src={`/assets/rival-village-${Math.min(5,((target.name.length+stage)%5)+1)}.jpg`} alt={target.name}/><div className="prod-target-copy"><p className="prod-kicker">{target.kingdom_id===own.kingdom_id?'SAME KINGDOM':'FOREIGN KINGDOM'}</p><h1>{target.name}</h1><p>{g?.name??'Unknown Gorilla'} · Reputation {target.reputation}</p></div></section><section className="prod-grid-2"><div className="prod-section"><p className="prod-kicker">SCOUT REPORT</p><h2>Read the target before acting.</h2><div className="prod-stat-row">{(buildings??[]).map(b=><span key={b.building_key}><b>{b.building_key.toUpperCase()}</b>LV {b.level}</span>)}</div><p className="prod-lead">Raids are resolved on the server. The browser never decides probability, loot or result.</p></div><div className="prod-section"><p className="prod-kicker">DIPLOMACY OR CONFLICT</p><h2>Your choice creates history.</h2><VillageActions targetVillageId={target.id} allianceStatus={allianceStatus}/>{target.kingdom_id===own.kingdom_id&&<p className="prod-warning">Internal raids remain legal, but carry reputation and loot penalties.</p>}</div></section></main></>;
}
