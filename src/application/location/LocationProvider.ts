import type { IncidentLocation } from '../../campusops/contracts';

/** Raw external data must pass selectIncidentLocation before entering the app. */
export interface LocationProvider {
  lookup(query: string): Promise<unknown>;
}

/** Expected failures contain no response body, query, coordinates or provider error. */
export type LocationFailure =
  | Readonly<{ kind: 'timeout' | 'offline' | 'incomplete' | 'invalid_coordinates' | 'invalid_response' | 'unavailable' }>
  | Readonly<{ kind: 'rate_limited'; retryAfterMs?: number }>;

/** HTTP adapters resolve expected failures as this value; lookup still returns unknown. */
export type LocationUnavailable = Readonly<{ available: false; failure: LocationFailure }>;

/** Application can retain the failure reason alongside the public manual selection. */
export type LocationLookupResult = Readonly<{
  location: IncidentLocation;
  failure?: LocationFailure;
  cacheHit?: boolean;
}>;
