import type { Incident } from '../../domain/incidents/Incident';
import type { SyncRecord } from '../../domain/sync/SyncRecord';
import { ApplicationFailure } from '../errors/ApplicationFailure';

export function incidentRecord(incident: Incident): SyncRecord {
  if (incident.version === undefined || incident.assignedTechnicianId === undefined) {
    throw new ApplicationFailure('INVALID_INCIDENT_INPUT', 'Actualiza los datos y la asignación antes de guardar cambios locales.');
  }
  const { id, version, status, assignedTechnicianId, notes = [], evidence = [], priority = null, ...details } = incident;
  return { id, version, fields: { details, work: { assignedTechnicianId, status }, notes, evidence, priority } };
}

/** Only consumes records created by the application's validated boundary. */
export function recordIncident(record: SyncRecord): Incident {
  const details = record.fields.details as Omit<Incident, 'id' | 'version' | 'status' | 'assignedTechnicianId'>;
  const work = record.fields.work as Pick<Incident, 'status' | 'assignedTechnicianId'>;
  return { ...details, ...work, id: record.id, version: record.version,
    notes: record.fields.notes as NonNullable<Incident['notes']>,
    evidence: record.fields.evidence as NonNullable<Incident['evidence']>,
    ...(typeof record.fields.priority === 'string' ? { priority: record.fields.priority } : {}),
  };
}
