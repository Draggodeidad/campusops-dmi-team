import { createGraph } from '../App';
import type { SessionSecretStore } from '../src/application/session/SessionSecretStore';
import type { RetryAttemptMetric } from '../src/infrastructure/http/IncidentRetryExecutor';
import { createTemporaryWorkspace } from './fixtures/week-08/temporaryWorkspace';
import { createNodeWorkspace } from './fixtures/week-08/nodeWorkspace';
import { SYNTHETIC_PHOTO } from './fixtures/week-08/scenario';
import { SyncNetwork } from './fixtures/week-08/syncNetwork';
import { startLocalBackend, type LocalBackend } from './fixtures/week-06/localBackend';
import { createVirtualClock } from './fixtures/week-09/virtualClock';
import { createLostResponseFixture } from './fixtures/week-09/scenario';

class MemorySecrets implements SessionSecretStore {
  value: string | null = null;
  async read() { return this.value; }
  async save(value: string) { this.value = value; }
  async clear() { this.value = null; }
}
let backend: LocalBackend;
let disk: Awaited<ReturnType<typeof createTemporaryWorkspace<ReturnType<typeof createNodeWorkspace>>>>;
let network: SyncNetwork;
let secrets: MemorySecrets;
let sequence: number;
let metrics: RetryAttemptMetric[];
const fixture = createLostResponseFixture();
async function graph() {
  return createGraph({ useHttp: true, transport: network, localWorkspace: await disk.reopen(), secretStore: secrets,
    retryClock: createVirtualClock(), retryObserver: metric => metrics.push(metric), operationId: () => `w09-queued-operation-${++sequence}` });
}
async function prepared() {
  const app = await graph(); await app.sessionController.login('technician-1');
  await app.incidentSync.cache((await app.getIncidentById.execute('campus-inc-001'))!);
  return app;
}
async function remote() {
  return (await backend.request<{ version: number; status: string; payload: {
    history: { operationId: string; action: string }[]; notes: unknown[]; evidence: unknown[];
  } }>('/v1/incidents/campus-inc-001', { actorId: 'coordinator-1', accessToken: 'course-valid-token' })).body;
}
beforeEach(async () => {
  backend = await startLocalBackend(); disk = await createTemporaryWorkspace(createNodeWorkspace); network = new SyncNetwork(backend.baseUrl);
  secrets = new MemorySecrets(); sequence = 0; metrics = [];
});
afterEach(async () => { await disk.cleanup(); await backend.stop(); });

test('lost resolution and closure responses replay with unchanged key/content and one effect per operation', async () => {
  const app = await prepared();
  await app.performIncidentAction.execute({ incidentId: fixture.operation.incidentId, action: 'start', baseVersion: 1, actorRole: 'technician',
    idempotencyKey: fixture.preparation.operationId });
  network.loseNextCommit = true;
  await expect(app.performIncidentAction.execute({ incidentId: fixture.operation.incidentId, action: 'resolve', baseVersion: 2,
    actorRole: 'technician', diagnosis: String(fixture.operation.payload.diagnosis), idempotencyKey: fixture.operation.operationId }))
    .resolves.toMatchObject({ status: 'resolved', version: 3 });
  const resolution = network.writes.filter(write => write.headers?.['idempotency-key'] === fixture.operation.operationId);
  expect(resolution).toHaveLength(2); expect(resolution[0]!.body).toBe(resolution[1]!.body);
  expect(JSON.parse(resolution[0]!.body!)).toEqual(JSON.parse(fixture.request.body));
  await app.sessionController.logout(); await app.sessionController.login(fixture.close.actorId);
  network.loseNextCommit = true;
  await expect(app.performIncidentAction.execute({ incidentId: fixture.operation.incidentId, action: 'close', baseVersion: 3,
    actorRole: 'coordinator', idempotencyKey: fixture.close.operationId })).resolves.toMatchObject({ status: 'closed', version: 4 });
  const closure = network.writes.filter(write => write.headers?.['idempotency-key'] === fixture.close.operationId);
  expect(closure).toHaveLength(2); expect(closure[0]!.body).toBe(closure[1]!.body);
  const final = await remote();
  expect(final.payload.history.filter(entry => entry.operationId === fixture.operation.operationId)).toHaveLength(1);
  expect(final.payload.history.filter(entry => entry.operationId === fixture.close.operationId)).toHaveLength(1);
  expect(final.payload.notes).toEqual([]); expect(final.payload.evidence).toEqual([]);
  expect(metrics.filter(metric => metric.method === 'POST' && metric.status === 'timeout')).toHaveLength(2);
});
test('the durable W08 queue confirms start/note/evidence exactly once after each lost response', async () => {
  const app = await prepared();
  const changes = [{ action: 'start' }, { action: 'comment', text: 'Nota sintética W09' },
    { action: 'add_evidence', photo: { localUri: disk.photoUri, mediaType: 'image/svg+xml', byteLength: Buffer.byteLength(SYNTHETIC_PHOTO) } }] as const;
  for (const change of changes) {
    await app.incidentSync.record('campus-inc-001', change);
    const [operation] = await app.localWorkspace.pending.listPending();
    network.loseNextCommit = true; await app.incidentSync.synchronize();
    expect(await app.localWorkspace.pending.listPending()).toEqual([]);
    const writes = network.writes.filter(write => write.headers?.['idempotency-key'] === operation!.operationId);
    expect(writes).toHaveLength(2); expect(writes[0]!.body).toBe(writes[1]!.body);
  }
  const final = await remote(); expect(final.version).toBe(4);
  expect(final.payload.history).toHaveLength(3); expect(final.payload.notes).toHaveLength(1); expect(final.payload.evidence).toHaveLength(1);
});
test('exhausted four-send POST budget preserves the exact queue on disk and a later explicit cycle confirms', async () => {
  let app = await prepared(); await app.incidentSync.record('campus-inc-001', { action: 'start' });
  const original = await app.localWorkspace.pending.listPending(); network.rejectWrite = 503;
  await app.incidentSync.synchronize();
  expect(network.writes).toHaveLength(4); expect(await app.localWorkspace.pending.listPending()).toEqual(original);
  expect((await app.incidentSync.recover())[0]!.operations[0]!.state.state).toBe('retry');
  expect((await remote()).version).toBe(1);
  app = await graph(); await app.sessionController.restore();
  expect(await app.localWorkspace.pending.listPending()).toEqual(original);
  network.rejectWrite = null; await app.incidentSync.synchronize();
  expect(await app.localWorkspace.pending.listPending()).toEqual([]);
  const final = await remote(); expect(final.payload.history).toHaveLength(1);
  expect(new Set(network.writes.map(write => write.body)).size).toBe(1);
});
test('timeout on fourth send preserves a committed operation until exact replay after reopen', async () => {
  let app = await prepared(); await app.incidentSync.record('campus-inc-001', { action: 'start' });
  const original = await app.localWorkspace.pending.listPending();
  const base = network.send.bind(network); let calls = 0;
  network.send = async request => {
    if (request.path.endsWith('/actions') && ++calls <= 3) {
      network.writes.push(request); return { status: 503, headers: {}, bodyText: '{}' };
    }
    if (calls === 4) network.loseNextCommit = true;
    return base(request);
  };
  await app.incidentSync.synchronize();
  expect(calls).toBe(4); expect(await app.localWorkspace.pending.listPending()).toEqual(original);
  expect((await remote()).payload.history).toHaveLength(1);
  app = await graph(); await app.sessionController.restore(); await app.incidentSync.synchronize();
  expect(calls).toBe(5); expect(await app.localWorkspace.pending.listPending()).toEqual([]);
  expect((await remote()).payload.history).toHaveLength(1);
  expect(new Set(network.writes.map(write => write.body)).size).toBe(1);
});
test.each([403, 409])('HTTP %s retains conflict/failure and never retries or acknowledges', async status => {
  const app = await prepared(); await app.incidentSync.record('campus-inc-001', { action: 'start' });
  const original = await app.localWorkspace.pending.listPending(); network.rejectWrite = status;
  await app.incidentSync.synchronize();
  expect(network.writes).toHaveLength(1); expect(await app.localWorkspace.pending.listPending()).toEqual(original);
  expect((await app.incidentSync.recover())[0]!.operations[0]!.state.state).toBe(status === 403 ? 'forbidden' : 'conflict');
});
