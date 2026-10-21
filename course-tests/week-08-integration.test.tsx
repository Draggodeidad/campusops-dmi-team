import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createGraph } from '../App';
import type { SessionSecretStore } from '../src/application/session/SessionSecretStore';
import { CampusOpsApp } from '../src/ui/CampusOpsApp';
import { createTemporaryWorkspace } from './fixtures/week-08/temporaryWorkspace';
import { createNodeWorkspace } from './fixtures/week-08/nodeWorkspace';
import { SYNTHETIC_PHOTO } from './fixtures/week-08/scenario';
import { SyncNetwork } from './fixtures/week-08/syncNetwork';
import { startLocalBackend, type LocalBackend } from './fixtures/week-06/localBackend';
import { createDeferred } from './fixtures/week-06/deferred';

jest.mock('../src/api/courseBackend', () => ({ getBackendHealth: jest.fn().mockResolvedValue({ ok: true }) }));
class MemorySecrets implements SessionSecretStore {
  private value: string | null = null;
  async read() { return this.value; }
  async save(value: string) { this.value = value; }
  async clear() { this.value = null; }
}
let backend: LocalBackend;
let fixture: Awaited<ReturnType<typeof createTemporaryWorkspace<ReturnType<typeof createNodeWorkspace>>>>;
let network: SyncNetwork;
let secrets: MemorySecrets;
let sequence: number;
async function graph() {
  return createGraph({ useHttp: true, localWorkspace: await fixture.reopen(), transport: network, secretStore: secrets,
    operationId: () => `w08-integration-${++sequence}`,
    syntheticPhotos: { async prepare() {
      const source = join(fixture.directory, 'temporary-source.svg');
      await writeFile(source, SYNTHETIC_PHOTO);
      return { localUri: pathToFileURL(source).href, mediaType: 'image/svg+xml', byteLength: Buffer.byteLength(SYNTHETIC_PHOTO) };
    } },
  });
}
async function prepared() {
  const app = await graph();
  await app.sessionController.login('technician-1');
  const incident = (await app.getIncidentById.execute('campus-inc-001'))!;
  await app.incidentSync.cache(incident);
  return app;
}
async function remoteAction(body: unknown, key: string) {
  const result = await backend.request('/v1/incidents/campus-inc-001/actions', { method: 'POST', actorId: 'coordinator-1', accessToken: 'course-valid-token', idempotencyKey: key, body });
  expect(result.status).toBe(201);
}
async function remote() {
  const result = await backend.request<{ version: number; status: string; payload: { assignedTechnicianId: string; priority: string; history: { operationId: string }[]; notes: { text: string }[]; evidence: { evidenceId: string }[] } }>('/v1/incidents/campus-inc-001', { actorId: 'coordinator-1', accessToken: 'course-valid-token' });
  return result.body;
}

beforeEach(async () => {
  backend = await startLocalBackend(); fixture = await createTemporaryWorkspace(createNodeWorkspace);
  network = new SyncNetwork(backend.baseUrl); secrets = new MemorySecrets(); sequence = 0;
});
afterEach(async () => { await fixture.cleanup(); await backend.stop(); });

test('composed graph creates offline start/note/photo, reopens the actual resource, and synchronizes with explicit version reformulation', async () => {
  let app = await prepared();
  network.offline = true;
  await app.incidentSync.record('campus-inc-001', { action: 'start' });
  await app.incidentSync.record('campus-inc-001', { action: 'comment', text: 'Nota sintética persistente' });
  await app.incidentSync.record('campus-inc-001', { action: 'add_evidence' });
  const original = await app.localWorkspace.pending.listPending();
  const saved = await app.localWorkspace.getSnapshot('campus-inc-001');
  await unlink(join(fixture.directory, 'temporary-source.svg'));
  app = await graph();
  await app.sessionController.restore();
  const recovered = (await app.incidentSync.recover())[0]!;
  expect(recovered.operations.map(item => item.operation)).toEqual(original);
  expect(recovered.notes[0]?.text).toBe('Nota sintética persistente');
  expect(recovered.photos).toEqual(saved!.photos);
  expect(await readFile(fileURLToPath(recovered.photos[0]!.localUri), 'utf8')).toBe(SYNTHETIC_PHOTO);
  expect(recovered.incident.status).toBe('in_progress');
  expect(recovered.incident.assignedTechnicianId).toBe('technician-1');
  network.offline = false;
  await app.incidentSync.synchronize();
  expect((await remote()).version).toBe(2);
  expect((await app.localWorkspace.pending.listPending()).map(op => op.operationId)).toEqual(original.slice(1).map(op => op.operationId));
  expect((await app.incidentSync.recover())[0]!.operations[0]!.state.state).toBe('conflict');
  const noteReview = await app.incidentSync.inspect('campus-inc-001');
  await app.incidentSync.reformulate('campus-inc-001', original[1]!.operationId, noteReview.incident.version!);
  await app.incidentSync.synchronize();
  expect((await remote()).version).toBe(3);
  const photoReview = await app.incidentSync.inspect('campus-inc-001');
  await app.incidentSync.reformulate('campus-inc-001', original[2]!.operationId, photoReview.incident.version!);
  await app.incidentSync.synchronize();
  const final = await remote();
  expect(final.version).toBe(4); expect(final.payload.history).toHaveLength(3);
  expect(final.payload.notes).toEqual([{ actorId: 'technician-1', text: 'Nota sintética persistente' }]);
  expect(final.payload.evidence[0]?.evidenceId).toBe(original[2]!.payload.evidenceId);
  // Unexecuted originals are archived without pretending that the server confirmed them.
  const retained = await app.localWorkspace.pending.listPending();
  expect(retained).toEqual(original.slice(1));
  expect((await app.incidentSync.recover())[0]!.operations.every(item => item.state.state === 'superseded')).toBe(true);
  expect(network.writes.filter(write => write.headers?.['idempotency-key'] === original[1]!.operationId)
    .every(write => JSON.parse(write.body!).baseVersion === 1)).toBe(true);
});

test('timeout_after_commit, resource reopen and exact replay produce one history effect and only then acknowledge', async () => {
  let app = await prepared();
  await app.incidentSync.record('campus-inc-001', { action: 'start' });
  const [operation] = await app.localWorkspace.pending.listPending();
  network.loseNextCommit = true; network.disconnectAfterTimeout = true;
  await app.incidentSync.synchronize();
  expect(await app.localWorkspace.pending.listPending()).toEqual([operation]);
  expect((await remote()).payload.history).toHaveLength(1);
  expect((await app.incidentSync.recover())[0]!.operations[0]!.state.state).toBe('retry');
  app = await graph(); network.offline = false;
  await app.sessionController.restore();
  await app.incidentSync.synchronize();
  expect(await app.localWorkspace.pending.listPending()).toEqual([]);
  expect((await remote()).payload.history).toHaveLength(1);
  const requests = network.writes.filter(item => item.headers?.['idempotency-key'] === operation!.operationId);
  expect(requests).toHaveLength(3); // initial timeout, bounded disconnected attempt, confirmed replay
  expect(new Set(requests.map(item => item.body)).size).toBe(1);
  expect(new Set(requests.map(item => item.headers?.['x-course-actor']))).toEqual(new Set(['technician-1']));
});

test('one bounded immediate retry can confirm a lost response without duplicating the effect', async () => {
  const app = await prepared(); await app.incidentSync.record('campus-inc-001', { action: 'start' });
  network.loseNextCommit = true;
  await Promise.all([app.incidentSync.synchronize(), app.incidentSync.synchronize()]);
  expect(network.writes).toHaveLength(2);
  expect(await app.localWorkspace.pending.listPending()).toEqual([]);
  expect((await remote()).payload.history).toHaveLength(1);
});

test('remote reassignment denies the former technician, preserves every intention and permits informed coordinator resolution without replay', async () => {
  const app = await prepared(); network.offline = true;
  await app.incidentSync.record('campus-inc-001', { action: 'start' });
  await app.incidentSync.record('campus-inc-001', { action: 'comment', text: 'Trabajo original sin perder' });
  await app.incidentSync.record('campus-inc-001', { action: 'add_evidence' });
  const pending = await app.localWorkspace.pending.listPending();
  const before = await app.localWorkspace.getSnapshot('campus-inc-001');
  await remoteAction({ action: 'assign', baseVersion: 1, technicianId: 'technician-2' }, 'w08-remote-reassign');
  network.offline = false;
  await app.incidentSync.synchronize();
  expect((await app.incidentSync.recover())[0]!.operations[0]!.state.state).toBe('forbidden');
  await expect(app.incidentSync.inspect('campus-inc-001')).rejects.toMatchObject({ code: 'UNAUTHORIZED_ACTION' });
  await app.sessionController.logout(); await app.sessionController.login('coordinator-1');
  expect(await app.incidentSync.recover()).toEqual([]);
  const review = await app.incidentSync.inspect('campus-inc-001');
  expect(review).toMatchObject({ fields: ['work'], originalStatus: 'in_progress', incident: { assignedTechnicianId: 'technician-2', status: 'assigned', version: 2 } });
  await expect(app.incidentSync.keepRemote('campus-inc-001', 1)).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
  expect(await app.localWorkspace.pending.listPending()).toEqual(pending);
  await app.incidentSync.keepRemote('campus-inc-001', 2);
  await app.incidentSync.synchronize();
  expect(network.writes).toHaveLength(0);
  expect(await app.localWorkspace.pending.listPending()).toEqual(pending);
  const after = await app.localWorkspace.getSnapshot('campus-inc-001');
  expect(after).toMatchObject({ base: before!.base, local: before!.local, notes: before!.notes, photos: before!.photos });
  expect(after!.resolutions).toHaveLength(3);
  expect(after!.remote!.fields.work).toEqual({ assignedTechnicianId: 'technician-2', status: 'assigned' });
  expect((await remote()).payload.assignedTechnicianId).toBe('technician-2');
  const reopened = await graph(); await reopened.sessionController.restore();
  expect((await reopened.localWorkspace.getSnapshot('campus-inc-001'))!.resolutions).toEqual(after!.resolutions);
});

test.each([403, 409])('HTTP %s preserves the queued body and never triggers a retry or acknowledge', async status => {
  const app = await prepared(); await app.incidentSync.record('campus-inc-001', { action: 'start' });
  const pending = await app.localWorkspace.pending.listPending();
  network.rejectWrite = status;
  await app.incidentSync.synchronize();
  expect(await app.localWorkspace.pending.listPending()).toEqual(pending);
  expect(network.writes).toHaveLength(1);
  expect((await app.incidentSync.recover())[0]!.operations[0]!.state.state).toBe(status === 403 ? 'forbidden' : 'conflict');
  expect((await remote()).version).toBe(1);
});

test('a forged successful receipt is not an acknowledgement, even when the backend applied the change', async () => {
  const app = await prepared(); await app.incidentSync.record('campus-inc-001', { action: 'start' });
  const pending = await app.localWorkspace.pending.listPending();
  network.corruptReceipt = true; await app.incidentSync.synchronize();
  expect(await app.localWorkspace.pending.listPending()).toEqual(pending);
  network.corruptReceipt = false; await app.incidentSync.synchronize();
  expect(await app.localWorkspace.pending.listPending()).toEqual([]);
  expect((await remote()).payload.history).toHaveLength(1);
});

test('storage rollback preserves snapshot/queue and an acknowledge failure recovers by exact replay', async () => {
  let app = await prepared();
  const before = await app.localWorkspace.getSnapshot('campus-inc-001');
  fixture.failNext('change.afterSnapshot');
  await expect(app.incidentSync.record('campus-inc-001', { action: 'comment', text: 'No debe quedar parcialmente' })).rejects.toMatchObject({ code: 'LOCAL_STORAGE_UNAVAILABLE' });
  expect(await app.localWorkspace.getSnapshot('campus-inc-001')).toEqual(before);
  expect(await app.localWorkspace.pending.listPending()).toEqual([]);
  await app.incidentSync.record('campus-inc-001', { action: 'start' });
  const pending = await app.localWorkspace.pending.listPending();
  fixture.failNext('acknowledge.afterDelete');
  await expect(app.incidentSync.synchronize()).rejects.toMatchObject({ code: 'LOCAL_STORAGE_UNAVAILABLE' });
  expect(await app.localWorkspace.pending.listPending()).toEqual(pending);
  app = await graph(); await app.sessionController.restore(); await app.incidentSync.synchronize();
  expect(await app.localWorkspace.pending.listPending()).toEqual([]);
  expect((await remote()).payload.history).toHaveLength(1);
});

test('changing account during a remote read prevents replay and hides the original local cache', async () => {
  const app = await prepared(); await app.incidentSync.record('campus-inc-001', { action: 'start' });
  const pending = await app.localWorkspace.pending.listPending();
  const blocked = createDeferred<void>(); const entered = createDeferred<void>();
  network.afterRead = async () => { entered.resolve(); await blocked.promise; };
  const sync = app.incidentSync.synchronize(); const observed = expect(sync).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
  await entered.promise; await app.sessionController.logout(); await app.sessionController.login('reporter-1');
  blocked.resolve(); await observed; network.afterRead = undefined;
  expect(network.writes).toHaveLength(0);
  expect(await app.incidentSync.recover()).toEqual([]);
  await expect(app.incidentSync.record('campus-inc-001', { action: 'comment', text: 'Otra cuenta' })).rejects.toMatchObject({ code: 'UNAUTHORIZED_ACTION' });
  await app.incidentSync.synchronize(); expect(network.writes).toHaveLength(0);
  expect(await app.localWorkspace.pending.listPending()).toEqual(pending);
});

test('compatible remote priority is merged, while stale operations require a new explicit identity', async () => {
  const app = await prepared(); await app.incidentSync.record('campus-inc-001', { action: 'start' });
  const original = (await app.localWorkspace.pending.listPending())[0]!;
  await remoteAction({ action: 'prioritize', baseVersion: 1, priority: 'high' }, 'w08-priority-independent');
  await app.incidentSync.synchronize();
  expect((await app.localWorkspace.getSnapshot('campus-inc-001'))!.local.fields.priority).toBe('high');
  const review = await app.incidentSync.inspect('campus-inc-001');
  expect(review.fields).toEqual([]);
  await expect(app.incidentSync.reformulate('campus-inc-001', original.operationId, 1)).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
  const view = await app.incidentSync.reformulate('campus-inc-001', original.operationId, 2);
  const replacement = view.operations.find(item => item.operation.operationId !== original.operationId)!.operation;
  expect(replacement).toMatchObject({ baseVersion: 2, actorId: original.actorId, payload: original.payload });
  expect(replacement.operationId).not.toBe(original.operationId);
  await app.incidentSync.synchronize();
  expect((await remote()).payload.priority).toBe('high');
  expect((await remote()).status).toBe('in_progress');
  expect(await app.localWorkspace.pending.listPending()).toEqual([original]);
});

test('real UI stores offline changes, restores them after remount and clears private views on account change', async () => {
  let app = await graph();
  let view = await render(<CampusOpsApp {...app} />);
  await waitFor(() => expect(view.getByTestId('login-technician')).toBeTruthy());
  await act(async () => { await fireEvent.press(view.getByTestId('login-technician')); });
  await waitFor(() => expect(view.getByTestId('incident-campus-inc-001')).toBeTruthy());
  await act(async () => { await fireEvent.press(view.getByTestId('incident-campus-inc-001')); });
  await waitFor(() => expect(view.getByTestId('local-start')).toBeTruthy());
  network.offline = true;
  await act(async () => { await fireEvent.press(view.getByTestId('action-start')); });
  await waitFor(() => expect(view.getByText('start: Sin confirmación; reintenta con la sesión original')).toBeTruthy());
  await act(async () => { await fireEvent.changeText(view.getByTestId('local-note-input'), 'Nota desde interfaz'); });
  await act(async () => { await fireEvent.press(view.getByTestId('local-note')); });
  await waitFor(() => expect(view.getByText('Nota guardada: Nota desde interfaz')).toBeTruthy());
  await act(async () => { await fireEvent.press(view.getByTestId('local-photo')); });
  await waitFor(() => expect(view.getByText('add_evidence: Pendiente de sincronizar')).toBeTruthy());
  await act(async () => { await view.unmount(); });
  app = await graph();
  view = await render(<CampusOpsApp {...app} />);
  await waitFor(() => expect(view.getByTestId('recover-campus-inc-001')).toBeTruthy());
  await act(async () => { await fireEvent.press(view.getByTestId('recover-campus-inc-001')); });
  await waitFor(() => expect(view.getByText('Nota guardada: Nota desde interfaz')).toBeTruthy());
  network.offline = false;
  await act(async () => { await fireEvent.press(view.getByTestId('sync-pending')); });
  await waitFor(() => expect(view.getByText('comment: Conflicto: requiere revisión')).toBeTruthy());
  await act(async () => { await fireEvent.press(view.getByTestId('inspect-conflict')); });
  await waitFor(() => expect(view.getByTestId('reformulate-w08-integration-2')).toBeTruthy());
  await act(async () => { await fireEvent.press(view.getByTestId('reformulate-w08-integration-2')); });
  await act(async () => { await fireEvent.press(view.getByTestId('sync-pending')); });
  await waitFor(() => expect(view.getByText('add_evidence: Conflicto: requiere revisión')).toBeTruthy());
  await act(async () => { await fireEvent.press(view.getByTestId('inspect-conflict')); });
  await waitFor(() => expect(view.getByTestId('reformulate-w08-integration-3')).toBeTruthy());
  await act(async () => { await fireEvent.press(view.getByTestId('reformulate-w08-integration-3')); });
  await act(async () => { await fireEvent.press(view.getByTestId('sync-pending')); });
  await waitFor(() => expect(view.getByText('Estado: in_progress')).toBeTruthy());
  expect((await remote()).payload.history).toHaveLength(3);
  await act(async () => { await fireEvent.press(view.getByTestId('logout-button')); });
  await waitFor(() => expect(view.getByTestId('login-reporter')).toBeTruthy());
  expect(view.queryByText('Nota guardada: Nota desde interfaz')).toBeNull();
  await act(async () => { await fireEvent.press(view.getByTestId('login-reporter')); });
  await waitFor(() => expect(view.getByTestId('incident-campus-inc-001')).toBeTruthy());
  expect(view.queryByTestId('recover-campus-inc-001')).toBeNull();
  expect(await app.localWorkspace.pending.listPending()).toHaveLength(2);
});


test('coordinator UI explains both versions and explicitly preserves the new assignment without clearing the original queue', async () => {
  const app = await prepared(); await app.incidentSync.record('campus-inc-001', { action: 'start' });
  const pending = await app.localWorkspace.pending.listPending();
  await remoteAction({ action: 'assign', baseVersion: 1, technicianId: 'technician-2' }, 'w08-ui-reassignment');
  await app.incidentSync.synchronize();
  await app.sessionController.logout();
  const view = await render(<CampusOpsApp {...app} />);
  await waitFor(() => expect(view.getByTestId('login-coordinator')).toBeTruthy());
  await act(async () => { await fireEvent.press(view.getByTestId('login-coordinator')); });
  await waitFor(() => expect(view.getByTestId('incident-campus-inc-001')).toBeTruthy());
  await act(async () => { await fireEvent.press(view.getByTestId('incident-campus-inc-001')); });
  await waitFor(() => expect(view.getByTestId('inspect-conflict')).toBeTruthy());
  await act(async () => { await fireEvent.press(view.getByTestId('inspect-conflict')); });
  await waitFor(() => expect(view.getByText('Intención local: in_progress. Estado remoto: assigned.')).toBeTruthy());
  expect(view.getByText('Asignación remota: technician-2. Versión: 2.')).toBeTruthy();
  await act(async () => { await fireEvent.press(view.getByTestId('keep-remote')); });
  await waitFor(() => expect(view.queryByTestId('conflict-review')).toBeNull());
  expect(await app.localWorkspace.pending.listPending()).toEqual(pending);
  expect((await app.localWorkspace.getSnapshot('campus-inc-001'))!.resolutions![0]).toMatchObject({ decision: 'keep_remote', actorId: 'coordinator-1' });
  expect((await remote()).payload.assignedTechnicianId).toBe('technician-2');
});


test('the original action use case persists before sending and never sends after a local transaction failure', async () => {
  const app = await prepared(); fixture.failNext('change.afterSnapshot');
  await expect(app.performIncidentAction.execute({ incidentId: 'campus-inc-001', action: 'start', baseVersion: 1, actorRole: 'technician' }))
    .rejects.toMatchObject({ code: 'LOCAL_STORAGE_UNAVAILABLE' });
  expect(network.writes).toHaveLength(0);
  expect(await app.localWorkspace.pending.listPending()).toEqual([]);
  expect((await remote()).version).toBe(1);
});

test('caller-provided start identity survives pending replay and confirmed replay, rejecting changed content', async () => {
  const app = await prepared(); network.offline = true;
  const input = { incidentId: 'campus-inc-001', action: 'start' as const, baseVersion: 1, actorRole: 'technician' as const, idempotencyKey: 'w08-caller-stable-start' };
  await app.performIncidentAction.execute(input);
  expect((await app.localWorkspace.pending.listPending())[0]!.operationId).toBe(input.idempotencyKey);
  network.offline = false;
  await app.performIncidentAction.execute(input);
  await app.performIncidentAction.execute(input);
  expect(await app.localWorkspace.pending.listPending()).toEqual([]);
  expect((await remote()).payload.history).toHaveLength(1);
  await expect(app.performIncidentAction.execute({ ...input, baseVersion: 2 })).rejects.toMatchObject({ code: 'INVALID_INCIDENT_INPUT' });
  expect((await remote()).version).toBe(2);
});

test('confirming an old lost receipt does not roll back a newer remote state already read by the graph', async () => {
  const app = await prepared(); await app.incidentSync.record('campus-inc-001', { action: 'start' });
  network.loseNextCommit = true; network.disconnectAfterTimeout = true;
  await app.incidentSync.synchronize();
  await remoteAction({ action: 'prioritize', baseVersion: 2, priority: 'high' }, 'w08-after-lost-response');
  network.offline = false;
  await app.incidentSync.synchronize();
  const snapshot = (await app.localWorkspace.getSnapshot('campus-inc-001'))!;
  expect(snapshot.base.version).toBe(3);
  expect(snapshot.local.fields.priority).toBe('high');
  expect(await app.localWorkspace.pending.listPending()).toEqual([]);
  expect((await remote()).payload.history).toHaveLength(2);
});
