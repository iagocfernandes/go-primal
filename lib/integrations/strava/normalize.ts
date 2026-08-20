import type { CanonicalActivityCandidate, EvidenceCandidate } from "@/lib/proof/types";
import type { StravaActivity } from "./types";

const trainSports = new Set([
  "Run", "TrailRun", "VirtualRun",
  "Ride", "MountainBikeRide", "GravelRide", "VirtualRide", "EBikeRide", "EMountainBikeRide",
  "Swim", "Rowing", "Kayaking", "Canoeing", "StandUpPaddling",
  "NordicSki", "AlpineSki", "Snowboard", "Snowshoe",
  "WeightTraining", "Workout", "Crossfit", "HighIntensityIntervalTraining",
  "Yoga", "Pilates", "Elliptical", "StairStepper",
  "Soccer", "Tennis", "Pickleball", "Badminton", "Basketball", "Racquetball", "Squash",
  "RockClimbing", "Sail", "Surfing", "KitesurfSession", "WindsurfSession",
]);

const moveSports = new Set(["Walk", "Hike"]);

export function mapStravaCategory(sport?: string | null): "train" | "move" {
  if (sport && moveSports.has(sport)) return "move";
  if (sport && trainSports.has(sport)) return "train";
  return "train";
}

export function normalizeStravaActivity(userId: string, raw: StravaActivity): {
  activity: CanonicalActivityCandidate;
  evidence: EvidenceCandidate;
} {
  const started = new Date(raw.start_date);
  const ended = new Date(started.getTime() + Math.max(1, raw.elapsed_time) * 1000);
  const category = mapStravaCategory(raw.sport_type ?? raw.type ?? null);
  const hasGps = Boolean(raw.map?.polyline || raw.map?.summary_polyline) || (raw.distance ?? 0) > 0;

  return {
    activity: {
      userId,
      title: raw.name?.trim() || raw.sport_type || raw.type || "Strava activity",
      category,
      sportType: raw.sport_type ?? raw.type ?? null,
      startedAt: started.toISOString(),
      endedAt: ended.toISOString(),
      movingSeconds: raw.moving_time ?? null,
      elapsedSeconds: raw.elapsed_time ?? null,
      distanceMeters: raw.distance ?? null,
      elevationMeters: raw.total_elevation_gain ?? null,
      calories: raw.calories ?? null,
    },
    evidence: {
      provider: "strava",
      externalId: String(raw.id),
      sourceName: "Strava",
      deviceName: raw.device_name ?? null,
      manual: Boolean(raw.manual),
      hasGps,
      hasHeartRate: Boolean(raw.has_heartrate),
      providerFlagged: Boolean(raw.flagged),
      startedAt: started.toISOString(),
      endedAt: ended.toISOString(),
      movingSeconds: raw.moving_time ?? null,
      elapsedSeconds: raw.elapsed_time ?? null,
      distanceMeters: raw.distance ?? null,
      metadata: {
        name: raw.name ?? null,
        trainer: Boolean(raw.trainer),
        commute: Boolean(raw.commute),
        private: Boolean(raw.private),
        sportType: raw.sport_type ?? raw.type ?? null,
        externalId: raw.external_id ?? null,
      },
      raw: raw as unknown as Record<string, unknown>,
    },
  };
}
