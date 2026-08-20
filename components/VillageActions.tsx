"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function VillageActions({ targetVillageId, allianceStatus }: { targetVillageId:string; allianceStatus:"none"|"pending"|"active" }){
  const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);const router=useRouter();
  async function alliance(){setBusy(true);const r=await fetch('/api/game/alliances',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'request',targetVillageId})});const d=await r.json();setBusy(false);setMessage(r.ok?'Alliance request sent.':d.error??'Failed');router.refresh();}
  async function raid(){setBusy(true);const key=`raid-ui:${crypto.randomUUID()}`;const r=await fetch('/api/game/raids',{method:'POST',headers:{'content-type':'application/json','idempotency-key':key},body:JSON.stringify({targetVillageId,idempotencyKey:key})});const d=await r.json();setBusy(false);setMessage(r.ok?`Raid resolved: ${d.raidId}`:d.error??'Raid failed');router.refresh();}
  return <div className="prod-actions">
    <button className="prod-danger" onClick={raid} disabled={busy||allianceStatus==='active'}>RAID</button>
    <button className="prod-primary" onClick={alliance} disabled={busy||allianceStatus!=='none'}>{allianceStatus==='active'?'ALLY':allianceStatus==='pending'?'PENDING':'PROPOSE ALLIANCE'}</button>
    {message&&<p className="prod-message">{message}</p>}
  </div>
}
