"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup" | "forgot";

const inputStyle = {
  padding: 14,
  border: "1px solid #bbb",
  fontSize: 16,
  width: "100%",
  boxSizing: "border-box" as const,
};

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function login(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("Signing in...");
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    router.push("/");
    router.refresh();
  }

  async function signup(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("Creating your account...");
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/login?confirmed=1`,
      },
    });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    if (data.session) {
      router.push("/onboarding");
      router.refresh();
      return;
    }
    setMessage("Account created. Check your email and confirm the address. Then come back here and sign in with the same password.");
    setMode("signin");
  }

  async function sendRecovery(e: FormEvent) {
    e.preventDefault();
    if (!email) {
      setMessage("Enter your email first.");
      return;
    }
    setBusy(true);
    setMessage("Sending password reset email...");
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Password reset email sent. Use the newest email you receive; its link will open the GO PRIMAL password reset screen.");
  }

  function switchMode(next: Mode) {
    setMode(next);
    setMessage("");
    if (next === "forgot") setPassword("");
  }

  return (
    <main style={{ maxWidth: 480, margin: "10vh auto", padding: 28, fontFamily: "Arial,sans-serif" }}>
      <div style={{ fontSize: 42, fontWeight: 900, lineHeight: 0.82, marginBottom: 44 }}>GO<br />PRIMAL</div>

      {mode === "signin" && (
        <>
          <p style={{ fontWeight: 800, fontSize: 24 }}>Enter the world.</p>
          <p style={{ color: "#666" }}>Sign in to your persistent Gorilla and Village.</p>
          <form onSubmit={login} style={{ display: "grid", gap: 12, marginTop: 28 }}>
            <input required type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
            <input required minLength={8} type="password" autoComplete="current-password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
            <button disabled={busy} type="submit" style={{ padding: 14, border: 0, background: "#111", color: "white", fontWeight: 800, cursor: "pointer" }}>SIGN IN</button>
            <button disabled={busy} type="button" onClick={() => switchMode("signup")} style={{ padding: 14, border: "1px solid #111", background: "white", fontWeight: 800, cursor: "pointer" }}>CREATE ACCOUNT</button>
            <button type="button" onClick={() => switchMode("forgot")} style={{ padding: 8, border: 0, background: "transparent", textDecoration: "underline", cursor: "pointer" }}>Forgot password?</button>
          </form>
        </>
      )}

      {mode === "signup" && (
        <>
          <p style={{ fontWeight: 800, fontSize: 24 }}>Create your account.</p>
          <p style={{ color: "#666" }}>Choose the email and password you will use to enter GO PRIMAL.</p>
          <form onSubmit={signup} style={{ display: "grid", gap: 12, marginTop: 28 }}>
            <input required type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
            <input required minLength={8} type="password" autoComplete="new-password" placeholder="Create a password (8+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
            <button disabled={busy} type="submit" style={{ padding: 14, border: 0, background: "#111", color: "white", fontWeight: 800, cursor: "pointer" }}>CREATE ACCOUNT</button>
            <button type="button" onClick={() => switchMode("signin")} style={{ padding: 14, border: "1px solid #111", background: "white", fontWeight: 800, cursor: "pointer" }}>BACK TO SIGN IN</button>
          </form>
        </>
      )}

      {mode === "forgot" && (
        <>
          <p style={{ fontWeight: 800, fontSize: 24 }}>Reset your password.</p>
          <p style={{ color: "#666" }}>We will email you a secure recovery link.</p>
          <form onSubmit={sendRecovery} style={{ display: "grid", gap: 12, marginTop: 28 }}>
            <input required type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
            <button disabled={busy} type="submit" style={{ padding: 14, border: 0, background: "#111", color: "white", fontWeight: 800, cursor: "pointer" }}>SEND RESET LINK</button>
            <button type="button" onClick={() => switchMode("signin")} style={{ padding: 14, border: "1px solid #111", background: "white", fontWeight: 800, cursor: "pointer" }}>BACK TO SIGN IN</button>
          </form>
        </>
      )}

      {message && <p style={{ marginTop: 18, lineHeight: 1.45 }}>{message}</p>}
    </main>
  );
}
