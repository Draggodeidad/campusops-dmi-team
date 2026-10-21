import type {
  AuthEvent,
  PermissionEvent,
  RemoteResponse,
} from './contracts';
import type { IncidentLocation } from '../campusops/contracts';

import { RefreshCoordinator } from '../application/session/RefreshCoordinator';

import { redactForTelemetry } from '../application/telemetry/redactForTelemetry';

import { parseRemoteResource } from '../infrastructure/incidents/parseRemoteResource';

function pending(name: string): never {
  throw new Error(`${name} must be implemented in the assigned week`);
}

export { redactForTelemetry, parseRemoteResource };
export { resolveSync } from '../application/sync/resolveSync';
export { deduplicateOperations } from '../application/sync/deduplicateOperations';

export function coordinateRefresh(events: readonly AuthEvent[]): Readonly<{
  status: 'anonymous' | 'authenticated';
  activeGeneration: number | null;
  refreshCalls: number;
  retriedRequestIds: readonly string[];
  persistedToken: string | null;
}> {
  const coordinator = new RefreshCoordinator();
  for (const event of events) {
    switch (event.type) {
      case 'request401':
        coordinator.begin(event.generation ?? 0, event.requestId);
        break;
      case 'refreshSucceeded': {
        const source = coordinator.getFlightGeneration();
        if (source !== null && (event.generation === undefined || event.generation === source + 1)) {
          coordinator.complete(source, event.token ?? '', event.generation ?? source + 1);
        }
        break;
      }
      case 'refreshFailed': {
        const source = coordinator.getFlightGeneration();
        if (source !== null && (event.generation === undefined || event.generation === source)) coordinator.fail(source);
        break;
      }
      case 'logout':
        coordinator.invalidate();
        break;
    }
  }
  return coordinator.getSummary();
}

export function planRetry(_input: Readonly<{
  method: 'GET' | 'POST';
  status: number | 'timeout';
  attempt: number;
  retryAfterMs?: number;
  idempotencyKey?: string;
}>): Readonly<{ retry: boolean; delayMs: number; requiresStableIdempotencyKey: boolean }> {
  return pending('planRetry');
}

export function reduceRemoteResponses(_input: Readonly<{
  activeRequestId: string;
  responses: readonly RemoteResponse[];
}>): Readonly<{ state: 'success' | 'error' | 'loading'; value?: unknown; error?: string }> {
  return pending('reduceRemoteResponses');
}

export function reducePermissionLifecycle(
  _events: readonly PermissionEvent[],
): Readonly<{ status: 'available' | 'denied' | 'blocked'; resourceActive: boolean }> {
  return pending('reducePermissionLifecycle');
}

/** Week 09: see docs/CAMPUSOPS_API.md; this is not a completed solution. */
export function selectIncidentLocation(_provider: unknown, _manualLabel: string): IncidentLocation {
  return pending('selectIncidentLocation');
}
