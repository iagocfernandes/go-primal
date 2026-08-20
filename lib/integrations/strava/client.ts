import type { StravaActivity, StravaActivityListOptions, StravaTokenResponse } from "./types";

// During Strava's 2026 API hostname transition, environments may temporarily
// resolve one hostname and not the other. Prefer the still-documented legacy
// base first, then fall back to the new dedicated hostname for network/edge
// failures. OAuth remains on www.strava.com.
const API_BASES = Array.from(new Set([
  process.env.STRAVA_API_BASE_URL?.replace(/\/$/, ""),
  "https://www.strava.com/api/v3",
  "https://api-v3.strava.com",
].filter((value): value is string => Boolean(value))));

function errorMessage(error: unknown) {
  if (!(error instanceof Error)) return String(error);
  const cause = (error as Error & { cause?: unknown }).cause;
  if (cause instanceof Error) return `${error.message} (${cause.message})`;
  if (cause && typeof cause === "object" && "code" in cause) {
    return `${error.message} (${String((cause as { code?: unknown }).code)})`;
  }
  return error.message;
}

async function stravaApiFetch(
  path: string,
  accessToken: string,
  searchParams?: URLSearchParams,
): Promise<Response> {
  const attempts: string[] = [];
  let lastNetworkError: unknown = null;

  for (const base of API_BASES) {
    const url = new URL(`${base}${path}`);
    if (searchParams) url.search = searchParams.toString();

    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });

      if (res.ok) return res;

      // Authentication, permission and rate-limit failures are authoritative;
      // trying another hostname would only hide the real problem.
      if ([400, 401, 403, 429].includes(res.status)) return res;

      attempts.push(`${base}:${res.status}`);
      // During the hostname transition, retry the alternate base for endpoint
      // or upstream failures.
      if (res.status === 404 || res.status >= 500) continue;
      return res;
    } catch (error) {
      lastNetworkError = error;
      attempts.push(`${base}:network`);
    }
  }

  throw new Error(
    `STRAVA_API_NETWORK_FAILED:${attempts.join(",") || "no-attempt"}:${errorMessage(lastNetworkError)}`,
  );
}

export function stravaAuthorizeUrl(state: string) {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!clientId || !appUrl) throw new Error("Missing Strava configuration");
  const url = new URL("https://www.strava.com/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", `${appUrl}/api/integrations/strava/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("approval_prompt", "auto");
  url.searchParams.set("scope", "read,activity:read_all");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeStravaCode(code: string): Promise<StravaTokenResponse> {
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.STRAVA_CLIENT_ID!,
      client_secret: process.env.STRAVA_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`STRAVA_TOKEN_EXCHANGE_FAILED:${res.status}`);
  return res.json();
}

export async function refreshStravaToken(refreshToken: string): Promise<StravaTokenResponse> {
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.STRAVA_CLIENT_ID!,
      client_secret: process.env.STRAVA_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`STRAVA_TOKEN_REFRESH_FAILED:${res.status}`);
  return res.json();
}

export async function listStravaActivities(
  accessToken: string,
  options: StravaActivityListOptions = {},
): Promise<StravaActivity[]> {
  const params = new URLSearchParams();
  if (options.after != null) params.set("after", String(options.after));
  if (options.before != null) params.set("before", String(options.before));
  params.set("page", String(options.page ?? 1));
  params.set("per_page", String(Math.max(1, Math.min(30, options.perPage ?? 20))));

  const res = await stravaApiFetch("/athlete/activities", accessToken, params);
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`STRAVA_ACTIVITY_LIST_FAILED:${res.status}${detail ? `:${detail.slice(0, 220)}` : ""}`);
  }
  return res.json();
}

export async function getStravaActivity(
  accessToken: string,
  activityId: string | number,
): Promise<StravaActivity> {
  const res = await stravaApiFetch(`/activities/${activityId}`, accessToken);
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`STRAVA_ACTIVITY_FAILED:${res.status}${detail ? `:${detail.slice(0, 220)}` : ""}`);
  }
  return res.json();
}

export async function revokeStravaToken(
  token: string,
  tokenTypeHint: "access_token" | "refresh_token" = "refresh_token",
) {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Missing Strava configuration");
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch("https://www.strava.com/oauth/revoke", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token, token_type_hint: tokenTypeHint }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`STRAVA_REVOKE_FAILED:${res.status}`);
}
