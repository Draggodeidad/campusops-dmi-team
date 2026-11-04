import { reduceRemoteResponses } from '../src/course-evaluation';
import { emitDiagnostic } from '../src/application/telemetry/emitDiagnostic';
import type { DiagnosticEvent } from '../src/application/telemetry/emitDiagnostic';
import type { LocalIncidentView } from '../src/application/sync/IncidentWorkspace';
import { remoteUiActions, settleRemoteRequest, startRemoteRequest } from '../src/application/ui-state/RemoteUiState';
import type { RemoteUiState } from '../src/application/ui-state/RemoteUiState';
import type { Incident } from '../src/domain/incidents/Incident';
import {
  cancelB, expectedDiagnostic, incidentB, intentA, intentB, listIntent, responsesBThenA,
  sensitiveDiagnostic, stateOutcomes,
} from './fixtures/week-10';

test('the active B selection wins when its response arrives before A', () => {
  let current: RemoteUiState<Incident> = startRemoteRequest(intentA);
  current = startRemoteRequest(intentB);
  for (const event of responsesBThenA) current = settleRemoteRequest(current, event);
  expect(current).toEqual({ state: 'success', value: incidentB, intent: intentB });
  expect(remoteUiActions[current.state]).toBe('continue');
});

test('a response with a different request or selection cannot settle a wait', () => {
  const current = startRemoteRequest(intentB);
  const response = responsesBThenA[0];
  expect(settleRemoteRequest(current, { ...response, intent: { ...intentA, requestId: intentB.requestId } })).toBe(current);
  expect(settleRemoteRequest(current, { ...response, intent: { ...intentB, requestId: 'previous-B' } })).toBe(current);
  expect(settleRemoteRequest(current, { ...cancelB, intent: intentA })).toBe(current);
  expect(remoteUiActions[current.state]).toBe('cancel');
});

test('cancellation exits the wait and ignores late success and error for the same request', () => {
  const current = settleRemoteRequest(startRemoteRequest(intentB), cancelB);
  expect(current).toEqual({ state: 'cancelled', intent: intentB });
  expect(remoteUiActions[current.state]).toBe('retry');
  expect(settleRemoteRequest(current, responsesBThenA[0])).toBe(current);
  expect(settleRemoteRequest(current, { type: 'resolve', intent: intentB, outcome: stateOutcomes.error })).toBe(current);
  const retry = startRemoteRequest({ ...intentB, requestId: 'retry-B' });
  expect(settleRemoteRequest(retry, responsesBThenA[0])).toBe(retry);
});

test.each([
  [stateOutcomes.empty, 'reload'],
  [stateOutcomes.error, 'retry'],
  [stateOutcomes.offline, 'retry'],
  [stateOutcomes.pending, 'sync'],
  [stateOutcomes.conflict, 'review'],
] as const)('an active resolution %j has action %s', (outcome, action) => {
  const intent = outcome.state === 'empty' || outcome.state === 'error' ? listIntent : intentA;
  const current = settleRemoteRequest<LocalIncidentView>(startRemoteRequest(intent), { type: 'resolve', intent, outcome });
  expect(current).toEqual({ ...outcome, intent });
  expect(remoteUiActions[current.state]).toBe(action);
});

test('the public adapter stays loading without an active outcome and preserves active errors', () => {
  expect(reduceRemoteResponses({
    activeRequestId: 'B', responses: [{ requestId: 'A', error: 'timeout' }, { requestId: 'B' }],
  })).toEqual({ state: 'loading' });
  expect(reduceRemoteResponses({
    activeRequestId: 'B', responses: [{ requestId: 'B', error: 'timeout' }, { requestId: 'B', value: 1 }],
  })).toEqual({ state: 'error', error: 'timeout' });
});

test('the injected sink receives only safe technical fields from a nested sensitive fixture', async () => {
  const sink = jest.fn();
  await emitDiagnostic(sensitiveDiagnostic, sink);
  expect(sink).toHaveBeenCalledTimes(1);
  expect(sink).toHaveBeenCalledWith(expectedDiagnostic);
  expect(sensitiveDiagnostic.body.access_token).toBe('synthetic-marker');
});

test('invalid identifiers and status cannot smuggle free text into allowed fields', async () => {
  const sink = jest.fn();
  await emitDiagnostic({ ...expectedDiagnostic, correlationId: '/synthetic/request' }, sink);
  await emitDiagnostic({ ...expectedDiagnostic, status: 'Texto ficticio' } as unknown as DiagnosticEvent, sink);
  await emitDiagnostic({ ...expectedDiagnostic, durationMs: Infinity }, sink);
  expect(sink).not.toHaveBeenCalled();

  const { incidentId: _ignored, ...withoutIncident } = expectedDiagnostic;
  await emitDiagnostic({ ...expectedDiagnostic, incidentId: 'Zona ficticia' }, sink);
  expect(sink).toHaveBeenCalledWith(withoutIncident);
});

test('both synchronous and asynchronous sink failures are isolated', async () => {
  await expect(emitDiagnostic(expectedDiagnostic, () => { throw new Error('sink'); })).resolves.toBeUndefined();
  await expect(emitDiagnostic(expectedDiagnostic, () => Promise.reject(new Error('sink')))).resolves.toBeUndefined();
});
