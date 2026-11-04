import type {
  AuthEvent,
  PermissionEvent,
  RemoteResponse,
} from './contracts';

import { settleRemoteRequest, startRemoteRequest } from '../application/ui-state/RemoteUiState';
import type { RemoteUiState } from '../application/ui-state/RemoteUiState';
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

export { planRetry } from '../application/resilience/RetryPolicy';

export function reduceRemoteResponses(input: Readonly<{
  activeRequestId: string;
  responses: readonly RemoteResponse[];
}>): Readonly<{ state: 'success' | 'error' | 'loading'; value?: unknown; error?: string }> {
  const intent = { requestId: input.activeRequestId, selectionId: null };
  let current: RemoteUiState<unknown> = startRemoteRequest(intent);
  for (const response of input.responses) {
    const responseIntent = { requestId: response.requestId, selectionId: null };
    if (response.error !== undefined) {
      current = settleRemoteRequest(current, {
        type: 'resolve', intent: responseIntent, outcome: { state: 'error', error: response.error },
      });
    } else if ('value' in response) {
      current = settleRemoteRequest(current, {
        type: 'resolve', intent: responseIntent, outcome: { state: 'success', value: response.value },
      });
    }
  }
  if (current.state === 'success') return { state: 'success', value: current.value };
  if (current.state === 'error') return { state: 'error', error: current.error };
  return { state: 'loading' };
}

export function reducePermissionLifecycle(
  _events: readonly PermissionEvent[],
): Readonly<{ status: 'available' | 'denied' | 'blocked'; resourceActive: boolean }> {
  return pending('reducePermissionLifecycle');
}

export { selectIncidentLocation } from '../application/location/selectIncidentLocation';
