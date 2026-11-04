import type { RemoteRequestEvent, RemoteRequestIntent, RemoteUiOutcome } from '../../src/application/ui-state/RemoteUiState';
import type { LocalIncidentView } from '../../src/application/sync/IncidentWorkspace';
import type { DiagnosticEvent } from '../../src/application/telemetry/emitDiagnostic';
import type { Incident } from '../../src/domain/incidents/Incident';

export const incidentA = {
  id: 'campus-inc-001',
  title: 'Incidencia sintética A',
  description: 'Caso de prueba',
  category: 'electrical',
  status: 'assigned',
  locationLabel: 'Zona ficticia',
} as const satisfies Incident;
export const incidentB = { ...incidentA, id: 'campus-inc-002', title: 'Incidencia sintética B' } as const;

export const intentA = { requestId: 'A', selectionId: incidentA.id } as const satisfies RemoteRequestIntent;
export const intentB = { requestId: 'B', selectionId: incidentB.id } as const satisfies RemoteRequestIntent;
export const listIntent = { requestId: 'list-1', selectionId: null } as const satisfies RemoteRequestIntent;

export const responsesBThenA = [
  { type: 'resolve', intent: intentB, outcome: { state: 'success', value: incidentB } },
  { type: 'resolve', intent: intentA, outcome: { state: 'success', value: incidentA } },
] as const satisfies readonly RemoteRequestEvent<Incident>[];

export const cancelB = { type: 'cancel', intent: intentB } as const satisfies RemoteRequestEvent<Incident>;

const localCopy = { incident: incidentA, notes: [], photos: [], operations: [] } as const satisfies LocalIncidentView;
const pendingStart = {
  operationId: 'synthetic-op-1', incidentId: incidentA.id, actorId: 'technician-1',
  baseVersion: 1, action: 'start', payload: {},
} as const;

export const stateOutcomes = {
  empty: { state: 'empty' },
  error: { state: 'error', error: 'INCIDENTS_UNAVAILABLE' },
  offline: { state: 'offline', value: localCopy },
  pending: {
    state: 'pending',
    value: { ...localCopy, operations: [{ operation: pendingStart, state: { state: 'pending' } }] },
  },
  conflict: {
    state: 'conflict',
    value: { ...localCopy, operations: [{ operation: pendingStart, state: { state: 'conflict', fields: ['work'] } }] },
  },
} as const satisfies Record<string, RemoteUiOutcome<LocalIncidentView>>;

const diagnostic = {
  correlationId: 'w10-request-1',
  incidentId: incidentA.id,
  status: 'timeout',
  attempt: 2,
  durationMs: 150,
} as const satisfies DiagnosticEvent;

export const sensitiveDiagnostic = {
  ...diagnostic,
  path: '/synthetic/incidents',
  body: {
    access_token: 'synthetic-marker',
    nested: [{ location: 'Zona ficticia', photos: ['test-photo'], internalComments: 'Nota ficticia' }],
    description: 'Texto libre ficticio',
  },
} as const;

export const expectedDiagnostic = diagnostic;
