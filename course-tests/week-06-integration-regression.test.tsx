import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { createGraph } from '../App';
import { ApplicationFailure } from '../src/application/errors/ApplicationFailure';
import { DefaultSessionController } from '../src/application/session/DefaultSessionController';
import type { SessionSecretStore } from '../src/application/session/SessionSecretStore';
import { coordinateRefresh } from '../src/course-evaluation';
import { SessionTransportDecorator } from '../src/infrastructure/http/SessionTransportDecorator';
import type { IncidentTransport } from '../src/infrastructure/http/IncidentTransport';
import { CampusOpsApp } from '../src/ui/CampusOpsApp';
import { createDeferred } from './fixtures/week-06/deferred';
import { startLocalBackend, type LocalBackend } from './fixtures/week-06/localBackend';

jest.mock('../src/api/courseBackend', () => ({ getBackendHealth: jest.fn().mockResolvedValue({ ok: true }) }));

class MemoryStore implements SessionSecretStore {
  stored: string | null = null;
  failClear = false;
  async read() { return this.stored; }
  async save(value: string) { this.stored = value; }
  async clear() {
    if (this.failClear) throw new ApplicationFailure('SECURE_STORAGE_UNAVAILABLE', 'No fue posible borrar la sesión de forma segura.');
    this.stored = null;
  }
}

let backend: LocalBackend;
beforeAll(async () => { backend = await startLocalBackend(); });
afterAll(async () => { await backend.stop(); });

function localTransport(): IncidentTransport {
  return {
    async send(request) {
      const headers = request.headers ?? {};
      const response = await backend.request(request.path, {
        method: request.method,
        ...(headers.authorization ? { accessToken: headers.authorization.replace(/^Bearer /, '') } : {}),
        ...(headers['x-course-actor'] ? { actorId: headers['x-course-actor'] } : {}),
        ...(headers['idempotency-key'] ? { idempotencyKey: headers['idempotency-key'] } : {}),
        ...(request.body ? { body: JSON.parse(request.body) as unknown } : {}),
      });
      return { status: response.status, headers: {}, bodyText: JSON.stringify(response.body) };
    },
  };
}

test('real composition and UI use the current actor, successive versions, and hide incidents after logout', async () => {
  const store = new MemoryStore();
  const graph = createGraph({ useHttp: true, transport: localTransport(), secretStore: store });
  const view = await render(<CampusOpsApp {...graph} />);
  await waitFor(() => expect(view.getByTestId('login-technician')).toBeTruthy());
  expect(view.queryByTestId('incident-campus-inc-001')).toBeNull();
  await fireEvent.press(view.getByTestId('login-technician'));
  await waitFor(() => expect(view.getByTestId('incident-campus-inc-001')).toBeTruthy());
  await fireEvent.press(view.getByTestId('incident-campus-inc-001'));
  await waitFor(() => expect(view.getByTestId('action-start')).toBeTruthy());
  await fireEvent.press(view.getByTestId('action-start'));
  await waitFor(() => expect(view.getByTestId('action-resolve')).toBeTruthy());
  await fireEvent.press(view.getByTestId('action-resolve'));
  await waitFor(() => expect(view.getByText('Estado: resolved')).toBeTruthy());
  expect((await graph.repository.findById('campus-inc-001'))?.version).toBe(3);

  await fireEvent.press(view.getByTestId('logout-button'));
  await waitFor(() => expect(view.getByTestId('login-coordinator')).toBeTruthy());
  expect(view.queryByTestId('incident-detail')).toBeNull();
  expect(store.stored).toBeNull();
  await fireEvent.press(view.getByTestId('login-coordinator'));
  await waitFor(() => expect(view.getByTestId('incident-campus-inc-001')).toBeTruthy());
  await fireEvent.press(view.getByTestId('incident-campus-inc-001'));
  await waitFor(() => expect(view.getByTestId('action-close')).toBeTruthy());
  await fireEvent.press(view.getByTestId('action-close'));
  await waitFor(() => expect(view.getByText('Estado: closed')).toBeTruthy());
  await fireEvent.press(view.getByTestId('action-reopen'));
  await waitFor(() => expect(view.getByText('Estado: assigned')).toBeTruthy());
  expect((await graph.repository.findById('campus-inc-001'))?.version).toBe(5);

  await fireEvent.press(view.getByTestId('logout-button'));
  await waitFor(() => expect(view.getByTestId('login-reporter')).toBeTruthy());
  await fireEvent.press(view.getByTestId('login-reporter'));
  await waitFor(() => expect(view.getByTestId('incident-campus-inc-001')).toBeTruthy());
  const before = await graph.repository.findById('campus-inc-001');
  await expect(graph.performIncidentAction.execute({ incidentId: 'campus-inc-001', action: 'resolve', baseVersion: before!.version!, diagnosis: 'Synthetic rejected action' })).rejects.toMatchObject({ code: 'UNAUTHORIZED_ACTION' });
  expect((await graph.repository.findById('campus-inc-001'))?.version).toBe(before?.version);
});

test('session UI restores at startup and exposes deletion failure without keeping private views', async () => {
  const store = new MemoryStore();
  const graph = createGraph({ useHttp: true, transport: localTransport(), secretStore: store });
  await graph.sessionController.login('reporter-1');
  const restoredGraph = createGraph({ useHttp: true, transport: localTransport(), secretStore: store });
  const view = await render(<CampusOpsApp {...restoredGraph} />);
  await waitFor(() => expect(view.getByTestId('incident-campus-inc-001')).toBeTruthy());
  expect(restoredGraph.sessionController.getSnapshot().actorId).toBe('reporter-1');
  store.failClear = true;
  await fireEvent.press(view.getByTestId('logout-button'));
  await waitFor(() => expect(view.getByText('No fue posible borrar la sesión de forma segura.')).toBeTruthy());
  expect(view.queryByTestId('incident-campus-inc-001')).toBeNull();
  expect(store.stored).not.toBeNull();
  store.failClear = false;
  await fireEvent.press(view.getByTestId('retry-session-cleanup'));
  await waitFor(() => expect(view.queryByTestId('session-error')).toBeNull());
  expect(store.stored).toBeNull();
});

test('login error is visible and expired refresh failure returns to login with a cleared store', async () => {
  const store = new MemoryStore();
  let now = 0;
  let failLogin = true;
  const network = localTransport();
  const graph = createGraph({ useHttp: true, secretStore: store, clock: { now: () => now }, transport: {
    send: async (request) => {
      if (request.path.endsWith('/login') && failLogin) throw new Error('synthetic-private-provider-error');
      if (request.path.endsWith('/refresh')) return { status: 401, headers: {}, bodyText: '{}' };
      return network.send(request);
    },
  } });
  const view = await render(<CampusOpsApp {...graph} />);
  await waitFor(() => expect(view.getByTestId('login-reporter')).toBeTruthy());
  await fireEvent.press(view.getByTestId('login-reporter'));
  await waitFor(() => expect(view.getByText('Falla de comunicación al intentar iniciar sesión.')).toBeTruthy());
  expect(JSON.stringify(view.toJSON())).not.toContain('synthetic-private-provider-error');
  failLogin = false;
  await fireEvent.press(view.getByTestId('login-reporter'));
  await waitFor(() => expect(view.getByTestId('incident-campus-inc-001')).toBeTruthy());
  now = 60000;
  await act(async () => { graph.sessionController.getSnapshot(); });
  await fireEvent.press(view.getByTestId('refresh-session'));
  await waitFor(() => expect(view.getByTestId('login-reporter')).toBeTruthy());
  expect(view.queryByTestId('incident-campus-inc-001')).toBeNull();
  expect(store.stored).toBeNull();
});

test('shared generation policy rejects obsolete success/failure and repeated request replay', () => {
  const summary = coordinateRefresh([
    { type: 'request401', requestId: 'old', generation: 0 },
    { type: 'logout' },
    { type: 'request401', requestId: 'current', generation: 1 },
    { type: 'refreshSucceeded', generation: 1, token: 'synthetic-obsolete' },
    { type: 'refreshFailed', generation: 0 },
    { type: 'refreshSucceeded', generation: 2, token: 'synthetic-current' },
    { type: 'request401', requestId: 'current', generation: 2 },
  ]);
  expect(summary).toMatchObject({ status: 'authenticated', activeGeneration: 2, refreshCalls: 2, retriedRequestIds: ['current'], persistedToken: 'synthetic-current' });
});

test('logout during a held storage write is followed by deletion, never by stale authentication', async () => {
  const saveStarted = createDeferred<void>();
  const finishSave = createDeferred<void>();
  let stored: string | null = null;
  const store: SessionSecretStore = {
    read: async () => stored,
    save: async (record) => { saveStarted.resolve(); await finishSave.promise; stored = record; },
    clear: async () => { stored = null; },
  };
  const controller = new DefaultSessionController({
    login: async (actorId) => ({ actorId, role: 'reporter', accessToken: 'synthetic-access', refreshToken: 'synthetic-refresh', expiresIn: 60 }),
    refresh: async () => { throw new Error('unused'); },
  }, store, { now: () => 0 });
  const login = controller.login('reporter-1');
  await saveStarted.promise;
  const logout = controller.logout();
  finishSave.resolve();
  await Promise.all([login, logout]);
  expect(stored).toBeNull();
  expect(controller.getSnapshot()).toMatchObject({ state: 'anonymous', actorId: null });
});


test('expired session rejected immediately after renewal is invalidated without a second refresh', async () => {
  let now = 0;
  let refreshes = 0;
  let requests = 0;
  const controller = new DefaultSessionController({
    login: async (actorId) => ({ actorId, role: 'reporter', accessToken: 'synthetic-first', refreshToken: 'synthetic-refresh', expiresIn: 60 }),
    refresh: async () => { refreshes++; return { accessToken: 'synthetic-next', refreshToken: 'synthetic-next-refresh', expiresIn: 60 }; },
  }, new MemoryStore(), { now: () => now });
  await controller.login('reporter-1');
  now = 60000;
  const transport = new SessionTransportDecorator({ send: async () => { requests++; return { status: 401, headers: {}, bodyText: '{}' }; } }, controller);
  expect((await transport.send({ method: 'GET', path: '/v1/incidents' })).status).toBe(401);
  expect(refreshes).toBe(1);
  expect(requests).toBe(1);
  expect(controller.getSnapshot().state).toBe('anonymous');
});

test('an obsolete failed refresh cannot delete the new login record', async () => {
  const refresh = createDeferred<{ accessToken: string; refreshToken: string; expiresIn: number }>();
  const started = createDeferred<void>();
  const store = new MemoryStore();
  const controller = new DefaultSessionController({
    login: async (actorId) => ({ actorId, role: 'reporter', accessToken: 'synthetic-access', refreshToken: 'synthetic-refresh', expiresIn: 60 }),
    refresh: async () => { started.resolve(); return refresh.promise; },
  }, store, { now: () => 0 });
  await controller.login('reporter-1');
  const oldRefresh = controller.refresh();
  await started.promise;
  await controller.login('reporter-2');
  const newRecord = store.stored;
  refresh.reject(new Error('synthetic old refresh failure'));
  await expect(oldRefresh).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
  expect(store.stored).toBe(newRecord);
  expect(controller.getSnapshot()).toMatchObject({ state: 'authenticated', actorId: 'reporter-2' });
});

test('a delayed concurrent 401 reuses an already renewed token and preserves POST identity', async () => {
  let refreshes = 0;
  const controller = new DefaultSessionController({
    login: async (actorId) => ({ actorId, role: 'reporter', accessToken: 'synthetic-first', refreshToken: 'synthetic-refresh', expiresIn: 60 }),
    refresh: async () => { refreshes++; return { accessToken: 'synthetic-next', refreshToken: 'synthetic-next-refresh', expiresIn: 60 }; },
  }, new MemoryStore(), { now: () => 0 });
  await controller.login('reporter-1');
  const release = createDeferred<void>();
  const seen: { id: string; body: string | undefined; key: string | undefined }[] = [];
  const transport = new SessionTransportDecorator({ send: async (request) => {
    const id = request.headers!['x-request-id']!;
    seen.push({ id, body: request.body, key: request.headers!['idempotency-key'] });
    if (request.headers!.authorization === 'Bearer synthetic-first') {
      if (id === 'B') await release.promise;
      return { status: 401, headers: {}, bodyText: '{}' };
    }
    return { status: 200, headers: {}, bodyText: '{}' };
  } }, controller);
  const a = transport.send({ method: 'POST', path: '/v1/incidents', body: '{}', headers: { 'x-request-id': 'A', 'idempotency-key': 'synthetic-A' } });
  const b = transport.send({ method: 'POST', path: '/v1/incidents', body: '{}', headers: { 'x-request-id': 'B', 'idempotency-key': 'synthetic-B' } });
  expect((await a).status).toBe(200);
  release.resolve();
  expect((await b).status).toBe(200);
  expect(refreshes).toBe(1);
  for (const id of ['A', 'B']) {
    expect(seen.filter((entry) => entry.id === id)).toEqual([
      { id, body: '{}', key: `synthetic-${id}` },
      { id, body: '{}', key: `synthetic-${id}` },
    ]);
  }
});
