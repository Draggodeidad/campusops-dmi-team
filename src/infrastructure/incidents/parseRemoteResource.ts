import type { JsonObject, ParseResult } from '../../course-evaluation/contracts';

/**
 * Validates the published incident resource envelope according to docs/CAMPUSOPS_API.md:
 * - input must be an object (not null, not array)
 * - id: non-empty string
 * - version: non-negative integer (>= 0)
 * - status: non-empty string
 * - payload: plain JSON object or null
 * - extra fields in the envelope are ignored (forward-compatible)
 */
export function parseRemoteResource(input: unknown): ParseResult {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'contract' };
  }

  const candidate = input as Record<string, unknown>;

  const id = candidate.id;
  if (typeof id !== 'string' || id.trim().length === 0) {
    return { ok: false, error: 'contract' };
  }

  const version = candidate.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 0) {
    return { ok: false, error: 'contract' };
  }

  const status = candidate.status;
  if (typeof status !== 'string' || status.trim().length === 0) {
    return { ok: false, error: 'contract' };
  }

  const payload = candidate.payload;
  if (payload !== null) {
    if (typeof payload !== 'object' || Array.isArray(payload)) {
      return { ok: false, error: 'contract' };
    }
  }

  return {
    ok: true,
    value: {
      id,
      version,
      status,
      payload: payload as JsonObject | null,
    },
  };
}
