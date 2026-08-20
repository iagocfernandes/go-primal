"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("Validating recovery link...");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;

    async function initializeRecovery() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!active) return;
        if (error) {
          setMessage(`Recovery link could not be validated: ${error.message}`);
          return;
        }
        window.history.replaceState({}, "", "/reset-password");
        setReady(true);
        setMessage("Recovery link verified. Choose your new password.");
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (data.session) {
        setReady(true);
        setMessage("Recovery link verified. Choose your new password.");
      } else {
        setMessage("This recovery link is missing or expired. Go back to Sign in → Forgot password? and request a new one.");
      }
    }

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setReady(true);
        setMessage("Recovery link verified. Choose your new password.");
      }
    });

    void initializeRecovery();
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  async function updatePassword(e: FormEvent) {
    e.preventDefault();
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

    setMessage("Password updated. Entering GO PRIMAL...");
    router.push("/");
    router.refresh();
  }

  return (
    <main style={{ maxWidth: 480, margin: "10vh auto", padding: 28, fontFamily: "Arial,sans-serif" }}>
      <div style={{ fontSize: 42, fontWeight: 900, lineHeight: 0.82, marginBottom: 44 }}>GO<br />PRIMAL</div>
      <p style={{ fontWeight: 800, fontSize: 24 }}>Choose a new password.</p>
      <p style={{ color: "#666", lineHeight: 1.45 }}>{message}</p>

      {ready ? (
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
