"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Kingdom = { id: string; name: string; visibility: string };

export default function OnboardingForm({ kingdoms }: { kingdoms: Kingdom[] }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [gorillaName, setGorillaName] = useState("");
  const [villageName, setVillageName] = useState("");
  const [kingdomId, setKingdomId] = useState(kingdoms[0]?.id ?? "");
  const [message, setMessage] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault(); setMessage("Building your world...");
    const res = await fetch("/api/me/bootstrap", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ displayName, gorillaName, villageName, kingdomId: kingdomId || null }),
    });
    const data = await res.json();
    if (!res.ok) { setMessage(data.error ?? "Could not create player"); return; }
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    await fetch("/api/me/timezone", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ timezone }) });
    router.push("/"); router.refresh();
  }

  return <form className="prod-form" onSubmit={submit}>
    <label>YOUR NAME<input required maxLength={50} value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Iago" /></label>
    <label>GORILLA NAME<input required maxLength={40} value={gorillaName} onChange={e=>setGorillaName(e.target.value)} placeholder="Your Gorilla" /></label>
    <label>VILLAGE NAME<input required maxLength={50} value={villageName} onChange={e=>setVillageName(e.target.value)} placeholder="Ash Valley" /></label>
    <label>KINGDOM<select value={kingdomId} onChange={e=>setKingdomId(e.target.value)}><option value="">No Kingdom yet</option>{kingdoms.map(k=><option value={k.id} key={k.id}>{k.name}</option>)}</select></label>
    <button className="prod-primary" type="submit">ENTER THE WORLD</button>
    {message && <p className="prod-message">{message}</p>}
  </form>;
}
