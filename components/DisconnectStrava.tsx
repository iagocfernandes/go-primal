"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export default function DisconnectStrava(){const [busy,setBusy]=useState(false);const [msg,setMsg]=useState('');const router=useRouter();async function disconnect(){setBusy(true);const r=await fetch('/api/integrations/strava/disconnect',{method:'POST'});const d=await r.json();setBusy(false);setMsg(r.ok?'Disconnected.':d.error??'Failed');if(r.ok)router.refresh()}return <div><button className="prod-link-button" disabled={busy} onClick={disconnect}>{busy?'DISCONNECTING…':'DISCONNECT STRAVA'}</button>{msg&&<small className="prod-inline-message">{msg}</small>}</div>}
