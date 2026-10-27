import type { LocationProvider, LocationUnavailable } from '../../../src/application/location/LocationProvider';
import type { StablePostRequest } from '../../../src/application/resilience/RetryPolicy';
import type { PendingIncidentOperation } from '../../../src/campusops/contracts';

export type LocationScenario = 'success' | 'incomplete' | 'invalid_coordinates' | 'slow' | 'timeout' | 'rate_limited' | 'offline';

export const LOCATION_QUERY = 'Edificio de prueba A';
export const NORMALIZED_LOCATION_QUERY = 'edificio de prueba a';
export const MANUAL_LOCATION_LABEL = 'Zona manual de prueba';

/** Fresh data for every consumer; slow uses injected time, never a real timer. */
export function createLocationFixture(scenario: LocationScenario): Readonly<{
  scenario: LocationScenario;
  response: unknown;
  delayMs: number;
  backendScenario: string | null;
}> {
  const unavailable = (failure: LocationUnavailable['failure']): LocationUnavailable => ({ available: false, failure });
  const response: unknown = scenario === 'incomplete' ? { label: 'Zona ficticia' }
    : scenario === 'invalid_coordinates' ? { label: 'Zona ficticia', latitude: 999, longitude: null }
      : scenario === 'timeout' ? unavailable({ kind: 'timeout' })
        : scenario === 'offline' ? unavailable({ kind: 'offline' })
          : scenario === 'rate_limited' ? unavailable({ kind: 'rate_limited', retryAfterMs: 1000 })
            : { label: LOCATION_QUERY, latitude: 0, longitude: 0 };
  return { scenario, response, delayMs: scenario === 'slow' ? 1200 : 0,
    backendScenario: scenario === 'offline' ? null : scenario === 'timeout' ? 'slow' : scenario };
}

/** Transport/provider double for #61/#64; this is never composed into the app. */
export function createLocationProviderDouble(
  fixture: ReturnType<typeof createLocationFixture>,
  wait: (delayMs: number) => Promise<void>,
): LocationProvider & { readonly queries: string[] } {
  const queries: string[] = [];
  return {
    queries,
    async lookup(query) {
      queries.push(query);
      if (fixture.delayMs) await wait(fixture.delayMs);
      return structuredClone(fixture.response);
    },
  };
}

/** Fresh backend: start v1 -> resolve v2 -> close v3. No reassignment prerequisite. */
export function createLostResponseFixture() {
  const operation: PendingIncidentOperation = {
    operationId: 'resolve-campus-inc-001-op-1', incidentId: 'campus-inc-001',
    actorId: 'technician-1', action: 'resolve', baseVersion: 2,
    payload: { diagnosis: 'Cable sintético sustituido' },
  };
  const request: StablePostRequest = {
    operationId: operation.operationId, path: '/v1/incidents/campus-inc-001/actions',
    body: JSON.stringify({ ...operation.payload, action: operation.action, baseVersion: operation.baseVersion }),
  };
  return {
    preparation: { actorId: 'technician-1', operationId: 'w09-start-campus-inc-001', body: { action: 'start', baseVersion: 1 } },
    operation, request, scenario: 'timeout_after_commit', timeoutMs: 250,
    expected: { version: 3, status: 'resolved', action: 'resolve', eventCount: 1 },
    close: { actorId: 'coordinator-1', operationId: 'close-campus-inc-001-op-1', body: { action: 'close', baseVersion: 3 } },
  } as const;
}
