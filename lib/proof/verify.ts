import type { EvidenceCandidate, VerificationResult } from "./types";

export function verifyEvidence(evidences: EvidenceCandidate[]): VerificationResult {
  if (!evidences.length) {
    return { level: "unverified", internalScore: 0, riskFlags: ["no_evidence"], reasons: ["No evidence attached"] };
  }

  let score = 0;
  const flags = new Set<string>();
  const reasons: string[] = [];

  for (const e of evidences) {
    // Proof V2: a connected provider is meaningful evidence, but VERIFIED should
    // require provenance such as device/GPS/HR instead of connection alone.
    if (e.provider === "strava" && !e.manual) { score += 50; reasons.push("Connected Strava activity"); }
    if (e.provider === "healthkit" || e.provider === "health_connect") { score += 55; reasons.push("Native health platform evidence"); }
    if (e.provider === "go_primal") { score += 50; reasons.push("Recorded by GO PRIMAL"); }
    if (e.provider === "manual") {
      score += 15;
      reasons.push("Manual activity submitted");
      if (e.metadata?.hasPhoto) { score += 25; reasons.push("Photo proof attached"); }
    }
    if (e.deviceName) { score += 15; reasons.push("Recording device identified"); }
    if (e.hasGps) { score += 15; reasons.push("GPS evidence present"); }
    if (e.hasHeartRate) { score += 10; reasons.push("Heart-rate evidence present"); }
    if (e.manual) { score -= 10; flags.add("manual_entry"); }
    if (e.providerFlagged) { score -= 50; flags.add("provider_flagged"); }

    const moving = Number(e.movingSeconds ?? 0);
    const elapsed = Number(e.elapsedSeconds ?? 0);
    if (moving > 0 && elapsed > Math.max(moving * 4, moving + 6 * 60 * 60)) {
      flags.add("elapsed_time_outlier");
      reasons.push("Elapsed time is unusually larger than active moving time");
    }
  }

  score = Math.max(0, Math.min(100, score));
  const level = score >= 75 ? "verified" : score >= 45 ? "connected" : score >= 15 ? "proof_submitted" : "unverified";
  return { level, internalScore: score, riskFlags: [...flags], reasons };
}
