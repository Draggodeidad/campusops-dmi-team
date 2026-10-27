import { DEFAULT_LOCATION_CONFIGURATION, validateLocationConfiguration } from '../../application/location/LookupIncidentLocation';
import type { LocationConfiguration } from '../../application/location/LocationCache';
import type { LocationFailure, LocationProvider, LocationUnavailable } from '../../application/location/LocationProvider';
import type { ResilienceClock } from '../../application/resilience/ResilienceClock';
import type { IncidentTransport } from '../http/IncidentTransport';

export const PHOTON_URL = 'https://photon.komoot.io';
const unavailable = (failure: LocationFailure): LocationUnavailable => ({ available: false, failure });
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);

export function parseLocationRetryAfter(value: string | undefined, nowMs: number): number | undefined {
  if (!value || !Number.isFinite(nowMs)) return undefined;
  const text = value.trim();
  const delay = /^\d+(?:\.\d+)?$/.test(text) ? Number(text) * 1000
    : /^[A-Za-z]{3}, /.test(text) ? Date.parse(text) - nowMs : NaN;
  return Number.isFinite(delay) && delay >= 0 && Number.isFinite(nowMs + delay) ? delay : undefined;
}

/** Maps the provider wire format only. Application owns coordinate validation. */
function mapPhoton(value: unknown): unknown {
  if (!record(value) || value.type !== 'FeatureCollection' || !Array.isArray(value.features)) return unavailable({ kind: 'invalid_response' });
  if (value.features.length === 0) return unavailable({ kind: 'unavailable' });
  const first: unknown = value.features[0];
  if (!record(first) || first.type !== 'Feature' || !record(first.properties)) return unavailable({ kind: 'invalid_response' });
  const p = first.properties;
  const parts = [p.name, p.street, p.housenumber, p.city, p.state, p.country]
    .filter((part): part is string => typeof part === 'string' && Boolean(part.trim()))
    .map(part => part.trim());
  const label = [...new Set(parts)].join(', ');
  if (first.geometry === undefined || first.geometry === null) return { label };
  if (!record(first.geometry) || first.geometry.type !== 'Point' || !Array.isArray(first.geometry.coordinates)) return unavailable({ kind: 'invalid_response' });
  return { label, longitude: first.geometry.coordinates[0], latitude: first.geometry.coordinates[1] };
}

export class SystemLocationClock {
  now(): number { return Date.now(); }
}

/** Single attempt per explicit search; never uses the session transport. */
export class PhotonLocationProvider implements LocationProvider {
  private nextAllowedMs = -Infinity;
  private inFlight = false;
  private readonly config: LocationConfiguration;
  constructor(private readonly transport: IncidentTransport, private readonly clock: Pick<ResilienceClock, 'now'>,
    config: LocationConfiguration = DEFAULT_LOCATION_CONFIGURATION) {
    validateLocationConfiguration(config); this.config = { ...config };
  }
  async lookup(query: string): Promise<unknown> {
    const remaining = this.nextAllowedMs - this.clock.now();
    if (remaining > 0) return unavailable({ kind: 'rate_limited', ...(Number.isFinite(remaining) ? { retryAfterMs: remaining } : {}) });
    if (this.inFlight) return unavailable({ kind: 'unavailable' });
    this.inFlight = true;
    try {
      const response = await this.transport.send({ method: 'GET', path: `/api/?q=${encodeURIComponent(query)}&limit=1`, timeoutMs: this.config.timeoutMs });
      if (response.status === 429) {
        const now = this.clock.now();
        const header = Object.entries(response.headers).find(([key]) => key.toLowerCase() === 'retry-after')?.[1];
        const retryAfterMs = parseLocationRetryAfter(header, now);
        if (retryAfterMs !== undefined) this.nextAllowedMs = now + retryAfterMs;
        return unavailable({ kind: 'rate_limited', ...(retryAfterMs !== undefined ? { retryAfterMs } : {}) });
      }
      if (response.status !== 200) return unavailable({ kind: 'unavailable' });
      try { return mapPhoton(JSON.parse(response.bodyText)); }
      catch { return unavailable({ kind: 'invalid_response' }); }
    } catch (error: unknown) {
      return unavailable({ kind: error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name) ? 'timeout' : 'offline' });
    } finally { this.inFlight = false; }
  }
}
