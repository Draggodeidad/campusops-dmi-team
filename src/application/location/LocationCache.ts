import type { IncidentLocation } from '../../campusops/contracts';

/** Only centrally validated provider locations can be cached, never manual fallback. */
export type ValidatedProviderLocation = IncidentLocation & Readonly<{
  source: 'provider';
  latitude: number;
  longitude: number;
}>;

export type LocationCacheEntry = Readonly<{
  location: ValidatedProviderLocation;
  storedAtMs: number;
  expiresAtMs: number;
}>;

export interface LocationCache {
  /** Key: query.normalize('NFC').trim().replace(/\s+/gu, ' ').toLowerCase(). */
  get(normalizedQuery: string): Promise<LocationCacheEntry | null>;
  put(normalizedQuery: string, entry: LocationCacheEntry): Promise<void>;
}

/** Finite nonnegative TTL (zero disables caching); finite positive timeout. */
export type LocationConfiguration = Readonly<{ cacheTtlMs: number; timeoutMs: number }>;
