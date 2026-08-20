export type StravaTokenResponse = {
  token_type: string;
  expires_at: number;
  expires_in: number;
  refresh_token: string;
  access_token: string;
  athlete?: { id: number; username?: string | null; firstname?: string | null; lastname?: string | null };
};

export type StravaActivity = {
  id: number;
  external_id?: string | null;
  name: string;
  type?: string;
  sport_type?: string;
  start_date: string;
  elapsed_time: number;
  moving_time: number;
  distance: number;
  total_elevation_gain?: number;
  calories?: number;
  manual?: boolean;
  trainer?: boolean;
  commute?: boolean;
  flagged?: boolean;
  device_name?: string | null;
  has_heartrate?: boolean;
  map?: { summary_polyline?: string | null; polyline?: string | null } | null;
  private?: boolean;
};

export type StravaActivityListOptions = {
  after?: number;
  before?: number;
  page?: number;
  perPage?: number;
};
