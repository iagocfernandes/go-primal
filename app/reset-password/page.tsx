"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { initializePasswordRecovery } from "@/lib/supabase/recovery";

export default function ResetPasswordPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(false), []);
  const initialization = useRef<ReturnType<typeof initializePasswordRecovery> | null>(null);
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("Validating recovery link...");
  const [busy, setBusy] = useState(false);
  const [updated, setUpdated] = useState(false);

  useEffect(() => {
    let active = true;

    if (!initialization.current) {
      const url = new URL(window.location.href);
      // Remove credentials and error details from history before exchanging the callback.
      window.history.replaceState({}, "", "/reset-password");
      initialization.current = initializePasswordRecovery(supabase.auth, url);
    }
    void initialization.current.then((result) => {
      if (active) {
        setReady(result.ready);
        setMessage(result.message);
      }
    }).catch(() => {
      if (active) setMessage("Recovery link could not be validated. Request a new link and try again.");
    });
    return () => {
      active = false;
    };
  }, [supabase]);

  async function updatePassword(e: FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    if (password.length < 8) {
      setMessage("Use at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("The passwords do not match.");
      return;
    }

    setBusy(true);
    setMessage("Updating password...");
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setPassword("");
    setConfirmPassword("");
    setReady(false);
    setUpdated(true);
    setMessage("Password updated. Return to Go Primal and sign in with your new password.");
  }

  return (
    <main style={{ maxWidth: 480, margin: "10vh auto", padding: 28, fontFamily: "Arial,sans-serif" }}>
      <div style={{ fontSize: 42, fontWeight: 900, lineHeight: 0.82, marginBottom: 44 }}>GO<br />PRIMAL</div>
      <p style={{ fontWeight: 800, fontSize: 24 }}>Choose a new password.</p>
      <p style={{ color: "#666", lineHeight: 1.45 }}>{message}</p>

      {updated ? (
        <a href="/login" style={{ display: "inline-block", marginTop: 24, color: "#111" }}>SIGN IN ON THE WEB</a>
      ) : ready ? (
        <form onSubmit={updatePassword} style={{ display: "grid", gap: 12, marginTop: 28 }}>
          <input
            required
            minLength={8}
            type="password"
            autoComplete="new-password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ padding: 14, border: "1px solid #bbb", fontSize: 16 }}
          />
          <input
            required
            minLength={8}
            type="password"
            autoComplete="new-password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            style={{ padding: 14, border: "1px solid #bbb", fontSize: 16 }}
          />
          <button disabled={busy} type="submit" style={{ padding: 14, border: 0, background: "#111", color: "white", fontWeight: 800, cursor: "pointer" }}>SET NEW PASSWORD</button>
        </form>
      ) : (
        <button onClick={() => router.push("/login")} style={{ marginTop: 24, padding: 14, border: "1px solid #111", background: "white", fontWeight: 800, cursor: "pointer" }}>BACK TO SIGN IN</button>
      )}
    </main>
  );
}
