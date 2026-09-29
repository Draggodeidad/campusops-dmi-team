const SENSITIVE_NORMALIZED_KEYS = new Set<string>([
  'authorization',
  'password',
  'token',
  'accesstoken',
  'refreshtoken',
  'email',
  'displayname',
  'name',
  'userid',
  'reporterid',
  'technicianid',
  'assignedtechnicianid',
  'location',
  'latitude',
  'longitude',
  'photos',
  'evidence',
  'internalcomments',
  'assignmenthistory',
]);

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[-_]/g, '');
}

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_NORMALIZED_KEYS.has(normalizeKey(key));
}

/**
 * Redacts sensitive fields from telemetry and diagnostic payloads according to docs/CAMPUSOPS_API.md.
 * Pure function: creates a new structure without mutating the original input.
 * Preserves non-sensitive technical context (e.g. incidentId, correlationId, status, attempt, durationMs).
 */
export function redactForTelemetry(input: unknown): unknown {
  if (input === null || typeof input !== 'object') {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map((item) => redactForTelemetry(item));
  }

  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (isSensitiveKey(key)) {
      output[key] = '[REDACTED]';
    } else if (value !== null && typeof value === 'object') {
      output[key] = redactForTelemetry(value);
    } else {
      output[key] = value;
    }
  }

  return output;
}
