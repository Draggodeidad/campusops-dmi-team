import type { LocalWorkspace } from '../../application/persistence/LocalWorkspace';
import type { LocalIncidentSnapshot } from '../../application/persistence/LocalIncidentSnapshot';
import type { PendingOperationStore } from '../../application/persistence/PendingOperationStore';
import type { PendingIncidentOperation } from '../../campusops/contracts';
import type { WorkspaceDatabase, WorkspaceSql, WorkspacePhotos, WorkspaceFailurePoint } from './WorkspaceDatabase';
import { canonicalJson, requireData, validateOperation, validateSnapshot, WorkspaceError } from './workspaceValidation';

export const WORKSPACE_VERSION = 2;
export const WORKSPACE_V1_SQL = `
  CREATE TABLE snapshots (incident_id TEXT PRIMARY KEY NOT NULL, snapshot_json TEXT NOT NULL);
  CREATE TABLE pending_operations (
    sequence INTEGER PRIMARY KEY AUTOINCREMENT, operation_id TEXT NOT NULL UNIQUE,
    incident_id TEXT NOT NULL REFERENCES snapshots(incident_id), operation_json TEXT NOT NULL
  );
  PRAGMA user_version = 1;
`;

export class SqliteLocalWorkspace implements LocalWorkspace {
  private db: WorkspaceDatabase | undefined;
  private tail: Promise<unknown> = Promise.resolve();
  readonly pending: PendingOperationStore = {
    enqueue: operation => {
      let captured: PendingIncidentOperation;
      try {
        validateOperation(operation);
        captured = JSON.parse(canonicalJson(operation)) as PendingIncidentOperation;
      } catch { return Promise.reject(new WorkspaceError('INVALID_DATA')); }
      return this.serial(async () => {
      await this.database().withExclusiveTransactionAsync(async txn => {
        await this.insertOperation(txn, captured);
        this.failure('enqueue.afterWrite');
      });
      });
    },
    listPending: () => this.serial(async () => {
      const rows = await this.database().getAllAsync<{ operation_json: string }>(
        'SELECT operation_json FROM pending_operations ORDER BY sequence');
      return rows.map(row => JSON.parse(row.operation_json) as PendingIncidentOperation);
    }),
    acknowledge: operationId => this.serial(async () => {
      requireData(typeof operationId === 'string' && operationId.length > 0);
      await this.database().withExclusiveTransactionAsync(async txn => {
        await txn.runAsync('DELETE FROM pending_operations WHERE operation_id = ?', operationId);
        this.failure('acknowledge.afterDelete');
      });
    }),
  };

  constructor(private readonly options: Readonly<{
    openDatabase(): Promise<WorkspaceDatabase>;
    photos: WorkspacePhotos;
    injectFailure?(point: WorkspaceFailurePoint): void;
    /** For previous-schema fixtures; production always opens current version. */
    targetVersion?: number;
  }>) {}

  private serial<T>(task: () => Promise<T>): Promise<T> {
    const next = this.tail.then(task).catch((error: unknown) => {
      if (error instanceof WorkspaceError) throw error;
      throw new WorkspaceError('STORAGE');
    });
    this.tail = next.catch(() => undefined);
    return next;
  }

  private database(): WorkspaceDatabase {
    if (!this.db) throw new WorkspaceError('CLOSED');
    return this.db;
  }

  private failure(point: WorkspaceFailurePoint): void { this.options.injectFailure?.(point); }

  open(): Promise<void> {
    return this.serial(async () => {
      if (this.db) return;
      const db = await this.options.openDatabase();
      try {
        await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
        await this.migrateDatabase(db, this.options.targetVersion ?? WORKSPACE_VERSION);
        this.db = db;
      } catch (error) { await db.closeAsync(); throw error; }
    });
  }

  close(): Promise<void> {
    return this.serial(async () => {
      if (this.db) { await this.db.closeAsync(); this.db = undefined; }
    });
  }

  migrate(targetVersion: number): Promise<void> {
    return this.serial(() => this.migrateDatabase(this.database(), targetVersion));
  }

  private async migrateDatabase(db: WorkspaceDatabase, target: number): Promise<void> {
    if (target !== 1 && target !== 2) throw new WorkspaceError('VERSION');
    await db.withExclusiveTransactionAsync(async txn => {
      const current = (await txn.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))!.user_version;
      if (current > target || current < 0) throw new WorkspaceError('VERSION');
      if (current === target) return;
      if (current === 0) await txn.execAsync(WORKSPACE_V1_SQL);
      if (target === 1) return;
      const snapshots = await txn.getAllAsync<{ incident_id: string; snapshot_json: string }>('SELECT * FROM snapshots');
      for (const row of snapshots) {
        const snapshot = JSON.parse(row.snapshot_json) as LocalIncidentSnapshot;
        validateSnapshot(snapshot);
        requireData(row.incident_id === snapshot.base.id);
      }
      await txn.execAsync(`CREATE TABLE pending_v2 (
        sequence INTEGER PRIMARY KEY AUTOINCREMENT, operation_id TEXT NOT NULL UNIQUE,
        incident_id TEXT NOT NULL REFERENCES snapshots(incident_id), operation_json TEXT NOT NULL,
        actor_id TEXT NOT NULL, base_version INTEGER NOT NULL CHECK (base_version >= 0)
      );`);
      this.failure('migration.afterSchema');
      const rows = await txn.getAllAsync<{ sequence: number; operation_id: string; incident_id: string; operation_json: string }>(
        'SELECT * FROM pending_operations ORDER BY sequence');
      for (const row of rows) {
        const operation = JSON.parse(row.operation_json) as PendingIncidentOperation;
        validateOperation(operation);
        requireData(operation.operationId === row.operation_id && operation.incidentId === row.incident_id);
        requireData(await txn.getFirstAsync('SELECT incident_id FROM snapshots WHERE incident_id = ?', row.incident_id));
        await txn.runAsync('INSERT INTO pending_v2 VALUES (?, ?, ?, ?, ?, ?)',
          row.sequence, row.operation_id, row.incident_id, row.operation_json, operation.actorId, operation.baseVersion);
      }
      this.failure('migration.afterCopy');
      await txn.execAsync(`DROP TABLE pending_operations; ALTER TABLE pending_v2 RENAME TO pending_operations;
        CREATE INDEX pending_actor_sequence ON pending_operations(actor_id, sequence);
        PRAGMA user_version = 2;`);
    });
  }

  getSnapshot(incidentId: string): Promise<LocalIncidentSnapshot | null> {
    return this.serial(async () => {
      const row = await this.database().getFirstAsync<{ snapshot_json: string }>(
        'SELECT snapshot_json FROM snapshots WHERE incident_id = ?', incidentId);
      return row ? JSON.parse(row.snapshot_json) as LocalIncidentSnapshot : null;
    });
  }

  saveSnapshot(snapshot: LocalIncidentSnapshot): Promise<void> { return this.write(snapshot); }

  commitChange(snapshot: LocalIncidentSnapshot, operation: PendingIncidentOperation): Promise<void> {
    return this.write(snapshot, operation);
  }

  private write(snapshot: LocalIncidentSnapshot, operation?: PendingIncidentOperation): Promise<void> {
    // Capture immutable input before awaiting work queued by another caller.
    let captured: LocalIncidentSnapshot;
    let pending: PendingIncidentOperation | undefined;
    try {
      validateSnapshot(snapshot);
      captured = JSON.parse(canonicalJson(snapshot)) as LocalIncidentSnapshot;
      if (operation) {
        validateOperation(operation);
        requireData(operation.incidentId === snapshot.base.id && operation.baseVersion === snapshot.base.version);
        pending = JSON.parse(canonicalJson(operation)) as PendingIncidentOperation;
      }
    } catch { return Promise.reject(new WorkspaceError('INVALID_DATA')); }
    return this.serial(async () => {
      const cleanup: (() => Promise<void>)[] = [];
      try {
        await this.database().withExclusiveTransactionAsync(async txn => {
          // Replaying an operation cannot overwrite a newer local snapshot.
          if (pending && await this.isDuplicate(txn, pending)) return;
          const photos = [];
          for (const photo of captured.photos) {
            const retained = await this.options.photos.retain(photo);
            cleanup.push(retained.rollback);
            photos.push(retained.photo);
          }
          const durable = { ...captured, photos };
          await txn.runAsync(`INSERT INTO snapshots VALUES (?, ?)
            ON CONFLICT(incident_id) DO UPDATE SET snapshot_json = excluded.snapshot_json`,
          durable.base.id, canonicalJson(durable));
          if (pending) {
            this.failure('change.afterSnapshot');
            await this.insertOperation(txn, pending);
          }
        });
      } catch (error) {
        for (const rollback of cleanup.reverse()) await rollback();
        throw error;
      }
    });
  }

  private async isDuplicate(txn: WorkspaceSql, operation: PendingIncidentOperation): Promise<boolean> {
    const previous = await txn.getFirstAsync<{ operation_json: string }>(
      'SELECT operation_json FROM pending_operations WHERE operation_id = ?', operation.operationId);
    if (!previous) return false;
    if (canonicalJson(JSON.parse(previous.operation_json)) !== canonicalJson(operation)) {
      throw new WorkspaceError('IDENTITY_CONFLICT');
    }
    return true;
  }

  private async insertOperation(txn: WorkspaceSql, operation: PendingIncidentOperation): Promise<void> {
    if (await this.isDuplicate(txn, operation)) return;
    requireData(await txn.getFirstAsync('SELECT incident_id FROM snapshots WHERE incident_id = ?', operation.incidentId));
    const version = (await txn.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))!.user_version;
    const columns = version === 2 ? ', actor_id, base_version' : '';
    const values = version === 2 ? ', ?, ?' : '';
    await txn.runAsync(`INSERT INTO pending_operations (operation_id, incident_id, operation_json${columns}) VALUES (?, ?, ?${values})`,
      operation.operationId, operation.incidentId, canonicalJson(operation),
      ...(version === 2 ? [operation.actorId, operation.baseVersion] : []));
  }
}
