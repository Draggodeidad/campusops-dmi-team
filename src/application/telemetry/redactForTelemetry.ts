const SENSITIVE_KEYS = new Set([
  'authorization',
  'auth',
  'token',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'bearertoken',
  'bearer',
  'password',
  'passwd',
  'secret',
  'clientsecret',
  'apikey',
  'credential',
  'credentials',
  'email',
  'useremail',
  'displayname',
  'fullname',
  'location',
  'locationlabel',
  'locationdescription',
  'photos',
  'photo',
  'internalcomments',
  'internalnotes',
  'comment',
  'comments',
  'phone',
  'phonenumber',
  'telephone',
  'cookie',
  'cookies',
  'session',
  'sessionid',
  'latitude',
  'longitude',
  'coordinates',
]);

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[-_\s]/g, '');
  if (SENSITIVE_KEYS.has(normalized)) {
    return true;
  }
  if (
    normalized.endsWith('token') ||
    normalized.endsWith('password') ||
    normalized.endsWith('secret') ||
    normalized.endsWith('apikey')
  ) {
    return true;
  }
  return false;
}

/**
 * Redacts personal, credential and sensitive incident information from telemetry payloads,
 * preserving technical diagnostic context (identifiers, status, protocol headers).
 * Pure function: does not mutate the original input.
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
