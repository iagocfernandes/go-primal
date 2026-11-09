import assert from "node:assert/strict";
import test from "node:test";
import { initializePasswordRecovery, recoveryRedirect } from "../lib/supabase/recovery.ts";

const origin = "https://go-primal.vercel.app";
const url = (path) => new URL(path, origin);

function fakeAuth(failingMethod) {
  const calls = [];
  const auth = Object.fromEntries(["verifyOtp", "exchangeCodeForSession", "setSession", "getUser"].map((method) => [method, async (argument) => {
    calls.push([method, argument]);
    return { error: method === failingMethod ? { message: "expired" } : null, data: { user: { id: "test-user", email: "verified-account@example.test" } } };
  }]));
  return { auth, calls };
}

test("default Site URL/login forwards native recovery fragment unchanged to the fixed reset route", () => {
  const fragment = "#access_token=synthetic-access&refresh_token=synthetic-refresh&type=recovery";
  assert.equal(recoveryRedirect(url(`/login${fragment}`)), `${origin}/reset-password${fragment}`);
  assert.equal(recoveryRedirect(url(`/${fragment}`)), `${origin}/reset-password${fragment}`);
});

test("PKCE, token hash and expired callbacks reach reset; normal login/signup stay on login", () => {
  for (const query of ["?code=synthetic-code", "?token_hash=synthetic-hash&type=recovery", "#error=access_denied&error_code=otp_expired"]) {
    assert.equal(recoveryRedirect(url(`/login${query}`)), `${origin}/reset-password${query}`);
  }
  for (const query of ["", "?confirmed=1&code=signup-code", "#access_token=signup-token&type=signup", "?next=https://example.org"]) {
    assert.equal(recoveryRedirect(url(`/login${query}`)), null);
  }
  assert.equal(new URL(recoveryRedirect(url("/login?code=test&next=https://example.org"))).pathname, "/reset-password");
});

test("global handler catches authenticated home callbacks without looping on the reset page", () => {
  const callback = "#type=recovery&error=access_denied&error_code=otp_expired";
  assert.equal(recoveryRedirect(url(`/${callback}`)), `${origin}/reset-password${callback}`);
  assert.equal(recoveryRedirect(url(`/kingdom${callback}`)), `${origin}/reset-password${callback}`);
  assert.equal(recoveryRedirect(url(`/reset-password${callback}`)), null);
  assert.equal(recoveryRedirect(url("/reset-password?code=synthetic-code")), null);
});

test("reset identifies the account from Auth's verified user, never callback input", async () => {
  const { auth } = fakeAuth();
  const result = await initializePasswordRecovery(auth, url("/reset-password?code=synthetic-code&email=untrusted@example.test"));
  assert.equal(result.ready, true);
  assert.equal(result.email, "verified-account@example.test");
  const failed = fakeAuth("exchangeCodeForSession");
  const invalid = await initializePasswordRecovery(failed.auth, url("/reset-password?code=expired&email=untrusted@example.test"));
  assert.equal(invalid.ready, false);
  assert.equal(invalid.email, undefined);
});

test("implicit recovery establishes cookie-backed session and validates user before enabling form", async () => {
  const { auth, calls } = fakeAuth();
  const result = await initializePasswordRecovery(auth, url("/reset-password#access_token=synthetic-access&refresh_token=synthetic-refresh&type=recovery"));
  assert.equal(result.ready, true);
  assert.deepEqual(calls, [["setSession", { access_token: "synthetic-access", refresh_token: "synthetic-refresh" }], ["getUser", undefined]]);
});

test("PKCE and token hash callbacks exchange once before validating the session", async () => {
  for (const [query, method, argument] of [
    ["?code=synthetic-code", "exchangeCodeForSession", "synthetic-code"],
    ["?token_hash=synthetic-hash&type=recovery", "verifyOtp", { token_hash: "synthetic-hash", type: "recovery" }],
  ]) {
    const { auth, calls } = fakeAuth();
    assert.equal((await initializePasswordRecovery(auth, url(`/reset-password${query}`))).ready, true);
    assert.deepEqual(calls, [[method, argument], ["getUser", undefined]]);
  }
});

test("failed callback cannot fall back to an unrelated existing signed-in session", async () => {
  for (const [query, method] of [
    ["?code=expired", "exchangeCodeForSession"],
    ["?token_hash=expired&type=recovery", "verifyOtp"],
    ["#access_token=expired&refresh_token=expired&type=recovery", "setSession"],
  ]) {
    const { auth, calls } = fakeAuth(method);
    assert.equal((await initializePasswordRecovery(auth, url(`/reset-password${query}`))).ready, false);
    assert.equal(calls.length, 1);
  }
});

test("malformed, signup and expired recovery callbacks never enable the password form", async () => {
  for (const query of ["#type=recovery&access_token=missing-refresh", "?token_hash=wrong-type&type=signup", "?type=recovery", "?code=", "?token_hash=&type=recovery", "#error=access_denied&error_description=private", "#type=signup&access_token=signup&refresh_token=signup"]) {
    const { auth, calls } = fakeAuth();
    const result = await initializePasswordRecovery(auth, url(`/reset-password${query}`));
    assert.equal(result.ready, false);
    assert.equal(result.message.includes("private"), false);
    assert.deepEqual(calls, []);
  }
  const { auth } = fakeAuth("getUser");
  assert.equal((await initializePasswordRecovery(auth, url("/reset-password"))).ready, false);
});
