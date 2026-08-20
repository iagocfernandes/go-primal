export type RewardEligibility = {
  eligible: boolean;
  reason: string;
};

// A user who connects shortly after finishing a workout should not lose that
// activity. The grace window is deliberately small enough to avoid retroactive
// farming while still making first connection feel natural.
export const CONNECTED_ACTIVITY_GRACE_MS = 24 * 60 * 60 * 1000;
const FUTURE_CLOCK_SKEW_MS = 15 * 60 * 1000;

export function connectedActivityRewardEligibility(input: {
  startedAt: string;
  connectedAt?: string | null;
  mode?: "auto" | "history_only";
  nowMs?: number;
}): RewardEligibility {
  if (input.mode === "history_only") {
    return { eligible: false, reason: "historical_backfill" };
  }

  const startedMs = new Date(input.startedAt).getTime();
  const connectedMs = input.connectedAt ? new Date(input.connectedAt).getTime() : NaN;
  const nowMs = input.nowMs ?? Date.now();

  if (!Number.isFinite(startedMs)) return { eligible: false, reason: "invalid_start_time" };
  if (!Number.isFinite(connectedMs)) return { eligible: false, reason: "missing_connection_time" };
  if (startedMs > nowMs + FUTURE_CLOCK_SKEW_MS) return { eligible: false, reason: "future_activity" };
  if (startedMs < connectedMs - CONNECTED_ACTIVITY_GRACE_MS) {
    return { eligible: false, reason: "pre_connection_history" };
  }
  if (startedMs < connectedMs) return { eligible: true, reason: "connection_grace_24h" };
  return { eligible: true, reason: "post_connection_activity" };
}
