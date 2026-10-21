import type { SyncRecord } from '../../domain/sync/SyncRecord';
import type { PendingIncidentOperation } from '../../campusops/contracts';

export type LocalIncidentNote = Readonly<{
  noteId: string;
  operationId: string;
  actorId: string;
  text: string;
}>;

/** localUri points to an app-owned durable file, never a cache-only resource. */
export type PendingPhotoReference = Readonly<{
  evidenceId: string;
  operationId: string;
  actorId: string;
  localUri: string;
  mediaType: string;
  byteLength: number;
}>;

export type LocalIncidentSnapshot = Readonly<{
  /** Cache and local intentions are visible only to the identity that saved them. */
  ownerActorId?: string;
  base: SyncRecord;
  local: SyncRecord;
  notes: readonly LocalIncidentNote[];
  photos: readonly PendingPhotoReference[];
  remote?: SyncRecord;
  remoteReaderActorId?: string;
  operationStates?: Readonly<Record<string, Readonly<{
    state: 'pending' | 'retry' | 'conflict' | 'forbidden' | 'reviewed' | 'superseded';
    fields?: readonly string[];
    replacementOperationId?: string;
  }>>>;
  resolutions?: readonly Readonly<{
    operationId: string;
    actorId: string;
    decision: 'keep_remote' | 'reformulate';
    replacementOperationId?: string;
  }>[];
  /** Verified receipts retain the original request identity after queue removal. */
  confirmedOperations?: readonly PendingIncidentOperation[];
}>;
