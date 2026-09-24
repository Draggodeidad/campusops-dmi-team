import { redactForTelemetry } from '../src/application/telemetry/redactForTelemetry';

test('redacts normalized sensitive keys in nested objects and lists without mutating input', () => {
  const headers = Object.freeze({ Authorization: 'Bearer token-ficticio', accept: 'application/json' });
  const actor = Object.freeze({ 'user_id': 'actor-ficticio', status: 'active' });
  const records = Object.freeze([Object.freeze({ 'access-token': 'token-ficticio', attempt: 2 })]);
  const input = Object.freeze({
    headers,
    actor,
    records,
    'assignment-history': Object.freeze(['asignacion-ficticia']),
    incidentId: 'INC-001',
    correlationId: 'corr-ficticia',
    durationMs: 12,
  });

  expect(redactForTelemetry(input)).toEqual({
    headers: { Authorization: '[REDACTED]', accept: 'application/json' },
    actor: { user_id: '[REDACTED]', status: 'active' },
    records: [{ 'access-token': '[REDACTED]', attempt: 2 }],
    'assignment-history': '[REDACTED]',
    incidentId: 'INC-001',
    correlationId: 'corr-ficticia',
    durationMs: 12,
  });
  expect(input.headers.Authorization).toBe('Bearer token-ficticio');
  expect(input.records[0]?.['access-token']).toBe('token-ficticio');
});

test('preserves null, primitives and safe array values', () => {
  expect(redactForTelemetry(null)).toBeNull();
  expect(redactForTelemetry('status')).toBe('status');
  expect(redactForTelemetry([null, 4, { status: 'open', photos: ['foto-ficticia'] }])).toEqual([
    null,
    4,
    { status: 'open', photos: '[REDACTED]' },
  ]);
});
