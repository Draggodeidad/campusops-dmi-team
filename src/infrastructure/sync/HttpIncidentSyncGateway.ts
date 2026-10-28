import { ApplicationFailure } from '../../application/errors/ApplicationFailure';
import type { IncidentSyncGateway, RemoteIncidentState, SyncIdentity, IncidentHistoryEntry } from '../../application/sync/IncidentSyncGateway';
import { incidentRecord } from '../../application/sync/incidentRecord';
import type { PendingIncidentOperation } from '../../campusops/contracts';
import type { IncidentTransport, TransportResponse } from '../http/IncidentTransport';
import { parseRemoteResource } from '../incidents/parseRemoteResource';
import { mapDtoToIncident } from '../incidents/dto/IncidentDtoMapper';

function invalid(): never {
  throw new ApplicationFailure('SYNC_CONFIRMATION_INVALID', 'El servidor no confirmó la operación exacta; se conserva pendiente.', 'contract');
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}
function remoteState(value: unknown, incidentId: string): RemoteIncidentState {
  const parsed = parseRemoteResource(value);
  if (!parsed.ok || parsed.value.id !== incidentId) return invalid();
  const incident = mapDtoToIncident(parsed.value);
  if (!incident || incident.assignedTechnicianId === undefined) return invalid();
  const payload = object(parsed.value.payload);
  if (!Array.isArray(payload.history)) return invalid();
  const history: IncidentHistoryEntry[] = payload.history.map(value => {
    const entry = object(value);
    if (typeof entry.operationId !== 'string' || typeof entry.actorId !== 'string'
      || typeof entry.action !== 'string' || !Number.isSafeInteger(entry.version)) return invalid();
    return { operationId: entry.operationId, actorId: entry.actorId, action: entry.action, version: Number(entry.version) };
  });
  const record = incidentRecord(incident);
  // Preserve fields used by the three-way merge; history is receipt metadata.
  return { incident, history, record: { ...record, fields: {
    ...record.fields, notes: payload.notes ?? [], evidence: payload.evidence ?? [], priority: payload.priority ?? null,
  } } };
}

export class HttpIncidentSyncGateway implements IncidentSyncGateway {
  constructor(private readonly transport: IncidentTransport) {}

  private async send(request: Parameters<IncidentTransport['send']>[0]): Promise<TransportResponse> {
    let response: TransportResponse;
    try { response = await this.transport.send(request); }
    catch (error) {
      if (error instanceof ApplicationFailure) throw error;
      throw new ApplicationFailure(error instanceof Error && error.name === 'TimeoutError' ? 'INCIDENT_TIMEOUT' : 'REMOTE_COMMUNICATION_ERROR',
        'Sin confirmación de red; los cambios siguen guardados.');
    }
    if (response.status === 401) throw new ApplicationFailure('SESSION_EXPIRED', 'Renueva la sesión original para sincronizar.');
    if (response.status === 403) throw new ApplicationFailure('UNAUTHORIZED_ACTION', 'El servidor denegó el acceso; se conserva la intención para revisión.');
    if (response.status === 409) throw new ApplicationFailure('VERSION_CONFLICT', 'La versión o la transición cambió; revisa el pendiente.');
    if (response.status !== 200 && response.status !== 201) {
      throw new ApplicationFailure('UPDATE_INCIDENT_FAILED', 'El servidor no confirmó el cambio; se conserva pendiente.', 'server');
    }
    return response;
  }

  private decode(response: TransportResponse): unknown {
    try { return JSON.parse(response.bodyText) as unknown; } catch { return invalid(); }
  }

  async read(incidentId: string, identity: SyncIdentity): Promise<RemoteIncidentState> {
    const response = await this.send({ method: 'GET', path: `/v1/incidents/${encodeURIComponent(incidentId)}`, session: identity });
    return remoteState(this.decode(response), incidentId);
  }

  async apply(operation: PendingIncidentOperation, identity: SyncIdentity): Promise<RemoteIncidentState> {
    if (identity.actorId !== operation.actorId) throw new ApplicationFailure('UNAUTHORIZED_ACTION', 'La operación pertenece a otra sesión.');
    const response = await this.send({ method: 'POST', path: `/v1/incidents/${encodeURIComponent(operation.incidentId)}/actions`,
      headers: { 'idempotency-key': operation.operationId }, session: identity,
      body: JSON.stringify({ ...operation.payload, action: operation.action, baseVersion: operation.baseVersion }),
    });
    const receipt = object(this.decode(response));
    if (receipt.operationId !== operation.operationId || typeof receipt.duplicate !== 'boolean') return invalid();
    const state = remoteState(receipt.incident, operation.incidentId);
    const event = state.history.find(entry => entry.operationId === operation.operationId);
    if (!event || event.actorId !== operation.actorId || event.action !== operation.action
      || event.version !== operation.baseVersion + 1 || state.record.version !== event.version) return invalid();
    const payload = object(object(receipt.incident).payload);
    if (operation.action === 'start' && (state.incident.status !== 'in_progress' || state.incident.assignedTechnicianId !== operation.actorId)) return invalid();
    if (operation.action === 'resolve' && (state.incident.status !== 'resolved' || payload.diagnosis !== operation.payload.diagnosis
      || state.incident.assignedTechnicianId !== operation.actorId)) return invalid();
    if (operation.action === 'close' && state.incident.status !== 'closed') return invalid();
    if (operation.action === 'comment' && (!Array.isArray(payload.notes)
      || !payload.notes.some(value => { const note = object(value); return note.actorId === operation.actorId && note.text === operation.payload.text; }))) return invalid();
    if (operation.action === 'add_evidence' && (!Array.isArray(payload.evidence)
      || !payload.evidence.some(value => { const photo = object(value); return photo.actorId === operation.actorId && photo.evidenceId === operation.payload.evidenceId; }))) return invalid();
    return state;
  }
}
