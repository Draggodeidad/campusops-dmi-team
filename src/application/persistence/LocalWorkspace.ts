import type { PendingIncidentOperation } from '../../campusops/contracts';
import type { LocalIncidentSnapshot } from './LocalIncidentSnapshot';
import type { PendingOperationStore } from './PendingOperationStore';

/** Contract only in #42; the durable adapter and migrations belong to #43. */
export interface LocalWorkspace {
  open(): Promise<void>;
  close(): Promise<void>;
  migrate(targetVersion: number): Promise<void>;
  readonly pending: PendingOperationStore;
  getSnapshot(incidentId: string): Promise<LocalIncidentSnapshot | null>;
  /** Cache a snapshot without creating a pending action. */
  saveSnapshot(snapshot: LocalIncidentSnapshot): Promise<void>;
  /** Commit matching incident snapshot and operation in ONE transaction. */
  commitChange(
    snapshot: LocalIncidentSnapshot,
    operation: PendingIncidentOperation,
  ): Promise<void>;
}
