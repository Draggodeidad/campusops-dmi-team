import type { IncidentLocation } from '../../campusops/contracts';
import { ApplicationFailure } from '../errors/ApplicationFailure';
import type { ValidatedProviderLocation } from './LocationCache';
import type { LocationFailure, LocationLookupResult } from './LocationProvider';

const kinds = new Set(['timeout', 'offline', 'incomplete', 'invalid_coordinates', 'invalid_response', 'unavailable']);
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export function validateProviderLocation(value: unknown):
  { location: ValidatedProviderLocation; failure?: never } | { failure: LocationFailure; location?: never } {
  if (!record(value)) return { failure: { kind: 'invalid_response' } };
  if (value.available === false && record(value.failure)) {
    const { kind, retryAfterMs } = value.failure;
    if (kind === 'rate_limited') return { failure: { kind,
      ...(typeof retryAfterMs === 'number' && Number.isFinite(retryAfterMs) && retryAfterMs >= 0 ? { retryAfterMs } : {}) } };
    if (typeof kind === 'string' && kinds.has(kind)) return { failure: { kind } as LocationFailure };
    return { failure: { kind: 'invalid_response' } };
  }
  if (value.available === false || value.error !== undefined || value.status !== undefined) return { failure: { kind: 'invalid_response' } };
  if (value.label === undefined || value.latitude === undefined || value.longitude === undefined) return { failure: { kind: 'incomplete' } };
  if (typeof value.label !== 'string' || !value.label.trim()) return { failure: { kind: 'invalid_response' } };
  const { latitude, longitude } = value;
  if (typeof latitude !== 'number' || typeof longitude !== 'number'
    || !Number.isFinite(latitude) || !Number.isFinite(longitude)
    || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return { failure: { kind: 'invalid_coordinates' } };
  return { location: { source: 'provider', label: value.label.trim(), latitude, longitude } };
}

export function manualIncidentLocation(label: string): IncidentLocation {
  if (typeof label !== 'string' || !label.trim()) throw new ApplicationFailure('INVALID_LOCATION_INPUT', 'Escribe una referencia manual no vacía.');
  return { source: 'manual', label: label.trim() };
}

export function evaluateIncidentLocation(provider: unknown, manualLabel: string): LocationLookupResult {
  const manual = manualIncidentLocation(manualLabel);
  const result = validateProviderLocation(provider);
  return result.location ? { location: result.location } : { location: manual, failure: result.failure };
}

export function selectIncidentLocation(provider: unknown, manualLabel: string): IncidentLocation {
  return evaluateIncidentLocation(provider, manualLabel).location;
}
