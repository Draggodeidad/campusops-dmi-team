import { redactForTelemetry } from '../src/course-evaluation';

describe('HU #23 — redactForTelemetry specifications', () => {
  describe('Case 1: Simple structures and primitives', () => {
    it('redacts sensitive properties in a simple object', () => {
      const input = {
        userId: 'usr-12345',
        password: 'plain-password-secret',
        status: 'active',
      };
      const result = redactForTelemetry(input);
      expect(result).toEqual({
        userId: '[REDACTED]',
        password: '[REDACTED]',
        status: 'active',
      });
    });

    it('returns primitive values unchanged', () => {
      expect(redactForTelemetry('text-string')).toBe('text-string');
      expect(redactForTelemetry(42)).toBe(42);
      expect(redactForTelemetry(true)).toBe(true);
      expect(redactForTelemetry(null)).toBeNull();
      expect(redactForTelemetry(undefined)).toBeUndefined();
    });
  });

  describe('Case 2: Nested objects', () => {
    it('recursively redacts sensitive keys at multiple nesting levels', () => {
      const input = {
        user: {
          profile: {
            name: 'Juan Perez',
            token: 'secret-token-value',
            email: 'juan@campusops.test',
          },
          settings: {
            theme: 'dark',
          },
        },
      };
      const result = redactForTelemetry(input);
      expect(result).toEqual({
        user: {
          profile: {
            name: '[REDACTED]',
            token: '[REDACTED]',
            email: '[REDACTED]',
          },
          settings: {
            theme: 'dark',
          },
        },
      });
    });
  });

  describe('Case 3: Arrays', () => {
    it('processes array elements and redacts sensitive items within', () => {
      const input = [
        { incidentId: 'inc-01', location: 'Edificio A' },
        { incidentId: 'inc-02', location: 'Edificio B' },
      ];
      const result = redactForTelemetry(input);
      expect(result).toEqual([
        { incidentId: 'inc-01', location: '[REDACTED]' },
        { incidentId: 'inc-02', location: '[REDACTED]' },
      ]);
    });
  });

  describe('Case 4: List of nested objects', () => {
    it('processes lists of nested objects containing credentials and identities', () => {
      const input = {
        users: [
          {
            profile: {
              token: 'auth-token-1',
              displayName: 'Usuario Uno',
            },
          },
          {
            profile: {
              token: 'auth-token-2',
              displayName: 'Usuario Dos',
            },
          },
        ],
      };
      const result = redactForTelemetry(input);
      expect(result).toEqual({
        users: [
          {
            profile: {
              token: '[REDACTED]',
              displayName: '[REDACTED]',
            },
          },
          {
            profile: {
              token: '[REDACTED]',
              displayName: '[REDACTED]',
            },
          },
        ],
      });
    });
  });

  describe('Case 5: Combined complex structure', () => {
    it('processes objects with nested arrays and objects', () => {
      const input = {
        meta: {
          correlationId: 'corr-999',
          timestamp: 1727218800,
        },
        payload: {
          reporterId: 'rep-01',
          technicianId: 'tech-02',
          assignedTechnicianId: 'tech-02',
          location: 'Aula Magna',
          latitude: 18.46,
          longitude: -97.39,
          photos: ['photo-1.jpg', 'photo-2.jpg'],
          evidence: { evidenceId: 'ev-100' },
          internalComments: ['Comentario confidencial'],
          assignmentHistory: [{ technicianId: 'tech-01' }],
        },
        technicalContext: {
          incidentId: 'INC-2026',
          status: 'in_progress',
          attempt: 1,
          durationMs: 340,
        },
      };

      const result = redactForTelemetry(input);

      expect(result).toEqual({
        meta: {
          correlationId: 'corr-999',
          timestamp: 1727218800,
        },
        payload: {
          reporterId: '[REDACTED]',
          technicianId: '[REDACTED]',
          assignedTechnicianId: '[REDACTED]',
          location: '[REDACTED]',
          latitude: '[REDACTED]',
          longitude: '[REDACTED]',
          photos: '[REDACTED]',
          evidence: '[REDACTED]',
          internalComments: '[REDACTED]',
          assignmentHistory: '[REDACTED]',
        },
        technicalContext: {
          incidentId: 'INC-2026',
          status: 'in_progress',
          attempt: 1,
          durationMs: 340,
        },
      });
    });
  });

  describe('Contract Normalization & Sensitive Keys (docs/CAMPUSOPS_API.md)', () => {
    it('normalizes keys by lowercasing and stripping underscores and hyphens', () => {
      const input = {
        'access-token': 'token-1',
        REFRESH_TOKEN: 'token-2',
        User_Id: 'usr-9',
        'internal-comments': 'nota',
        Assignment_History: [],
        incidentId: 'inc-preserved',
      };
      const result = redactForTelemetry(input);
      expect(result).toEqual({
        'access-token': '[REDACTED]',
        REFRESH_TOKEN: '[REDACTED]',
        User_Id: '[REDACTED]',
        'internal-comments': '[REDACTED]',
        Assignment_History: '[REDACTED]',
        incidentId: 'inc-preserved',
      });
    });
  });

  describe('Input Immutability', () => {
    it('returns a new object and does not mutate the frozen input', () => {
      const original = Object.freeze({
        token: 'secret-token-do-not-change',
        password: 'plain-password',
        user: Object.freeze({
          email: 'frozen@campusops.test',
        }),
        status: 'open',
      });

      const output = redactForTelemetry(original) as Record<string, unknown>;

      expect(output).not.toBe(original);
      expect(output.token).toBe('[REDACTED]');
      expect(output.password).toBe('[REDACTED]');
      expect((output.user as Record<string, unknown>).email).toBe('[REDACTED]');
      expect(output.status).toBe('open');

      // Original remains untouched
      expect(original.token).toBe('secret-token-do-not-change');
      expect(original.password).toBe('plain-password');
      expect(original.user.email).toBe('frozen@campusops.test');
    });
  });
});
