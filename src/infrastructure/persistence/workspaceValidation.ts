import type { PendingIncidentOperation } from '../../campusops/contracts';
import type { LocalIncidentSnapshot } from '../../application/persistence/LocalIncidentSnapshot';

export class WorkspaceError extends Error {
  constructor(readonly code: 'INVALID_DATA' | 'CLOSED' | 'VERSION' | 'IDENTITY_CONFLICT' | 'STORAGE') {
    super(`Local workspace: ${code}`);
    this.name = 'WorkspaceError';
  }
}

export function requireData(condition: unknown): asserts condition {
  if (!condition) throw new WorkspaceError('INVALID_DATA');
}

/** Canonical JSON rejects lossy JS values, exotic objects and secret keys. */
export function canonicalJson(value: unknown, ancestors = new Set<object>()): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  requireData(typeof value === 'object' && value !== null && !ancestors.has(value));
  requireData(Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
  requireData(Object.getOwnPropertySymbols(value).length === 0);
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return `[${Array.from(value, item => canonicalJson(item, ancestors)).join(',')}]`;
    }
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(key => {
      requireData(!/token|password|authorization|secret/i.test(key));
      return `${JSON.stringify(key)}:${canonicalJson(record[key], ancestors)}`;
    }).join(',')}}`;
  } finally { ancestors.delete(value); }
}

const nonempty = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
const version = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0;

export function validateOperation(operation: PendingIncidentOperation): void {
  requireData(operation && nonempty(operation.operationId) && nonempty(operation.incidentId)
    && nonempty(operation.actorId) && nonempty(operation.action) && version(operation.baseVersion));
  requireData(operation.payload && typeof operation.payload === 'object' && !Array.isArray(operation.payload));
  canonicalJson(operation);
}

export function validateSnapshot(snapshot: LocalIncidentSnapshot): void {
  requireData(snapshot?.base && snapshot.local && nonempty(snapshot.base.id)
    && snapshot.base.id === snapshot.local.id && version(snapshot.base.version) && version(snapshot.local.version));
  for (const record of [snapshot.base, snapshot.local]) {
    requireData(record.fields && typeof record.fields === 'object' && !Array.isArray(record.fields));
  }
  requireData(Array.isArray(snapshot.notes) && Array.isArray(snapshot.photos));
  const noteIds = new Set<string>();
  for (const note of snapshot.notes) {
    requireData(nonempty(note.noteId) && nonempty(note.operationId) && nonempty(note.actorId)
      && typeof note.text === 'string' && !noteIds.has(note.noteId));
    noteIds.add(note.noteId);
  }
  const photoIds = new Set<string>();
  for (const photo of snapshot.photos) {
    requireData(nonempty(photo.evidenceId) && nonempty(photo.operationId) && nonempty(photo.actorId)
      && nonempty(photo.localUri) && nonempty(photo.mediaType) && version(photo.byteLength)
      && !photoIds.has(photo.evidenceId));
    photoIds.add(photo.evidenceId);
  }
  canonicalJson(snapshot);
}
