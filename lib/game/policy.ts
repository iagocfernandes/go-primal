export type RewardPolicyInput = {
  category: "train" | "focus" | "move";
  verifiedLevel: "verified" | "connected" | "proof_submitted" | "unverified";
  elapsedSeconds?: number | null;
  distanceMeters?: number | null;
  steps?: number | null;
  validActivitiesToday: number;
};

export type RewardBundle = { energy: number; knowledge: number; exploration: number; xp: number };

// Production Alpha V1: deliberately tiered and capped, never linear without limit.
// These numbers are experiments. The authority boundary (server-only) is not.
export function rewardActivity(input: RewardPolicyInput): RewardBundle {
  if (input.verifiedLevel === "unverified") return { energy: 0, knowledge: 0, exploration: 0, xp: 10 };

  if (input.category === "train") {
    const minutes = Math.max(0, (input.elapsedSeconds ?? 0) / 60);
    const base = minutes >= 75 ? 120 : minutes >= 45 ? 110 : minutes >= 20 ? 100 : 0;
    const diminishing = input.validActivitiesToday === 0 ? 1 : input.validActivitiesToday === 1 ? 0.25 : 0;
    return { energy: Math.round(base * diminishing), knowledge: 0, exploration: 0, xp: minutes >= 20 ? 40 : 10 };
  }

  if (input.category === "focus") {
    const minutes = Math.max(0, (input.elapsedSeconds ?? 0) / 60);
    const knowledge = minutes >= 90 ? 110 : minutes >= 50 ? 80 : minutes >= 25 ? 45 : 0;
    return { energy: 0, knowledge, exploration: 0, xp: knowledge ? 40 : 10 };
  }

  // Native steps are the preferred MOVE input. Connected walking/hiking providers
  // may only give us distance, so distance is an explicit fallback rather than a
  // reason to silently award zero.
  const steps = Math.max(0, input.steps ?? 0);
  const distance = Math.max(0, input.distanceMeters ?? 0);
  const exploration = steps > 0
    ? Math.min(120, Math.floor(steps / 100))
    : Math.min(120, Math.floor(distance / 100)); // ~1 Exploration / 100m
  const xp = steps > 0
    ? (steps >= 6000 ? 35 : steps >= 3000 ? 20 : 5)
    : (distance >= 6000 ? 35 : distance >= 3000 ? 20 : distance > 0 ? 5 : 0);
  return { energy: 0, knowledge: 0, exploration, xp };
}

export function raidProbability(attackerPower: number, defenderPower: number) {
  const ratio = attackerPower / Math.max(1, defenderPower);
  return Math.max(0.18, Math.min(0.86, 0.32 + 0.38 * ratio));
}
