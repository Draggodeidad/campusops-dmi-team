import { ApplicationFailure } from '../errors/ApplicationFailure';
import type { ResilienceClock } from '../resilience/ResilienceClock';
import type { LocationCache, LocationConfiguration } from './LocationCache';
import type { LocationLookupResult, LocationProvider } from './LocationProvider';
import { evaluateIncidentLocation, manualIncidentLocation, validateProviderLocation } from './selectIncidentLocation';

export const DEFAULT_LOCATION_CONFIGURATION: LocationConfiguration = { cacheTtlMs: 300000, timeoutMs: 1000 };

export function validateLocationConfiguration(config: LocationConfiguration): void {
  if (!Number.isFinite(config.cacheTtlMs) || config.cacheTtlMs < 0 || !Number.isFinite(config.timeoutMs) || config.timeoutMs <= 0) {
    throw new ApplicationFailure('INVALID_LOCATION_CONFIGURATION', 'La configuración de ubicación no es válida.');
  }
}

export class LookupIncidentLocation {
  private readonly config: LocationConfiguration;
  constructor(private readonly provider: LocationProvider, private readonly cache: LocationCache,
    private readonly clock: Pick<ResilienceClock, 'now'>, config: LocationConfiguration = DEFAULT_LOCATION_CONFIGURATION) {
    validateLocationConfiguration(config);
    this.config = { ...config };
  }

  async execute(input: Readonly<{ query: string; manualLabel: string }>): Promise<LocationLookupResult> {
    manualIncidentLocation(input.manualLabel);
    if (typeof input.query !== 'string') throw new ApplicationFailure('INVALID_LOCATION_INPUT', 'Escribe una consulta ficticia no vacía.');
    const query = input.query.normalize('NFC').trim().replace(/\s+/gu, ' ').toLowerCase();
    if (!query) throw new ApplicationFailure('INVALID_LOCATION_INPUT', 'Escribe una consulta ficticia no vacía.');
    if (this.config.cacheTtlMs > 0) {
      try {
        const entry = await this.cache.get(query);
        const now = this.clock.now();
        if (entry && Number.isFinite(now) && Number.isFinite(entry.storedAtMs) && Number.isFinite(entry.expiresAtMs)
          && entry.storedAtMs <= now && now < entry.expiresAtMs) {
          const validated = validateProviderLocation(entry.location);
          if (validated.location && entry.location.source === 'provider') return { location: validated.location, cacheHit: true };
        }
      } catch { /* Cache failure must not disable location entry. */ }
    }
    let raw: unknown;
    try { raw = await this.provider.lookup(query); }
    catch { raw = { available: false, failure: { kind: 'unavailable' } }; }
    const result = evaluateIncidentLocation(raw, input.manualLabel);
    const validated = validateProviderLocation(result.location);
    if (validated.location && this.config.cacheTtlMs > 0) {
      const now = this.clock.now();
      const expiresAtMs = now + this.config.cacheTtlMs;
      if (Number.isFinite(now) && Number.isFinite(expiresAtMs)) {
        try { await this.cache.put(query, { location: validated.location, storedAtMs: now, expiresAtMs }); }
        catch { /* A validated provider result remains usable without cache. */ }
      }
    }
    return { ...result, cacheHit: false };
  }
}
