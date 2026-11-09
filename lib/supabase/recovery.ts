import type { SupabaseClient } from "@supabase/supabase-js";

type RecoveryAuth = Pick<SupabaseClient["auth"], "exchangeCodeForSession" | "verifyOtp" | "setSession" | "getUser">;

const invalidLink = "This recovery link is missing or expired. Go back to Sign in → Forgot password? and request a new one.";

export function recoveryRedirect(url: URL): string | null {
  const fragment = new URLSearchParams(url.hash.slice(1));
  const recovery = url.searchParams.get("type") === "recovery" || fragment.get("type") === "recovery";
  // Existing signup emails use confirmed=1. Bare PKCE callbacks here are recovery links.
  const code = url.searchParams.has("code") && url.searchParams.get("confirmed") !== "1";
  const failed = (url.searchParams.has("error") || fragment.has("error")) && url.searchParams.get("confirmed") !== "1";
  if (!recovery && !code && !failed) return null;

  const target = new URL("/reset-password", url.origin);
  target.search = url.search;
  target.hash = url.hash;
  return target.href;
}

export async function initializePasswordRecovery(auth: RecoveryAuth, url: URL) {
  const fragment = new URLSearchParams(url.hash.slice(1));
  if (url.searchParams.has("error") || fragment.has("error")) {
    return { ready: false, message: invalidLink };
  }

  const tokenHash = url.searchParams.get("token_hash");
  const code = url.searchParams.get("code");
  const accessToken = fragment.get("access_token");
  const refreshToken = fragment.get("refresh_token");

  if (tokenHash) {
    if (url.searchParams.get("type") !== "recovery") return { ready: false, message: invalidLink };
    const { error } = await auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
    if (error) return { ready: false, message: invalidLink };
  } else if (code) {
    const { error } = await auth.exchangeCodeForSession(code);
    if (error) return { ready: false, message: invalidLink };
  } else if (fragment.has("type") || accessToken || refreshToken) {
    if (fragment.get("type") !== "recovery" || !accessToken || !refreshToken) {
      return { ready: false, message: invalidLink };
    }
    const { error } = await auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error) return { ready: false, message: invalidLink };
  } else if (url.searchParams.has("type") || url.searchParams.has("code") || url.searchParams.has("token_hash")) {
    return { ready: false, message: invalidLink };
  }

  // Verify the recovered (or existing cookie) session with Auth before enabling updates.
  const { data, error } = await auth.getUser();
  if (error || !data.user) return { ready: false, message: invalidLink };
  return { ready: true, message: "Recovery link verified. Choose your new password." };
}
