import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { createGraph } from '../App';
import { emitDiagnostic } from '../src/application/telemetry/emitDiagnostic';
import type { DiagnosticEvent } from '../src/application/telemetry/emitDiagnostic';
import { redactForTelemetry } from '../src/course-evaluation';
import { CampusOpsApp } from '../src/ui/CampusOpsApp';
import { startLocalBackend, type LocalBackend } from './fixtures/week-06/localBackend';
import { createNodeWorkspace } from './fixtures/week-08/nodeWorkspace';
import { SyncNetwork } from './fixtures/week-08/syncNetwork';
import { createTemporaryWorkspace } from './fixtures/week-08/temporaryWorkspace';
import { expectedDiagnostic, sensitiveDiagnostic } from './fixtures/week-10';

jest.mock('../src/api/courseBackend', () => ({ getBackendHealth: jest.fn().mockResolvedValue({ ok: true }) }));

let backend: LocalBackend;
let fixture: Awaited<ReturnType<typeof createTemporaryWorkspace<ReturnType<typeof createNodeWorkspace>>>>;
let network: SyncNetwork;
let events: DiagnosticEvent[];
const incidentId = 'campus-inc-001';
const sensitiveMarker = 'marcador sintético privado';

beforeEach(async () => {
  backend = await startLocalBackend();
  fixture = await createTemporaryWorkspace(createNodeWorkspace);
  network = new SyncNetwork(backend.baseUrl);
  events = [];
});
afterEach(async () => { await fixture.cleanup(); await backend.stop(); });

async function graph(onEvent?: () => void | Promise<void>, corruptList = false) {
  let secret: string | null = null;
  let now = 0;
  const app = createGraph({
    useHttp: true,
    localWorkspace: await fixture.reopen(),
    operationId: () => 'synthetic-durable-w10',
    secretStore: {
      async read() { return secret; },
      async save(value) { secret = value; },
      async clear() { secret = null; },
    },
    retryClock: { now: () => now, async sleep(ms) { now += ms; } },
    diagnosticSink: event => { events.push(event); return onEvent?.(); },
    transport: { async send(request) {
      const result = await network.send(request);
      if (corruptList && request.path === '/v1/incidents') {
        corruptList = false;
        return { ...result, bodyText: JSON.stringify({ message: sensitiveMarker }) };
      }
      return result;
    } },
  });
  await app.sessionController.login('technician-1');
  expect(events).toEqual([]);
  return app;
}

async function openAssignedIncident() {
  await fireEvent.press(await screen.findByRole('button', { name: /Sin conexión en laboratorio ficticio/ }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Iniciar atención' })).toBeEnabled());
}

function expectFlow(actual: readonly DiagnosticEvent[], statuses: DiagnosticEvent['status'][]) {
  expect(actual.map(event => event.status)).toEqual(statuses);
  const id = actual[0]?.correlationId;
  expect(id).toMatch(/^w10-request-[1-9]\d*$/);
  expect(actual.every(event => event.correlationId === id)).toBe(true);
  for (const event of actual) {
    expect(Object.keys(event).sort()).toEqual([
      'attempt', 'correlationId', 'durationMs', ...(event.incidentId ? ['incidentId'] : []), 'status',
    ]);
    expect(event.durationMs).toBeGreaterThanOrEqual(0);
  }
  return id;
}

test('W04 recursively redacts nested arrays without mutation and W10 excludes the entire raw context', async () => {
  const nested = { trace: [sensitiveDiagnostic.body, [{ 'Display-Name': sensitiveMarker, attempt: 2 }]] };
  const original = structuredClone(nested);
  expect(redactForTelemetry(nested)).toEqual({
    trace: [{
      access_token: '[REDACTED]',
      nested: [{ location: '[REDACTED]', photos: '[REDACTED]', internalComments: '[REDACTED]' }],
      description: 'Texto libre ficticio',
    }, [{ 'Display-Name': '[REDACTED]', attempt: 2 }]],
  });
  expect(nested).toEqual(original);
  const sink = jest.fn();
  const rawEvent = { ...sensitiveDiagnostic, ...nested, headers: { authorization: sensitiveMarker } };
  await emitDiagnostic(rawEvent, sink);
  expect(sink).toHaveBeenCalledWith(expectedDiagnostic);
  expect(nested).toEqual(original);
});

test('a real 200 with an invalid body and its recoverable UI error share an ID, manual retry gets a new one', async () => {
  const app = await graph(undefined, true);
  await render(<CampusOpsApp {...app} />);
  expect(await screen.findByRole('alert', { name: 'El servidor devolvió datos inválidos.' })).toBeOnTheScreen();
  const original = expectFlow(events, [200, 'error']);
  expect(JSON.stringify(events)).not.toContain(sensitiveMarker);
  events.length = 0;
  await fireEvent.press(screen.getByRole('button', { name: 'Reintentar lista' }));
  expect(await screen.findByRole('button', { name: /Sin conexión en laboratorio ficticio/ })).toBeOnTheScreen();
  expect(expectFlow(events, [200, 'success'])).not.toBe(original);
});

test.each(['throws', 'rejects', 'never settles'])('a sink that %s cannot prevent timeout replay or UI confirmation', async failure => {
  const app = await graph(() => {
    if (failure === 'throws') throw new Error(sensitiveMarker);
    if (failure === 'rejects') return Promise.reject(new Error(sensitiveMarker));
    return new Promise<void>(() => {});
  });
  await render(<CampusOpsApp {...app} />);
  await openAssignedIncident();
  const detail = events.find(event => event.incidentId === incidentId && event.status === 'success')?.correlationId;
  events.length = 0;
  network.loseNextCommit = true;
  await fireEvent.press(screen.getByRole('button', { name: 'Iniciar atención' }));
  expect(await screen.findByRole('button', { name: 'Resolver incidencia' })).toBeEnabled();
  const action = events.filter(event => event.incidentId === incidentId);
  expect(expectFlow(action, [200, 'timeout', 200, 'success', 'success'])).not.toBe(detail);
  expect(action.map(event => event.attempt)).toEqual([1, 1, 2, 1, 1]);
  expect(network.writes).toHaveLength(2);
  expect(network.writes[1]?.body).toBe(network.writes[0]?.body);
  expect(network.writes[1]?.headers).toEqual(network.writes[0]?.headers);
  expect(JSON.stringify(network.writes[0]?.headers)).not.toContain(action[0]!.correlationId);
  expect(await app.localWorkspace.pending.listPending()).toEqual([]);
  const remote = await backend.request<{ payload: { history: unknown[] } }>(`/v1/incidents/${incidentId}`, {
    actorId: 'technician-1', accessToken: 'course-valid-token',
  });
  expect(remote.body.payload.history).toHaveLength(1);
});

test('offline attention stays pending and a new manual sync links HTTP 409 to a durable conflict', async () => {
  const app = await graph();
  await render(<CampusOpsApp {...app} />);
  await openAssignedIncident();
  network.offline = true;
  events.length = 0;
  await fireEvent.press(screen.getByRole('button', { name: 'Iniciar atención' }));
  expect(await screen.findByText('Sin confirmación; reintenta con la sesión original', { exact: false })).toBeOnTheScreen();
  const action = expectFlow(events, ['offline', 'pending', 'pending']);
  const pending = await app.localWorkspace.pending.listPending();
  expect(pending).toHaveLength(1);

  network.offline = false;
  network.rejectWrite = 409;
  events.length = 0;
  await act(async () => { await fireEvent.press(screen.getByTestId('sync-pending')); });
  await waitFor(() => {
    expect(screen.getByText('start: Conflicto: requiere revisión')).toBeOnTheScreen();
    expect(screen.getByTestId('sync-pending')).toBeEnabled();
  });
  const sync = events.filter(event => event.status !== 'offline');
  expect(expectFlow(sync, [200, 409, 'conflict'])).not.toBe(action);
  expect(events.every(event => event.correlationId === sync[0]?.correlationId)).toBe(true);
  expect(await app.localWorkspace.pending.listPending()).toEqual(pending);
});
