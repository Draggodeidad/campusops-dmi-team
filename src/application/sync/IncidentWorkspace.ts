import type { PendingIncidentOperation } from '../../campusops/contracts';
import type { Incident } from '../../domain/incidents/Incident';
import type { SyncRecord } from '../../domain/sync/SyncRecord';
import { ApplicationFailure } from '../errors/ApplicationFailure';
import type { LocalIncidentSnapshot } from '../persistence/LocalIncidentSnapshot';
import type { LocalWorkspace } from '../persistence/LocalWorkspace';
import type { SessionController } from '../session/SessionController';
import type { SessionSnapshot } from '../session/SessionSnapshot';
import { deduplicateOperations } from './deduplicateOperations';
import { resolveSync } from './resolveSync';
import { incidentRecord, recordIncident } from './incidentRecord';
import type { IncidentSyncGateway, RemoteIncidentState, SyntheticPhoto, SyntheticPhotoSource } from './IncidentSyncGateway';

type Identity = SessionSnapshot & { actorId: string };
type OperationState = NonNullable<LocalIncidentSnapshot['operationStates']>[string];
export type LocalIncidentView = Readonly<{
  incident: Incident;
  notes: LocalIncidentSnapshot['notes'];
  photos: LocalIncidentSnapshot['photos'];
  operations: readonly Readonly<{ operation: PendingIncidentOperation; state: OperationState }>[];
}>;
export type LocalChange = Readonly<
  { action: 'start' } | { action: 'comment'; text: string }
  | { action: 'add_evidence'; photo?: SyntheticPhoto }
>;
export type ConflictReview = Readonly<{
  incident: Incident; originalStatus: string; fields: readonly string[]; reviewed: boolean;
}>;
const active = (snapshot: LocalIncidentSnapshot, operation: PendingIncidentOperation) =>
  !['reviewed', 'superseded'].includes(snapshot.operationStates?.[operation.operationId]?.state ?? 'pending');

/** Serializes workflows, not just SQL calls, so sync cannot overwrite a newer local change. */
export class IncidentWorkspace {
  private tail: Promise<unknown> = Promise.resolve();
  constructor(
    private readonly workspace: LocalWorkspace,
    private readonly session: SessionController,
    private readonly gateway: IncidentSyncGateway,
    private readonly photos: SyntheticPhotoSource,
    private readonly nextId: () => string,
  ) {}

  private identity(): Identity {
    const snapshot = this.session.getSnapshot();
    if (!snapshot.actorId || !['authenticated', 'expired', 'refreshing'].includes(snapshot.state)) {
      throw new ApplicationFailure('SESSION_EXPIRED', 'Inicia sesión con la cuenta original para consultar sus cambios.');
    }
    return snapshot as Identity;
  }
  private check(identity: Identity): void {
    const current = this.identity();
    if (identity.generation !== current.generation || identity.actorId !== current.actorId) {
      throw new ApplicationFailure('SESSION_EXPIRED', 'La sesión cambió; los pendientes conservan su autor original.');
    }
  }
  private run<T>(task: (identity: Identity) => Promise<T>): Promise<T> {
    let identity: Identity;
    try { identity = this.identity(); } catch (error) { return Promise.reject(error); }
    const next = this.tail.then(async () => {
      this.check(identity);
      await this.workspace.open();
      this.check(identity);
      const result = await task(identity);
      this.check(identity);
      return result;
    }).catch((error: unknown) => {
      if (error instanceof ApplicationFailure) throw error;
      throw new ApplicationFailure('LOCAL_STORAGE_UNAVAILABLE', 'No fue posible guardar o recuperar los cambios locales. Reintenta; la cola se conserva.');
    });
    this.tail = next.catch(() => undefined);
    return next;
  }
  private async owned(id: string, identity: Identity): Promise<LocalIncidentSnapshot> {
    const snapshot = await this.workspace.getSnapshot(id);
    this.check(identity);
    if (!snapshot || snapshot.ownerActorId !== identity.actorId) {
      throw new ApplicationFailure('UNAUTHORIZED_ACTION', 'No hay una copia local disponible para esta cuenta.');
    }
    return snapshot;
  }
  private state(snapshot: LocalIncidentSnapshot, operationId: string, state: OperationState): LocalIncidentSnapshot {
    return { ...snapshot, operationStates: { ...snapshot.operationStates, [operationId]: state } };
  }
  private async view(snapshot: LocalIncidentSnapshot): Promise<LocalIncidentView> {
    const pending = await this.workspace.pending.listPending();
    return { incident: recordIncident(snapshot.local), notes: snapshot.notes, photos: snapshot.photos,
      operations: pending.filter(op => op.incidentId === snapshot.base.id && op.actorId === snapshot.ownerActorId)
        .map(operation => ({ operation, state: snapshot.operationStates?.[operation.operationId] ?? { state: 'pending' } })),
    };
  }

  /** Cache only an authorized response; never replace another actor's outstanding intention. */
  cache(incident: Incident): Promise<void> {
    return this.run(async identity => {
      const previous = await this.workspace.getSnapshot(incident.id);
      const pending = await this.workspace.pending.listPending();
      this.check(identity);
      if (pending.some(op => op.incidentId === incident.id)) return;
      const record = incidentRecord(incident);
      await this.workspace.saveSnapshot({ ownerActorId: identity.actorId, base: record, local: record,
        notes: previous?.ownerActorId === identity.actorId ? previous.notes : [],
        photos: previous?.ownerActorId === identity.actorId ? previous.photos : [],
        ...(previous?.ownerActorId === identity.actorId && previous.confirmedOperations ? { confirmedOperations: previous.confirmedOperations } : {}),
      });
    });
  }

  recover(): Promise<readonly LocalIncidentView[]> {
    return this.run(async identity => {
      const snapshots = await this.workspace.listSnapshots();
      const views: LocalIncidentView[] = [];
      for (const snapshot of snapshots) {
        if (snapshot.ownerActorId === identity.actorId) views.push(await this.view(snapshot));
      }
      return views;
    });
  }

  /** Existing start button: persist first, then attempt synchronization, including when offline. */
  async start(incidentId: string, expectedVersion: number, operationId?: string): Promise<Incident> {
    const identity = this.identity();
    const alreadyRecorded = await this.run(async current => {
      let snapshot = await this.workspace.getSnapshot(incidentId);
      if (!snapshot || snapshot.ownerActorId !== current.actorId) {
        const remote = await this.gateway.read(incidentId, current);
        this.check(current);
        const pending = await this.workspace.pending.listPending();
        if (pending.some(op => op.incidentId === incidentId)) throw new ApplicationFailure('VERSION_CONFLICT', 'Hay una intención previa que requiere revisión.');
        snapshot = { ownerActorId: current.actorId, base: remote.record, local: remote.record, notes: [], photos: [] };
        await this.workspace.saveSnapshot(snapshot);
      }
      if (operationId) {
        const pending = await this.workspace.pending.listPending();
        const existing = [...pending, ...(snapshot.confirmedOperations ?? [])].find(op => op.operationId === operationId);
        if (existing) {
          if (existing.incidentId !== incidentId || existing.actorId !== current.actorId || existing.action !== 'start'
            || existing.baseVersion !== expectedVersion || Object.keys(existing.payload).length !== 0) {
            throw new ApplicationFailure('INVALID_INCIDENT_INPUT', 'Una identidad existente no puede usarse con otro contenido.');
          }
          return true;
        }
      }
      if (snapshot.local.version !== expectedVersion) throw new ApplicationFailure('VERSION_CONFLICT', 'Actualiza la copia local antes de iniciar.');
      return false;
    });
    this.check(identity);
    if (!alreadyRecorded) await this.record(incidentId, { action: 'start' }, operationId);
    this.check(identity);
    const synchronized = await this.synchronize();
    this.check(identity);
    return synchronized.find(view => view.incident.id === incidentId)!.incident;
  }

  record(incidentId: string, change: LocalChange, requestedId?: string): Promise<LocalIncidentView> {
    return this.run(async identity => {
      let snapshot = await this.owned(incidentId, identity);
      const incident = recordIncident(snapshot.local);
      this.authorize(incident, identity, change.action);
      if (change.action === 'start' && incident.status !== 'assigned') {
        throw new ApplicationFailure('VERSION_CONFLICT', 'El inicio local requiere una incidencia asignada.');
      }
      if (change.action === 'comment' && !change.text.trim()) {
        throw new ApplicationFailure('INVALID_INCIDENT_INPUT', 'Escribe una nota antes de guardarla.');
      }
      const operationId = requestedId ?? this.nextId();
      if (operationId.length < 8) throw new ApplicationFailure('INVALID_INCIDENT_INPUT', 'La identidad de operación debe tener al menos ocho caracteres.');
      const photo = change.action === 'add_evidence' ? change.photo ?? await this.photos.prepare() : undefined;
      this.check(identity);
      const payload = change.action === 'comment' ? { text: change.text.trim() }
        : change.action === 'add_evidence' ? { evidenceId: `${operationId}-photo` } : {};
      const operation: PendingIncidentOperation = { operationId, incidentId, baseVersion: snapshot.base.version,
        actorId: identity.actorId, action: change.action, payload };
      const known = [...await this.workspace.pending.listPending(),
        ...(await this.workspace.listSnapshots()).flatMap(saved => saved.confirmedOperations ?? [])];
      if (known.some(saved => saved.operationId === operationId)) {
        throw new ApplicationFailure('INVALID_INCIDENT_INPUT', 'La identidad de esta operación ya está registrada.');
      }
      this.check(identity);
      snapshot = { ...this.state(snapshot, operationId, { state: 'pending' }),
        local: this.applyIntent(snapshot.local, operation),
        notes: change.action === 'comment' ? [...snapshot.notes, { noteId: `${operationId}-note`, operationId, actorId: identity.actorId, text: change.text.trim() }] : snapshot.notes,
        photos: photo ? [...snapshot.photos, { evidenceId: String(payload.evidenceId), operationId, actorId: identity.actorId, ...photo }] : snapshot.photos,
      };
      await this.workspace.commitChange(snapshot, operation);
      return this.view((await this.workspace.getSnapshot(incidentId))!);
    });
  }

  private authorize(incident: Incident, identity: Identity, action: string): void {
    const allowed = action === 'start'
      ? identity.role === 'technician' && incident.assignedTechnicianId === identity.actorId
      : identity.role === 'coordinator' || (identity.role === 'technician' && incident.assignedTechnicianId === identity.actorId)
        || (identity.role === 'reporter' && incident.reporterId === identity.actorId);
    if (!allowed) throw new ApplicationFailure('UNAUTHORIZED_ACTION', 'La sesión no está autorizada para guardar esta intención.');
  }
  private applyIntent(record: SyncRecord, operation: PendingIncidentOperation): SyncRecord {
    const incident = recordIncident(record);
    const fields = { ...record.fields };
    if (operation.action === 'start') fields.work = { assignedTechnicianId: incident.assignedTechnicianId, status: 'in_progress' };
    if (operation.action === 'comment') fields.notes = [...(incident.notes ?? []), { actorId: operation.actorId, text: operation.payload.text }];
    if (operation.action === 'add_evidence') fields.evidence = [...(incident.evidence ?? []), { actorId: operation.actorId, evidenceId: operation.payload.evidenceId }];
    return { ...record, fields };
  }

  /** One explicit cycle; at most two identical sends per operation on transient failure. */
  synchronize(): Promise<readonly LocalIncidentView[]> {
    return this.run(async identity => {
      const operations = deduplicateOperations(await this.workspace.pending.listPending());
      const stopped = new Set<string>();
      const processed = new Set<string>();
      for (const queued of operations) {
        let operation = queued;
        if (operation.actorId !== identity.actorId || stopped.has(operation.incidentId)) continue;
        let snapshot = await this.owned(operation.incidentId, identity);
        const replacementId = snapshot.operationStates?.[operation.operationId]?.replacementOperationId;
        if (replacementId) {
          const replacement = operations.find(op => op.operationId === replacementId && op.actorId === identity.actorId && op.incidentId === operation.incidentId);
          if (!replacement) continue;
          operation = replacement;
        }
        if (processed.has(operation.operationId)) continue;
        processed.add(operation.operationId);
        if (!active(snapshot, operation)) continue;
        try {
          const remote = await this.gateway.read(operation.incidentId, identity);
          this.check(identity);
          const receiptExists = remote.history.some(event => event.operationId === operation.operationId
            && event.actorId === operation.actorId && event.action === operation.action);
          const result = resolveSync(snapshot.base, snapshot.local, remote.record);
          snapshot = { ...snapshot, remote: remote.record, remoteReaderActorId: identity.actorId };
          if (!receiptExists && result.kind === 'conflict') {
            await this.workspace.saveSnapshot(this.state(snapshot, operation.operationId, { state: 'conflict', fields: result.fields }));
            stopped.add(operation.incidentId);
            continue;
          }
          // Compatible fields are presented locally; they do not authorize rewriting the queued body/version.
          if (result.kind === 'merged') snapshot = { ...snapshot, local: { ...snapshot.local, fields: result.fields } };
          let confirmed: RemoteIncidentState | undefined;
          for (let attempt = 0; attempt < 2; attempt++) {
            this.check(identity);
            try { confirmed = await this.gateway.apply(operation, identity); break; }
            catch (error) {
              if (attempt === 1 || !(error instanceof ApplicationFailure)
                || !['INCIDENT_TIMEOUT', 'REMOTE_COMMUNICATION_ERROR'].includes(error.code)) throw error;
            }
          }
          this.check(identity);
          if (!confirmed) throw new ApplicationFailure('SYNC_CONFIRMATION_INVALID', 'No se recibió confirmación.');
          const remaining = (await this.workspace.pending.listPending()).filter(op => op.incidentId === operation.incidentId
            && op.operationId !== operation.operationId && active(snapshot, op));
          snapshot = { ...snapshot, remote: confirmed.record, remoteReaderActorId: identity.actorId,
            confirmedOperations: deduplicateOperations([...(snapshot.confirmedOperations ?? []), operation]),
            ...(remaining.length === 0 ? { base: confirmed.record, local: confirmed.record } : {}),
          };
          // Save first: if this write or acknowledge fails, replay remains possible with the original body.
          await this.workspace.saveSnapshot(snapshot);
          this.check(identity);
          await this.workspace.pending.acknowledge(operation.operationId);
        } catch (error) {
          this.check(identity);
          if (!(error instanceof ApplicationFailure)) throw error;
          const state = error.code === 'UNAUTHORIZED_ACTION' ? 'forbidden'
            : error.code === 'VERSION_CONFLICT' || error.code === 'SYNC_CONFIRMATION_INVALID' ? 'conflict' : 'retry';
          await this.workspace.saveSnapshot(this.state(snapshot, operation.operationId, { state,
            ...(state === 'forbidden' ? { fields: ['work'] } : {}),
          }));
          stopped.add(operation.incidentId);
        }
      }
      const snapshots = await this.workspace.listSnapshots();
      return Promise.all(snapshots.filter(snapshot => snapshot.ownerActorId === identity.actorId).map(snapshot => this.view(snapshot)));
    });
  }

  /** Authorized live read is mandatory before exposing remote assignment or reviewing another actor's conflict. */
  inspect(incidentId: string): Promise<ConflictReview> {
    return this.run(async identity => {
      const remote = await this.gateway.read(incidentId, identity);
      this.check(identity);
      const snapshot = await this.workspace.getSnapshot(incidentId);
      if (!snapshot || (snapshot.ownerActorId !== identity.actorId && identity.role !== 'coordinator')) {
        throw new ApplicationFailure('UNAUTHORIZED_ACTION', 'No hay un conflicto revisable para esta cuenta.');
      }
      const result = resolveSync(snapshot.base, snapshot.local, remote.record);
      const operations = (await this.workspace.pending.listPending()).filter(op => op.incidentId === incidentId && active(snapshot, op));
      let updated = { ...snapshot, remote: remote.record, remoteReaderActorId: identity.actorId };
      if (result.kind === 'conflict') {
        for (const operation of operations) updated = { ...updated, ...this.state(updated, operation.operationId, { state: 'conflict', fields: result.fields }) };
      }
      this.check(identity);
      await this.workspace.saveSnapshot(updated);
      return { incident: remote.incident, originalStatus: recordIncident(snapshot.local).status,
        fields: result.kind === 'conflict' ? result.fields : [], reviewed: operations.length === 0 };
    });
  }

  keepRemote(incidentId: string, expectedVersion: number): Promise<void> {
    return this.run(async identity => {
      const remote = await this.gateway.read(incidentId, identity);
      this.check(identity);
      if (remote.record.version !== expectedVersion) throw new ApplicationFailure('VERSION_CONFLICT', 'La incidencia cambió; vuelve a revisar la decisión.');
      let snapshot = await this.workspace.getSnapshot(incidentId);
      if (!snapshot || (identity.role !== 'coordinator' && snapshot.ownerActorId !== identity.actorId)) {
        throw new ApplicationFailure('UNAUTHORIZED_ACTION', 'No puedes resolver este conflicto.');
      }
      const operations = (await this.workspace.pending.listPending()).filter(op => op.incidentId === incidentId && active(snapshot!, op));
      if (!operations.some(op => ['conflict', 'forbidden'].includes(snapshot!.operationStates?.[op.operationId]?.state ?? ''))) {
        throw new ApplicationFailure('VERSION_CONFLICT', 'Primero inspecciona el conflicto.');
      }
      for (const operation of operations) {
        snapshot = { ...this.state(snapshot, operation.operationId, { state: 'reviewed' }),
          resolutions: [...(snapshot.resolutions ?? []), { operationId: operation.operationId, actorId: identity.actorId, decision: 'keep_remote' }],
        };
      }
      // Intention, file and original operation remain durable. This is not acknowledge.
      await this.workspace.saveSnapshot({ ...snapshot, remote: remote.record, remoteReaderActorId: identity.actorId });
    });
  }

  /** Explicit new intent on a freshly authorized base, retaining the original operation as an audit record. */
  reformulate(incidentId: string, operationId: string, expectedVersion: number): Promise<LocalIncidentView> {
    return this.run(async identity => {
      let snapshot = await this.owned(incidentId, identity);
      const operations = await this.workspace.pending.listPending();
      const original = operations.find(op => op.operationId === operationId && op.actorId === identity.actorId && op.incidentId === incidentId);
      if (!original || !active(snapshot, original)) throw new ApplicationFailure('INVALID_INCIDENT_INPUT', 'El pendiente no está disponible para reformular.');
      if (snapshot.operationStates?.[operationId]?.state !== 'conflict') {
        throw new ApplicationFailure('VERSION_CONFLICT', 'Primero confirma el conflicto; una respuesta perdida requiere replay original.');
      }
      const remote = await this.gateway.read(incidentId, identity);
      this.check(identity);
      if (remote.record.version !== expectedVersion || remote.history.some(event => event.operationId === operationId)) {
        throw new ApplicationFailure('VERSION_CONFLICT', 'Actualiza o confirma la operación original antes de reformular.');
      }
      this.authorize(remote.incident, identity, original.action);
      if (original.action === 'start' && remote.incident.status !== 'assigned') throw new ApplicationFailure('VERSION_CONFLICT', 'La transición ya no es válida.');
      const replacement = { ...original, operationId: this.nextId(), baseVersion: remote.record.version };
      let local = remote.record;
      for (const operation of operations) {
        if (operation.incidentId === incidentId && operation.actorId === identity.actorId && active(snapshot, operation)
          && operation.operationId !== operationId) local = this.applyIntent(local, operation);
      }
      local = this.applyIntent(local, replacement);
      snapshot = { ...this.state(snapshot, operationId, { state: 'superseded', replacementOperationId: replacement.operationId }),
        base: remote.record, local, remote: remote.record, remoteReaderActorId: identity.actorId,
        resolutions: [...(snapshot.resolutions ?? []), { operationId, actorId: identity.actorId, decision: 'reformulate', replacementOperationId: replacement.operationId }],
      };
      this.check(identity);
      await this.workspace.commitChange(snapshot, replacement);
      return this.view((await this.workspace.getSnapshot(incidentId))!);
    });
  }
}
