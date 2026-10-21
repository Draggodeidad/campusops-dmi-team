import type { PendingIncidentOperation } from '../../../src/campusops/contracts';
import type { SyncRecord } from '../../../src/domain/sync/SyncRecord';
import type { LocalIncidentSnapshot } from '../../../src/application/persistence/LocalIncidentSnapshot';

/** Fresh objects per call so one suite cannot change another suite's fixture. */
export function createWeek08Scenario(durablePhotoUri: string) {
  const base: SyncRecord = {
    id: 'campus-inc-001', version: 1,
    fields: { work: { assignedTechnicianId: 'technician-1', status: 'assigned' } },
  };
  const local: SyncRecord = {
    id: base.id, version: 1,
    fields: { work: { assignedTechnicianId: 'technician-1', status: 'in_progress' } },
  };
  const remote: SyncRecord = {
    id: base.id, version: 2,
    fields: { work: { assignedTechnicianId: 'technician-2', status: 'assigned' } },
  };
  const operation: PendingIncidentOperation = {
    operationId: 'w08-start-001', incidentId: base.id, baseVersion: 1,
    actorId: 'technician-1', action: 'start', payload: {},
  };
  const noteOperation: PendingIncidentOperation = {
    ...operation, operationId: 'w08-note-001', action: 'comment',
    payload: { text: 'Nota sintética: revisión local pendiente.' },
  };
  const photoOperation: PendingIncidentOperation = {
    ...operation, operationId: 'w08-photo-001', action: 'add_evidence',
    payload: { evidenceId: 'w08-photo-001' },
  };
  const snapshot: LocalIncidentSnapshot = {
    base, local,
    notes: [{
      noteId: 'w08-note-001', operationId: noteOperation.operationId,
      actorId: operation.actorId, text: String(noteOperation.payload.text),
    }],
    photos: [{
      evidenceId: 'w08-photo-001', operationId: photoOperation.operationId,
      actorId: operation.actorId, localUri: durablePhotoUri,
      mediaType: 'image/svg+xml', byteLength: SYNTHETIC_PHOTO.length,
    }],
  };
  return { base, local, remote, operation, noteOperation, photoOperation, snapshot };
}

/** An original synthetic image; no camera, people, campus or uploaded resource. */
export const SYNTHETIC_PHOTO = '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="2" height="2" fill="blue"/></svg>\n';
