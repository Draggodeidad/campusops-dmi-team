import { redactForTelemetry } from '../src/course-evaluation';

describe('redactForTelemetry security unit tests', () => {
  it('redacts sensitive keys regardless of case and formatting', () => {
    const payload = {
      'access-token': 'secret-token-123',
      USER_PASSWORD: 'plain-password-xyz',
      Client_Secret: 'client-sec-456',
      ApiKey: 'ak_live_789',
      incidentId: 'INC-2026-001',
      status: 'in_progress',
    };

    const redacted = redactForTelemetry(payload);

    expect(redacted).toEqual({
      'access-token': '[REDACTED]',
      USER_PASSWORD: '[REDACTED]',
      Client_Secret: '[REDACTED]',
      ApiKey: '[REDACTED]',
      incidentId: 'INC-2026-001',
      status: 'in_progress',
    });
  });

  it('redacts deeply nested objects and lists while preserving non-sensitive data', () => {
    const payload = {
      meta: {
        timestamp: 1727218800000,
        requestId: 'req-abc-999',
      },
      user: {
        profile: {
          fullName: 'Juan Pérez Ficticio',
          email: 'usuario.sintetico@campusops.test',
          phoneNumber: '+52 238 000 0000',
        },
      },
      incidents: [
        {
          id: 'INC-100',
          locationLabel: 'Edificio A, Aula 101',
          coordinates: { latitude: 18.46, longitude: -97.39 },
          category: 'electrical',
        },
      ],
    };

    const redacted = redactForTelemetry(payload);

    expect(redacted).toEqual({
      meta: {
        timestamp: 1727218800000,
        requestId: 'req-abc-999',
      },
      user: {
        profile: {
          fullName: '[REDACTED]',
          email: '[REDACTED]',
          phoneNumber: '[REDACTED]',
        },
      },
      incidents: [
        {
          id: 'INC-100',
          locationLabel: '[REDACTED]',
          coordinates: '[REDACTED]',
          category: 'electrical',
        },
      ],
    });
  });

  it('preserves immutability of the original input', () => {
    const original = Object.freeze({
      token: 'do-not-mutate-me',
      status: 'open',
    });

    const output = redactForTelemetry(original);

    expect(output).toEqual({
      token: '[REDACTED]',
      status: 'open',
    });
    expect(original.token).toBe('do-not-mutate-me');
  });

  it('handles primitive values and null/undefined gracefully', () => {
    expect(redactForTelemetry(null)).toBeNull();
    expect(redactForTelemetry('simple-string')).toBe('simple-string');
    expect(redactForTelemetry(12345)).toBe(12345);
    expect(redactForTelemetry(undefined)).toBeUndefined();
  });
});
