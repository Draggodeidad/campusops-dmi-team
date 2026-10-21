import type { IncidentCategory, IncidentStatus } from '../../../campusops/contracts';
import type { Incident } from '../../../domain/incidents/Incident';
import type { RemoteIncidentEnvelopeDto } from './IncidentDto';

const VALID_CATEGORIES = new Set<string>([
  'electrical',
  'laboratory',
  'water',
  'connectivity',
  'equipment',
  'safety',
  'maintenance',
]);

const VALID_STATUSES = new Set<string>([
  'open',
  'assigned',
  'in_progress',
  'resolved',
  'closed',
]);

function deriveTitle(description: string, id: string): string {
  if (description.length <= 40) {
    return description;
  }
  const truncated = description.slice(0, 37).trim();
  return `${truncated}...`;
}

/**
 * Maps a validated remote resource envelope to the internal domain Incident.
 * Returns null if payload is null (valid envelope without payload fields)
 * or if mandatory domain fields are missing or invalid.
 */
export function mapDtoToIncident(envelope: RemoteIncidentEnvelopeDto): Incident | null {
  if (envelope.payload === null) {
    return null;
  }

  const payload = envelope.payload as Record<string, unknown>;

  const category = payload.category;
  if (typeof category !== 'string' || !VALID_CATEGORIES.has(category)) {
    return null;
  }

  const status = envelope.status;
  if (typeof status !== 'string' || !VALID_STATUSES.has(status)) {
    return null;
  }

  const description = payload.description;
  if (typeof description !== 'string' || description.trim().length === 0) {
    return null;
  }

  const location = payload.location;
  if (typeof location !== 'string' || location.trim().length === 0) {
    return null;
  }

  const assigned = payload.assignedTechnicianId;
  const reporter = payload.reporterId;
  if (assigned !== undefined && assigned !== null && typeof assigned !== 'string') return null;
  if (reporter !== undefined && typeof reporter !== 'string') return null;
  const notes = payload.notes;
  const evidence = payload.evidence;
  if (notes !== undefined && (!Array.isArray(notes) || !notes.every(item => item && typeof item === 'object'
    && typeof item.actorId === 'string' && typeof item.text === 'string'))) return null;
  if (evidence !== undefined && (!Array.isArray(evidence) || !evidence.every(item => item && typeof item === 'object'
    && typeof item.actorId === 'string' && typeof item.evidenceId === 'string'))) return null;
  if (payload.priority !== undefined && typeof payload.priority !== 'string') return null;

  return {
    id: envelope.id,
    version: envelope.version,
    ...(assigned === undefined ? {} : { assignedTechnicianId: assigned }),
    ...(reporter === undefined ? {} : { reporterId: reporter }),
    ...(notes === undefined ? {} : { notes: notes as readonly Readonly<{ actorId: string; text: string }>[] }),
    ...(evidence === undefined ? {} : { evidence: evidence as readonly Readonly<{ actorId: string; evidenceId: string }>[] }),
    ...(payload.priority === undefined ? {} : { priority: payload.priority as string }),
    title: deriveTitle(description, envelope.id),
    description,
    category: category as IncidentCategory,
    status: status as IncidentStatus,
    locationLabel: location,
  };
}
