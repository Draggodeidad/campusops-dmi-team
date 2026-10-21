import { DatabaseSync } from 'node:sqlite';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createNodeWorkspace } from './fixtures/week-08/nodeWorkspace';
import { createTemporaryWorkspace } from './fixtures/week-08/temporaryWorkspace';
import { createWeek08Scenario, SYNTHETIC_PHOTO } from './fixtures/week-08/scenario';
import type { PendingIncidentOperation } from '../src/campusops/contracts';

async function setup(version = 2) {
  const fixture = await createTemporaryWorkspace(options => createNodeWorkspace(options, version));
  const workspace = await fixture.reopen();
  const scenario = createWeek08Scenario(fixture.photoUri);
  return { fixture, workspace, ...scenario };
}

function inspect(path: string) {
  const db = new DatabaseSync(path);
  try {
    return {
      version: db.prepare('PRAGMA user_version').get(),
      schema: db.prepare("SELECT name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name").all(),
      snapshots: db.prepare('SELECT * FROM snapshots ORDER BY incident_id').all(),
      pending: db.prepare('SELECT * FROM pending_operations ORDER BY sequence').all(),
    };
  } finally { db.close(); }
}

test('disk reopen preserves exact author, base, notes, file and original operation order; a second process reads it', async () => {
  const s = await setup();
  try {
    await s.workspace.commitChange(s.snapshot, s.operation);
    await s.workspace.pending.enqueue(s.noteOperation);
    await s.workspace.pending.enqueue(s.photoOperation);
    const next = await s.fixture.reopen();
    expect(next).not.toBe(s.workspace);
    expect(await next.getSnapshot(s.base.id)).toEqual(s.snapshot);
    expect(await next.pending.listPending()).toEqual([s.operation, s.noteOperation, s.photoOperation]);
    expect(await readFile(s.fixture.photoPath, 'utf8')).toBe(SYNTHETIC_PHOTO);
    await next.close();
    const script = `const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.argv[1]);process.stdout.write(JSON.stringify(db.prepare('SELECT operation_json FROM pending_operations ORDER BY sequence').all()));db.close();`;
    const rows = JSON.parse(execFileSync(process.execPath, ['-e', script, s.fixture.options.databasePath], { encoding: 'utf8' })) as { operation_json: string }[];
    expect(rows.map(row => JSON.parse(row.operation_json))).toEqual([s.operation, s.noteOperation, s.photoOperation]);
  } finally { await s.fixture.cleanup(); }
});

test.each(['migration.afterSchema', 'migration.afterCopy'] as const)('v1 to v2 rolls back schema, rows, order and version at %s, then recovers', async point => {
  const s = await setup(1);
  try {
    await s.workspace.commitChange(s.snapshot, s.operation);
    await s.workspace.pending.enqueue(s.noteOperation);
    await s.workspace.pending.enqueue(s.photoOperation);
    const before = inspect(s.fixture.options.databasePath);
    s.fixture.failNext(point);
    await expect(s.workspace.migrate(2)).rejects.toMatchObject({ code: 'STORAGE' });
    expect(inspect(s.fixture.options.databasePath)).toEqual(before);
    const reopened = await s.fixture.reopen();
    expect(inspect(s.fixture.options.databasePath)).toEqual(before);
    await reopened.migrate(2);
    const after = inspect(s.fixture.options.databasePath);
    expect(after.version).toEqual({ user_version: 2 });
    expect(after.snapshots).toEqual(before.snapshots);
    expect(await reopened.pending.listPending()).toEqual([s.operation, s.noteOperation, s.photoOperation]);
    expect(after.pending[0]).toMatchObject({ sequence: 1, actor_id: s.operation.actorId, base_version: 1 });
    await reopened.migrate(2);
    expect(inspect(s.fixture.options.databasePath)).toEqual(after);
    await expect(reopened.migrate(1)).rejects.toMatchObject({ code: 'VERSION' });
    await expect(reopened.migrate(3)).rejects.toMatchObject({ code: 'VERSION' });
    expect(inspect(s.fixture.options.databasePath)).toEqual(after);
  } finally { await s.fixture.cleanup(); }
});

test('failed automatic upgrade closes connection; a new current-version instance recovers the same v1 resource', async () => {
  const s = await setup(1);
  try {
    await s.workspace.commitChange(s.snapshot, s.operation);
    await s.workspace.close();
    const before = inspect(s.fixture.options.databasePath);
    const current = createNodeWorkspace(s.fixture.options);
    s.fixture.failNext('migration.afterCopy');
    await expect(current.open()).rejects.toMatchObject({ code: 'STORAGE' });
    expect(inspect(s.fixture.options.databasePath)).toEqual(before);
    await current.open();
    expect(await current.getSnapshot(s.base.id)).toEqual(s.snapshot);
    await current.close();
  } finally { await s.fixture.cleanup(); }
});

test('snapshot and queue roll back together, copy is removed, existing photo stays usable', async () => {
  const s = await setup();
  try {
    await s.workspace.saveSnapshot(s.snapshot);
    const temp = join(s.fixture.directory, 'cache.svg');
    await writeFile(temp, SYNTHETIC_PHOTO);
    const changed = { ...s.snapshot, local: { ...s.local, fields: { work: { status: 'resolved' } } },
      photos: [{ ...s.snapshot.photos[0]!, localUri: pathToFileURL(temp).href }] };
    s.fixture.failNext('change.afterSnapshot');
    await expect(s.workspace.commitChange(changed, s.operation)).rejects.toMatchObject({ code: 'STORAGE' });
    const reopened = await s.fixture.reopen();
    expect(await reopened.getSnapshot(s.base.id)).toEqual(s.snapshot);
    expect(await reopened.pending.listPending()).toEqual([]);
    expect(await readdir(s.fixture.options.attachmentDirectory)).toEqual(['synthetic.svg']);
    await reopened.commitChange(changed, s.operation);
    const saved = (await reopened.getSnapshot(s.base.id))!;
    expect(saved.photos[0]!.localUri).not.toBe(pathToFileURL(temp).href);
    expect(await readFile(fileURLToPath(saved.photos[0]!.localUri), 'utf8')).toBe(SYNTHETIC_PHOTO);
  } finally { await s.fixture.cleanup(); }
});

test('enqueue failure rolls back; confirmation deletes only its operation and failure restores it', async () => {
  const s = await setup();
  try {
    await s.workspace.commitChange(s.snapshot, s.operation);
    s.fixture.failNext('enqueue.afterWrite');
    await expect(s.workspace.pending.enqueue(s.noteOperation)).rejects.toMatchObject({ code: 'STORAGE' });
    expect(await s.workspace.pending.listPending()).toEqual([s.operation]);
    await s.workspace.pending.enqueue(s.noteOperation);
    s.fixture.failNext('acknowledge.afterDelete');
    await expect(s.workspace.pending.acknowledge(s.operation.operationId)).rejects.toMatchObject({ code: 'STORAGE' });
    const next = await s.fixture.reopen();
    expect(await next.pending.listPending()).toEqual([s.operation, s.noteOperation]);
    await next.pending.acknowledge(s.operation.operationId);
    await next.pending.acknowledge('absent');
    expect(await next.pending.listPending()).toEqual([s.noteOperation]);
    expect(await next.getSnapshot(s.base.id)).toEqual(s.snapshot);
    expect(await readFile(s.fixture.photoPath, 'utf8')).toBe(SYNTHETIC_PHOTO);
  } finally { await s.fixture.cleanup(); }
});

test('same JSON identity is a no-op; changed body rejects atomically and a replay cannot regress snapshot', async () => {
  const s = await setup();
  try {
    const operation = { ...s.operation, payload: { b: [1, 2], a: { x: true } } };
    await s.workspace.commitChange(s.snapshot, operation);
    await s.workspace.pending.enqueue({ ...operation, payload: { a: { x: true }, b: [1, 2] } });
    const before = inspect(s.fixture.options.databasePath);
    await expect(s.workspace.commitChange({ ...s.snapshot, notes: [] }, { ...operation, payload: { changed: true } })).rejects.toMatchObject({ code: 'IDENTITY_CONFLICT' });
    expect(inspect(s.fixture.options.databasePath)).toEqual(before);
    await s.workspace.commitChange({ ...s.snapshot, notes: [] }, operation);
    expect(inspect(s.fixture.options.databasePath)).toEqual(before);
  } finally { await s.fixture.cleanup(); }
});

test.each([undefined, NaN, Infinity, () => 1, new Date(), { token: 'synthetic-forbidden' }, [undefined]])('rejects non-JSON/secret payload %p without any partial write', async value => {
  const s = await setup();
  try {
    await expect(s.workspace.commitChange(s.snapshot, { ...s.operation, payload: { value } })).rejects.toMatchObject({ code: 'INVALID_DATA' });
    expect(await s.workspace.getSnapshot(s.base.id)).toBeNull();
    expect(await s.workspace.pending.listPending()).toEqual([]);
  } finally { await s.fixture.cleanup(); }
});

test('rejects cyclic payload, mismatched IDs/base, orphan operations and missing attachments', async () => {
  const s = await setup();
  try {
    const cycle: Record<string, unknown> = {}; cycle.self = cycle;
    for (const operation of [{ ...s.operation, payload: cycle }, { ...s.operation, incidentId: 'other' }, { ...s.operation, baseVersion: 99 }]) {
      await expect(s.workspace.commitChange(s.snapshot, operation)).rejects.toMatchObject({ code: 'INVALID_DATA' });
    }
    await expect(s.workspace.pending.enqueue(s.operation)).rejects.toMatchObject({ code: 'INVALID_DATA' });
    await expect(s.workspace.commitChange({ ...s.snapshot, photos: [{ ...s.snapshot.photos[0]!, localUri: 'file:///missing' }] }, s.operation)).rejects.toMatchObject({ code: 'STORAGE' });
    expect(await s.workspace.getSnapshot(s.base.id)).toBeNull();
  } finally { await s.fixture.cleanup(); }
});

test('serializes concurrent writes and lifecycle, supports isolated files, rejects closed calls', async () => {
  const s = await setup();
  const other = await setup();
  try {
    await s.workspace.open();
    await s.workspace.saveSnapshot(s.snapshot);
    const operations: PendingIncidentOperation[] = Array.from({ length: 10 }, (_, i) => ({ ...s.operation, operationId: `concurrent-${i}` }));
    await Promise.all(operations.map(op => s.workspace.pending.enqueue(op)));
    expect(await s.workspace.pending.listPending()).toEqual(operations);
    expect(await other.workspace.pending.listPending()).toEqual([]);
    await s.workspace.close(); await s.workspace.close();
    await expect(s.workspace.getSnapshot(s.base.id)).rejects.toMatchObject({ code: 'CLOSED' });
    await expect(s.workspace.pending.enqueue(s.operation)).rejects.toMatchObject({ code: 'CLOSED' });
    await s.workspace.open();
    expect(await s.workspace.pending.listPending()).toEqual(operations);
  } finally { await s.fixture.cleanup(); await other.fixture.cleanup(); }
});

test('captures enqueue input at invocation and recovered reads cannot mutate storage', async () => {
  const s = await setup();
  try {
    await s.workspace.saveSnapshot(s.snapshot);
    const payload = { text: 'original' };
    const queued = s.workspace.pending.enqueue({ ...s.noteOperation, payload });
    payload.text = 'changed after invocation';
    await queued;
    const read = await s.workspace.pending.listPending();
    (read[0]!.payload as Record<string, unknown>).text = 'changed after read';
    expect((await s.workspace.pending.listPending())[0]!.payload).toEqual({ text: 'original' });
  } finally { await s.fixture.cleanup(); }
});

test('unknown future schema rejects without overwriting its rows or version', async () => {
  const s = await setup();
  try {
    await s.workspace.commitChange(s.snapshot, s.operation);
    await s.workspace.close();
    const db = new DatabaseSync(s.fixture.options.databasePath);
    db.exec('PRAGMA user_version = 99'); db.close();
    const before = inspect(s.fixture.options.databasePath);
    await expect(s.workspace.open()).rejects.toMatchObject({ code: 'VERSION' });
    expect(inspect(s.fixture.options.databasePath)).toEqual(before);
  } finally { await s.fixture.cleanup(); }
});

test('corrupt previous-schema data blocks migration and leaves all previous rows intact', async () => {
  const s = await setup(1);
  try {
    await s.workspace.commitChange(s.snapshot, s.operation);
    await s.workspace.close();
    const db = new DatabaseSync(s.fixture.options.databasePath);
    db.prepare('UPDATE pending_operations SET operation_json = ?').run(JSON.stringify({ ...s.operation, incidentId: 'mismatch' }));
    db.close();
    const before = inspect(s.fixture.options.databasePath);
    const current = createNodeWorkspace(s.fixture.options);
    await expect(current.open()).rejects.toMatchObject({ code: 'INVALID_DATA' });
    expect(inspect(s.fixture.options.databasePath)).toEqual(before);
  } finally { await s.fixture.cleanup(); }
});
