import type { SyncRecord } from '../../domain/sync/SyncRecord';

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
  base: SyncRecord;
  local: SyncRecord;
  notes: readonly LocalIncidentNote[];
  photos: readonly PendingPhotoReference[];
}>;
