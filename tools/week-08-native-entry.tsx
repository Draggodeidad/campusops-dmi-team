/** Dedicated test entry for the existing app. Never used by index.ts or release builds. */
import { registerRootComponent } from 'expo';
import { Directory, File, Paths } from 'expo-file-system';
import { openDatabaseAsync } from 'expo-sqlite';
import { Text } from 'react-native';
import { createExpoWorkspace } from '../src/infrastructure/persistence/createExpoWorkspace';
import { canonicalJson } from '../src/infrastructure/persistence/workspaceValidation';
import type { WorkspaceFailurePoint } from '../src/infrastructure/persistence/WorkspaceDatabase';
import { createWeek08Scenario, SYNTHETIC_PHOTO } from '../course-tests/fixtures/week-08/scenario';

const stage = new File(Paths.document, 'w08-native-stage.json');
const result = new File(Paths.document, 'w08-native-result.json');
const directory = new Directory(Paths.document, 'w08-native-isolated');
const attachments = new Directory(directory, 'attachments');
const databasePath = new File(directory, 'workspace.sqlite').uri;
const checks: string[] = [];
let failure: WorkspaceFailurePoint | undefined;
const create = (targetVersion = 2) => createExpoWorkspace({
  databasePath, attachmentDirectory: attachments.uri, targetVersion,
  injectFailure(point) { if (point === failure) { failure = undefined; throw new Error('Injected'); } },
});

function equal(actual: unknown, expected: unknown, label: string) {
  if (canonicalJson(actual) !== canonicalJson(expected)) throw new Error(label);
  checks.push(label);
}
async function rejects(action: () => Promise<unknown>, label: string) {
  let rejected = false;
  try { await action(); } catch { rejected = true; }
  equal(rejected, true, label);
}
async function inspect() {
  const db = await openDatabaseAsync('workspace.sqlite', { useNewConnection: true }, directory.uri);
  try {
    return {
      version: await db.getFirstAsync('PRAGMA user_version'),
      schema: await db.getAllAsync("SELECT name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name"),
      snapshots: await db.getAllAsync('SELECT * FROM snapshots ORDER BY incident_id'),
      pending: await db.getAllAsync('SELECT * FROM pending_operations ORDER BY sequence'),
    };
  } finally { await db.closeAsync(); }
}

async function run() {
  if (!stage.exists) {
    directory.create({ intermediates: true, idempotent: true });
    attachments.create({ intermediates: true, idempotent: true });
    const source = new File(Paths.cache, 'w08-synthetic.svg');
    source.write(SYNTHETIC_PHOTO);
    const scenario = createWeek08Scenario(source.uri);
    const workspace = create(1);
    await workspace.open();
    await workspace.commitChange(scenario.snapshot, scenario.operation);
    await workspace.pending.enqueue(scenario.noteOperation);
    await workspace.pending.enqueue(scenario.photoOperation);
    const snapshot = (await workspace.getSnapshot(scenario.base.id))!;
    equal(snapshot.photos[0]!.localUri.startsWith(attachments.uri), true, 'native-copy-to-documents');
    equal(await new File(snapshot.photos[0]!.localUri).text(), SYNTHETIC_PHOTO, 'native-copy-content');
    source.delete(); // Later recovery cannot depend on the original cache file.
    await workspace.close();
    stage.write(JSON.stringify({ snapshot, checks }));
    return;
  }
  const seeded = JSON.parse(await stage.text()) as { snapshot: ReturnType<typeof createWeek08Scenario>['snapshot']; checks: string[] };
  checks.push(...seeded.checks);
  const scenario = createWeek08Scenario(seeded.snapshot.photos[0]!.localUri);
  let workspace = create(1);
  await workspace.open();
  equal(await workspace.getSnapshot(scenario.base.id), seeded.snapshot, 'native-new-process-snapshot-author-base-notes');
  equal(await workspace.pending.listPending(), [scenario.operation, scenario.noteOperation, scenario.photoOperation], 'native-new-process-operation-order-identity');
  equal(await new File(seeded.snapshot.photos[0]!.localUri).text(), SYNTHETIC_PHOTO, 'native-new-process-photo-without-cache');
  const before = await inspect();
  for (const point of ['migration.afterSchema', 'migration.afterCopy'] as const) {
    failure = point;
    await rejects(() => workspace.migrate(2), `native-${point}-rejects`);
    await workspace.close();
    equal(await inspect(), before, `native-${point}-rollback-schema-data-version`);
    workspace = create(1); await workspace.open();
  }
  failure = 'enqueue.afterWrite';
  await rejects(() => workspace.pending.enqueue({ ...scenario.operation, operationId: 'native-failed-enqueue' }), 'native-enqueue-failure');
  equal(await inspect(), before, 'native-enqueue-rollback');
  const newPhoto = new File(Paths.cache, 'w08-new-photo.svg'); newPhoto.write(SYNTHETIC_PHOTO);
  const filesBefore = attachments.list().length;
  failure = 'change.afterSnapshot';
  await rejects(() => workspace.commitChange({ ...scenario.snapshot, photos: [{ ...scenario.snapshot.photos[0]!, localUri: newPhoto.uri }] },
    { ...scenario.operation, operationId: 'native-failed-change' }), 'native-change-failure');
  equal(await inspect(), before, 'native-change-rollback');
  equal(attachments.list().length, filesBefore, 'native-failed-copy-cleanup');
  newPhoto.delete();
  failure = 'acknowledge.afterDelete';
  await rejects(() => workspace.pending.acknowledge(scenario.operation.operationId), 'native-acknowledge-failure');
  equal(await inspect(), before, 'native-acknowledge-rollback');
  await workspace.migrate(2);
  await workspace.close(); workspace = create(); await workspace.open();
  equal((await inspect()).version, { user_version: 2 }, 'native-migration-version-two');
  equal(await workspace.getSnapshot(scenario.base.id), seeded.snapshot, 'native-migration-preserves-snapshot');
  equal(await workspace.pending.listPending(), [scenario.operation, scenario.noteOperation, scenario.photoOperation], 'native-migration-preserves-queue');
  await workspace.pending.enqueue(scenario.operation);
  await rejects(() => workspace.pending.enqueue({ ...scenario.operation, payload: { changed: true } }), 'native-identity-mismatch');
  await workspace.pending.acknowledge(scenario.operation.operationId);
  equal(await workspace.pending.listPending(), [scenario.noteOperation, scenario.photoOperation], 'native-only-confirmed-operation-deleted');
  await workspace.close();
  directory.delete();
  result.write(JSON.stringify({ status: 'pass', provider: 'expo-sqlite / expo-file-system on Android', checks }));
}

void run().catch((error: unknown) => {
  const failure = error instanceof Error && (error.message.startsWith('native-') || error.name === 'WorkspaceError')
    ? error.message : 'Native provider failure; inspect with a debugger.';
  result.write(JSON.stringify({ status: 'fail', checks, failure }));
});
registerRootComponent(() => <Text>CampusOps W08 native persistence verification</Text>);
