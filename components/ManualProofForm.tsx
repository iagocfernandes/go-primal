"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function ManualProofForm(){
 const [category,setCategory]=useState<'train'|'focus'|'move'>('train');const [minutes,setMinutes]=useState(30);const [distance,setDistance]=useState('');const [file,setFile]=useState<File|null>(null);const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);const router=useRouter();
 async function submit(e:FormEvent){e.preventDefault();if(!file){setMessage('Photo proof is required for manual Alpha submission.');return}setBusy(true);setMessage('Uploading proof…');
  const form=new FormData();form.set('file',file);const up=await fetch('/api/activities/proof-upload',{method:'POST',body:form});const ud=await up.json();if(!up.ok){setBusy(false);setMessage(ud.error??'Upload failed');return}
  const ended=Date.now();const started=new Date(ended-minutes*60_000).toISOString();const r=await fetch('/api/activities/manual',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({category,startedAt:started,elapsedSeconds:minutes*60,distanceMeters:distance?Number(distance)*1000:null,proofStoragePath:ud.path})});const d=await r.json();setBusy(false);setMessage(r.ok?'Proof submitted. Reward waits for review.':d.error??'Submission failed');if(r.ok)router.refresh();
 }
 return <form className="prod-manual" onSubmit={submit}><div><label>TYPE<select value={category} onChange={e=>setCategory(e.target.value as any)}><option value="train">Train</option><option value="focus">Focus</option><option value="move">Move</option></select></label><label>MINUTES<input type="number" min="1" max="720" value={minutes} onChange={e=>setMinutes(Number(e.target.value))}/></label><label>DISTANCE KM (OPTIONAL)<input inputMode="decimal" value={distance} onChange={e=>setDistance(e.target.value)}/></label></div><label className="prod-file">PHOTO PROOF<input required type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setFile(e.target.files?.[0]??null)}/></label><button className="prod-secondary" disabled={busy}>{busy?'SUBMITTING…':'SUBMIT MANUAL PROOF'}</button>{message&&<p className="prod-message">{message}</p>}</form>
}
