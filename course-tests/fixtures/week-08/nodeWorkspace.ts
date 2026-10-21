import { DatabaseSync } from 'node:sqlite';
import { copyFile, stat, unlink } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { SqliteLocalWorkspace } from '../../../src/infrastructure/persistence/SqliteLocalWorkspace';
import type { WorkspaceDatabase, WorkspaceSql } from '../../../src/infrastructure/persistence/WorkspaceDatabase';
import { requireData } from '../../../src/infrastructure/persistence/workspaceValidation';
import type { WorkspaceFixtureOptions } from './temporaryWorkspace';

/** Real SQLite on disk, substituting only Expo's native driver and filesystem API. */
export function openNodeDatabase(path: string): WorkspaceDatabase {
  const db = new DatabaseSync(path);
  const sql: WorkspaceSql = {
    async execAsync(query) { db.exec(query); },
    async runAsync(query, ...params) { return db.prepare(query).run(...params); },
    async getFirstAsync<T>(query: string, ...params: (string | number | null)[]) {
      return (db.prepare(query).get(...params) as T | undefined) ?? null;
    },
    async getAllAsync<T>(query: string, ...params: (string | number | null)[]) {
      return db.prepare(query).all(...params) as T[];
    },
  };
  return {
    ...sql,
    async closeAsync() { db.close(); },
    async withExclusiveTransactionAsync(task) {
      db.exec('BEGIN IMMEDIATE');
      try { await task(sql); db.exec('COMMIT'); }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    },
  };
}

export function createNodeWorkspace(options: WorkspaceFixtureOptions, targetVersion = 2) {
  return new SqliteLocalWorkspace({
    targetVersion, injectFailure: options.injectFailure,
    async openDatabase() { return openNodeDatabase(options.databasePath); },
    photos: {
      async retain(photo) {
        const source = fileURLToPath(photo.localUri);
        requireData((await stat(source)).size === photo.byteLength);
        if (dirname(source) === options.attachmentDirectory) return { photo, async rollback() {} };
        const destination = join(options.attachmentDirectory, `${randomUUID()}.attachment`);
        await copyFile(source, destination);
        return { photo: { ...photo, localUri: pathToFileURL(destination).href }, async rollback() { await unlink(destination); } };
      },
    },
  });
}
