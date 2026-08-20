"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type SyncResponse = {
  fetched?: number;
  fallbackUsed?: boolean;
  imported?: number;
  skippedExisting?: number;
  errors?: Array<{ objectId: string; error: string }>;
  error?: string;
};

export default function SyncStrava() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function sync() {
    setBusy(true);
    setMessage("Checking Strava...");
    try {
      const res = await fetch("/api/integrations/strava/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ days: 7, limit: 20 }),
      });
      const data = (await res.json()) as SyncResponse;
      if (!res.ok) throw new Error(data.error ?? "STRAVA_SYNC_FAILED");
      const fetched = data.fetched ?? 0;
      const imported = data.imported ?? 0;
      const skipped = data.skippedExisting ?? 0;
      const failed = data.errors?.length ?? 0;
      const source = data.fallbackUsed ? "latest activities" : "recent window";
      setMessage(imported
        ? `Found ${fetched} · ${imported} new activit${imported === 1 ? "y" : "ies"} imported${failed ? ` · ${failed} failed` : ""}.`
        : fetched
          ? `Found ${fetched} in ${source} · ${skipped} already known${failed ? ` · ${failed} failed` : ""}.`
          : `Strava returned 0 activities${data.fallbackUsed ? " (including latest-activity fallback)" : ""}.`);
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return <div className="prod-sync-actions">
    <button type="button" className="prod-primary" onClick={sync} disabled={busy}>{busy ? "SYNCING..." : "SYNC STRAVA"}</button>
    {message && <small className="prod-inline-message">{message}</small>}
  </div>;
}
