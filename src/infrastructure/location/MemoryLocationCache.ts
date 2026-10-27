import type { LocationCache, LocationCacheEntry } from '../../application/location/LocationCache';
import { validateProviderLocation } from '../../application/location/selectIncidentLocation';

/** Volatile bounded LRU; no storage, session data or telemetry. */
export class MemoryLocationCache implements LocationCache {
  private readonly entries = new Map<string, LocationCacheEntry>();
  constructor(private readonly capacity = 50) {
    if (!Number.isInteger(capacity) || capacity <= 0) throw new Error('Invalid location cache capacity');
  }
  async get(key: string): Promise<LocationCacheEntry | null> {
    const entry = this.entries.get(key);
    if (!entry) return null;
    this.entries.delete(key); this.entries.set(key, entry);
    return { ...entry, location: { ...entry.location } };
  }
  async put(key: string, entry: LocationCacheEntry): Promise<void> {
    const valid = validateProviderLocation(entry?.location);
    if (!valid.location || entry.location.source !== 'provider' || !Number.isFinite(entry.storedAtMs)
      || !Number.isFinite(entry.expiresAtMs) || entry.expiresAtMs <= entry.storedAtMs) return;
    this.entries.delete(key);
    this.entries.set(key, { location: valid.location, storedAtMs: entry.storedAtMs, expiresAtMs: entry.expiresAtMs });
    if (this.entries.size > this.capacity) this.entries.delete(this.entries.keys().next().value!);
  }
}
