import type { PendingPhotoReference } from '../../application/persistence/LocalIncidentSnapshot';

/** Small provider boundary; production uses Expo, disk tests use SQLite Node. */
export interface WorkspaceSql {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: (string | number | null)[]): Promise<unknown>;
  getFirstAsync<T>(sql: string, ...params: (string | number | null)[]): Promise<T | null>;
  getAllAsync<T>(sql: string, ...params: (string | number | null)[]): Promise<T[]>;
}

export interface WorkspaceDatabase extends WorkspaceSql {
  closeAsync(): Promise<void>;
  withExclusiveTransactionAsync(task: (txn: WorkspaceSql) => Promise<void>): Promise<void>;
}

export type WorkspaceFailurePoint = 'enqueue.afterWrite' | 'change.afterSnapshot'
  | 'acknowledge.afterDelete' | 'migration.afterSchema' | 'migration.afterCopy';

export interface WorkspacePhotos {
  /** Copy temporary inputs, verify owned files; rollback removes only NEW copies. */
  retain(photo: PendingPhotoReference): Promise<{
    photo: PendingPhotoReference;
    rollback(): Promise<void>;
  }>;
}
