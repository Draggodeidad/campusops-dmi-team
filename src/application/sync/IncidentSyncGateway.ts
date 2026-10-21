import type { PendingIncidentOperation } from '../../campusops/contracts';
import type { Incident } from '../../domain/incidents/Incident';
import type { SyncRecord } from '../../domain/sync/SyncRecord';

export type SyncIdentity = Readonly<{ actorId: string; generation: number }>;
export type IncidentHistoryEntry = Readonly<{
  operationId: string; actorId: string; action: string; version: number;
}>;
export type RemoteIncidentState = Readonly<{
  incident: Incident;
  record: SyncRecord;
  history: readonly IncidentHistoryEntry[];
}>;

/** apply returns only after verifying the exact operation's server receipt. */
export interface IncidentSyncGateway {
  read(incidentId: string, identity: SyncIdentity): Promise<RemoteIncidentState>;
  apply(operation: PendingIncidentOperation, identity: SyncIdentity): Promise<RemoteIncidentState>;
}

export type SyntheticPhoto = Readonly<{ localUri: string; mediaType: string; byteLength: number }>;
export interface SyntheticPhotoSource {
  prepare(): Promise<SyntheticPhoto>;
}
