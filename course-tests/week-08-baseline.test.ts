import { access, open, readFile } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import { createWeek08Scenario, SYNTHETIC_PHOTO } from './fixtures/week-08/scenario';
import { createTemporaryWorkspace } from './fixtures/week-08/temporaryWorkspace';

test('shared fixture preserves the required actor, base, stable operation and reassignment', () => {
  const first = createWeek08Scenario('file:///synthetic.svg');
  const second = createWeek08Scenario('file:///synthetic.svg');
  expect(first).toEqual(second);
  expect(first.base.fields.work).toEqual({ assignedTechnicianId: 'technician-1', status: 'assigned' });
  expect(first.local.fields.work).toEqual({ assignedTechnicianId: 'technician-1', status: 'in_progress' });
  expect(first.remote).toEqual({ id: 'campus-inc-001', version: 2,
    fields: { work: { assignedTechnicianId: 'technician-2', status: 'assigned' } } });
  expect(first.operation).toEqual({ operationId: 'w08-start-001', incidentId: 'campus-inc-001',
    baseVersion: 1, actorId: 'technician-1', action: 'start', payload: {} });
  expect(first.snapshot.base).not.toBe(second.snapshot.base);
  expect(first.snapshot.notes[0]?.operationId).toBe(first.noteOperation.operationId);
  expect(first.snapshot.photos[0]?.operationId).toBe(first.photoOperation.operationId);
});

test('temporary factory reopens a real file with a new handle and cleans only its own resource', async () => {
  // This file handle exercises the harness lifecycle, not the future SQLite adapter.
  const fixture = await createTemporaryWorkspace(({ databasePath }) => {
    let handle: FileHandle | undefined;
    return {
      async open() { handle = await open(databasePath, 'a+'); },
      async close() { await handle?.close(); handle = undefined; },
      async write(value: string) { await handle!.writeFile(value); },
    };
  });
  const isolated = await createTemporaryWorkspace(() => ({
    async open() {}, async close() {},
  }));
  try {
    const scenario = createWeek08Scenario(fixture.photoUri);
    const first = await fixture.reopen();
    const persisted = JSON.stringify(scenario.snapshot);
    await first.write(persisted);
    const second = await fixture.reopen();
    expect(second).not.toBe(first);
    expect(await readFile(fixture.options.databasePath, 'utf8')).toBe(persisted);
    expect(await readFile(fixture.photoPath, 'utf8')).toBe(SYNTHETIC_PHOTO);
    expect(scenario.snapshot.photos[0]?.byteLength).toBe(Buffer.byteLength(SYNTHETIC_PHOTO));
    await fixture.cleanup();
    await expect(access(fixture.directory)).rejects.toThrow();
    await expect(access(isolated.photoPath)).resolves.toBeUndefined();
    await expect(fixture.reopen()).rejects.toThrow('disposed');
  } finally {
    await fixture.cleanup();
    await isolated.cleanup();
  }
});

test('transaction failure injection targets one named point once without touching files', async () => {
  const fixture = await createTemporaryWorkspace(() => ({ async open() {}, async close() {} }));
  try {
    fixture.failNext('migration.afterSchema');
    expect(() => fixture.options.injectFailure('migration.afterCopy')).not.toThrow();
    expect(() => fixture.options.injectFailure('migration.afterSchema')).toThrow('migration.afterSchema');
    expect(() => fixture.options.injectFailure('migration.afterSchema')).not.toThrow();
    expect(await readFile(fixture.photoPath, 'utf8')).toBe(SYNTHETIC_PHOTO);
  } finally {
    await fixture.cleanup();
  }
});
