import type { CanonicalActivityCandidate } from "./types";

export type DedupeDecision = { score: number; action: "merge" | "review" | "separate"; reasons: string[] };

function ratioSimilarity(a?: number | null, b?: number | null) {
  if (a == null || b == null || a <= 0 || b <= 0) return null;
  return Math.min(a, b) / Math.max(a, b);
}

export function dedupeScore(a: CanonicalActivityCandidate, b: CanonicalActivityCandidate): DedupeDecision {
  const reasons: string[] = [];
  let score = 0;

  if (a.category !== b.category) return { score: 0, action: "separate", reasons: ["Different activity categories"] };
  score += 20;

  const startDiff = Math.abs(new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()) / 60000;
  if (startDiff <= 2) { score += 45; reasons.push("Start times within 2 minutes"); }
  else if (startDiff <= 10) { score += 30; reasons.push("Start times within 10 minutes"); }
  else if (startDiff <= 20) { score += 10; reasons.push("Start times within 20 minutes"); }

  const durationSim = ratioSimilarity(a.movingSeconds ?? a.elapsedSeconds, b.movingSeconds ?? b.elapsedSeconds);
  if (durationSim != null) {
    if (durationSim >= 0.9) { score += 15; reasons.push("Duration very similar"); }
    else if (durationSim >= 0.8) score += 8;
  }

  const distanceSim = ratioSimilarity(a.distanceMeters, b.distanceMeters);
  if (distanceSim != null) {
    if (distanceSim >= 0.92) { score += 20; reasons.push("Distance very similar"); }
    else if (distanceSim >= 0.8) score += 10;
  }

  const action = score >= 85 ? "merge" : score >= 65 ? "review" : "separate";
  return { score: Math.min(100, score), action, reasons };
}
