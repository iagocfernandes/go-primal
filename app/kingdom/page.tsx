import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ProductionNav from "@/components/ProductionNav";
import AllianceResponse from "@/components/AllianceResponse";

export default async function KingdomPage(){
 const supabase=await createSupabaseServerClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
 const {data:own}=await supabase.from('villages').select('*').eq('user_id',user.id).maybeSingle();if(!own)redirect('/onboarding');
 const [{data:kingdom},{data:villages},{data:rels}]=await Promise.all([
  own.kingdom_id?supabase.from('kingdoms').select('*').eq('id',own.kingdom_id).maybeSingle():Promise.resolve({data:null} as any),
  supabase.from('villages').select('id,user_id,kingdom_id,name,reputation,created_at').neq('id',own.id).order('created_at'),
  supabase.from('village_relationships').select('*').or(`requester_village_id.eq.${own.id},responder_village_id.eq.${own.id}`).order('requested_at',{ascending:false}),
 ]);
 const users=(villages??[]).map(v=>v.user_id);const {data:gorillas}=users.length?await supabase.from('gorillas').select('user_id,name,xp,fur_key,hair_key').in('user_id',users):{data:[] as any[]};
 const relFor=(id:string)=>(rels??[]).find((r:any)=>(r.requester_village_id===own.id&&r.responder_village_id===id)||(r.responder_village_id===own.id&&r.requester_village_id===id));
 const incoming=(rels??[]).filter((r:any)=>r.status==='pending'&&r.responder_village_id===own.id);
 const villageName=(id:string)=>(villages??[]).find(v=>v.id===id)?.name??'Another village';
 return <><ProductionNav/><main className="prod-shell"><section className="prod-hero-head"><div><p className="prod-kicker">YOUR KINGDOM</p><h1>{kingdom?.name??'No Kingdom'}</h1><p>A faction. Not automatic friendship.</p></div><div className="prod-resources"><span>{(villages??[]).filter(v=>v.kingdom_id===own.kingdom_id).length+1} VILLAGES</span><span>REP {own.reputation}</span></div></section>
 {incoming.length>0&&<section className="prod-section"><p className="prod-kicker">PENDING DIPLOMACY</p><h2>Your consent matters.</h2>{incoming.map((r:any)=><AllianceResponse key={r.id} relationshipId={r.id} requesterName={villageName(r.requester_village_id)}/>)}</section>}
 <section className="prod-section"><p className="prod-kicker">SOVEREIGN VILLAGES</p><h2>Potential allies. Potential targets.</h2><div className="prod-village-grid">{(villages??[]).map((v:any)=>{const g=(gorillas??[]).find((x:any)=>x.user_id===v.user_id);const rel=relFor(v.id);const same=v.kingdom_id===own.kingdom_id;const stage=Math.min(5,Math.max(1,Math.floor(Number(g?.xp??0)/500)+1));return <Link href={`/village/${v.id}`} className="prod-village-card" key={v.id}><img src={`/assets/rival-village-${Math.min(5,((v.name.length+stage)%5)+1)}.jpg`} alt={v.name}/><div><span className={same?'prod-same':'prod-enemy'}>{same?'SAME KINGDOM':'OTHER KINGDOM'}</span><strong>{v.name}</strong><p>{g?.name??'Unknown Gorilla'} · REP {v.reputation}</p><em>{rel?.status??'neutral'}</em></div></Link>})}</div></section>
 </main></>;
}
