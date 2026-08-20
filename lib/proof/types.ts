export type ActivityCategory = "train" | "focus" | "move";
export type EvidenceProvider = "strava" | "healthkit" | "health_connect" | "go_primal" | "manual";
export type VerificationLevel = "verified" | "connected" | "proof_submitted" | "unverified";

export type CanonicalActivityCandidate = {
  userId: string;
  title?: string | null;
  category: ActivityCategory;
  sportType?: string | null;
  startedAt: string;
  endedAt: string;
  movingSeconds?: number | null;
  elapsedSeconds?: number | null;
  distanceMeters?: number | null;
  elevationMeters?: number | null;
  calories?: number | null;
};

export type EvidenceCandidate = {
  provider: EvidenceProvider;
  externalId: string;
  sourceName?: string | null;
  deviceName?: string | null;
  manual: boolean;
  hasGps: boolean;
  hasHeartRate: boolean;
  providerFlagged: boolean;
  startedAt: string;
  endedAt: string;
  movingSeconds?: number | null;
  elapsedSeconds?: number | null;
  distanceMeters?: number | null;
  metadata?: Record<string, unknown>;
  raw?: Record<string, unknown>;
};

export type VerificationResult = {
  level: VerificationLevel;
  internalScore: number;
  riskFlags: string[];
  reasons: string[];
};
