// Provider capability probe, NOT the CampusOps adapter or its migration suite.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const script = fileURLToPath(import.meta.url);
const repo = resolve(fileURLToPath(new URL('..', import.meta.url)));
const injectedFailure = 'Injected W08 provider migration failure';

function readState(db) {
  return {
    version: db.prepare('PRAGMA user_version').get().user_version,
    columns: db.prepare('PRAGMA table_info(probe)').all().map((row) => row.name),
    rows: db.prepare('SELECT id, content FROM probe ORDER BY id').all(),
  };
}

function worker(phase, databasePath, seedPath) {
  const db = new DatabaseSync(databasePath);
  try {
    if (phase === 'seed') {
      db.exec('CREATE TABLE probe (id TEXT PRIMARY KEY, content TEXT NOT NULL); PRAGMA user_version = 1;');
      db.prepare('INSERT INTO probe VALUES (?, ?)').run('w08-probe-001', readFileSync(seedPath, 'utf8'));
    } else if (phase === 'fail' || phase === 'migrate') {
      const before = readState(db);
      try {
        db.exec('BEGIN IMMEDIATE; ALTER TABLE probe ADD COLUMN migrated INTEGER NOT NULL DEFAULT 0;');
        db.exec('UPDATE probe SET migrated = 1; PRAGMA user_version = 2;');
        if (phase === 'fail') throw new Error(injectedFailure);
        db.exec('COMMIT;');
      } catch (error) {
        db.exec('ROLLBACK;');
        if (phase !== 'fail' || error.message !== injectedFailure) throw error;
        assert.deepEqual(readState(db), before, 'Rollback must restore schema, data and user_version');
      }
    } else {
      assert.equal(phase, 'read', 'Unknown worker phase');
    }
    process.stdout.write(JSON.stringify(readState(db)));
  } finally {
    db.close();
  }
}

if (process.argv[2] === '--phase') {
  worker(process.argv[3], process.argv[4], process.argv[5]);
} else {
  const expo = JSON.parse(readFileSync(join(repo, 'node_modules/expo/package.json'), 'utf8'));
  const bundled = JSON.parse(readFileSync(join(repo, 'node_modules/expo/bundledNativeModules.json'), 'utf8'));
  assert.match(expo.version, /^57\./, 'Recheck provider compatibility if Expo changes');
  assert.match(bundled['expo-sqlite'], /^~57\./);
  const directory = mkdtempSync(join(tmpdir(), 'campusops-w08-sqlite-'));
  const databasePath = join(directory, 'probe.sqlite');
  const seedPath = join(directory, 'seed.json');
  const run = (phase) => {
    const result = spawnSync(process.execPath, [script, '--phase', phase, databasePath, seedPath], {
      encoding: 'utf8', timeout: 10000,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, `${phase}: ${result.stderr}`);
    return JSON.parse(result.stdout);
  };
  try {
    // Data spans operations, notes and a durable file reference; no session secrets.
    const photoPath = join(directory, 'synthetic.svg');
    const photo = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>\n';
    writeFileSync(photoPath, photo);
    writeFileSync(seedPath, JSON.stringify({
      operationId: 'w08-probe-001', incidentId: 'campus-inc-001',
      actorId: 'technician-1', baseVersion: 1, action: 'start', payload: {},
      notes: ['Nota sintética del probe'], photoPath,
    }));
    const before = run('seed');
    assert.deepEqual(run('read'), before, 'A new process must recover identical data');
    const afterFailure = run('fail');
    assert.deepEqual(afterFailure, before, 'Failed transaction must not leave partial data');
    assert.deepEqual(run('read'), before, 'Rollback must survive another process restart');
    const after = run('migrate');
    assert.equal(after.version, 2);
    assert.deepEqual(after.rows, before.rows, 'Successful migration must preserve content');
    assert.deepEqual(after.columns, ['id', 'content', 'migrated']);
    assert.deepEqual(run('read'), after);
    assert.equal(readFileSync(photoPath, 'utf8'), photo);
    console.log(JSON.stringify({
      scope: 'SQLite engine on disk + Expo compatibility metadata; not an Android adapter test',
      node: process.version, expo: expo.version, recommendedExpoSqlite: bundled['expo-sqlite'],
      checks: ['new-process-reopen', 'transaction-rollback-schema-data-version', 'migration-preserves-content', 'durable-synthetic-file'],
      observed: { before: { version: before.version, columns: before.columns, rows: before.rows.length },
        afterFailure: { version: afterFailure.version, columns: afterFailure.columns, rows: afterFailure.rows.length },
        after: { version: after.version, columns: after.columns, rows: after.rows.length } },
    }, null, 2));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
