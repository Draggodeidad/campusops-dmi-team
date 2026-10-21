import type { PendingIncidentOperation } from '../../campusops/contracts';

export interface PendingOperationStore {
  /** Same ID/content is a no-op; same ID/different content rejects atomically. */
  enqueue(operation: PendingIncidentOperation): Promise<void>;
  listPending(): Promise<readonly PendingIncidentOperation[]>;
  /** Caller must first verify a server confirmation for this exact operation. */
  acknowledge(operationId: string): Promise<void>;
}
