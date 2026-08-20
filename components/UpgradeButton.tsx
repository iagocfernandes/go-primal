"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UpgradeButton({ building }: { building: "hall"|"forge"|"barracks"|"lab" }) {
  const [message,setMessage]=useState(""); const [busy,setBusy]=useState(false); const router=useRouter();
  async function upgrade(){
    setBusy(true);setMessage("");
    const idempotencyKey=`upgrade-ui:${crypto.randomUUID()}`;
    const res=await fetch("/api/game/buildings/upgrade",{method:"POST",headers:{"content-type":"application/json","idempotency-key":idempotencyKey},body:JSON.stringify({building,idempotencyKey})});
    const data=await res.json(); setBusy(false);
    if(!res.ok){setMessage(data.error??"Upgrade failed");return;}
    setMessage(`Level ${data.level}`);router.refresh();
  }
  return <div><button className="prod-small-action" disabled={busy} onClick={upgrade}>{busy?"UPGRADING…":"UPGRADE"}</button>{message&&<span className="prod-inline-message">{message}</span>}</div>
}
