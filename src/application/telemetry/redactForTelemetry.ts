const sensitiveTelemetryKeys = new Set([
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

export function redactForTelemetry(input: unknown): unknown {
  if (Array.isArray(input)) {
    return input.map(redactForTelemetry);
  }

  if (input !== null && typeof input === 'object') {
    return Object.fromEntries(
      Object.entries(input).map(([key, value]) => [
        key,
        sensitiveTelemetryKeys.has(key.toLowerCase().replace(/[_-]/g, ''))
          ? '[REDACTED]'
          : redactForTelemetry(value),
      ]),
    );
  }

  return input;
}
