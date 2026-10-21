import type { SyncRecord } from '../../domain/sync/SyncRecord';

/** JSON objects ignore key order; arrays preserve item order. Inputs are JSON. */
function sameJson(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') {
    return false;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right)
      && left.length === right.length
      && left.every((value, index) => sameJson(value, right[index]));
  }
  const leftObject = left as Readonly<Record<string, unknown>>;
  const rightObject = right as Readonly<Record<string, unknown>>;
  const keys = Object.keys(leftObject);
  return keys.length === Object.keys(rightObject).length
    && keys.every((key) => Object.prototype.hasOwnProperty.call(rightObject, key)
      && sameJson(leftObject[key], rightObject[key]));
}

function hasField(record: SyncRecord, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(record.fields, field);
}

function sameField(left: SyncRecord, right: SyncRecord, field: string): boolean {
  return hasField(left, field) === hasField(right, field)
    && (!hasField(left, field) || sameJson(left.fields[field], right.fields[field]));
}

/** Three-way merge of whole fields, including additions and deletions. */
export function resolveSync(
  base: SyncRecord,
  local: SyncRecord,
  remote: SyncRecord,
): Readonly<
  { kind: 'merged'; fields: Readonly<Record<string, unknown>> }
  | { kind: 'conflict'; fields: readonly string[] }
> {
  const fields = [...new Set([
    ...Object.keys(base.fields), ...Object.keys(local.fields), ...Object.keys(remote.fields),
  ])].sort();
  const conflicts: string[] = [];
  const merged: [string, unknown][] = [];

  for (const field of fields) {
    const localChanged = !sameField(base, local, field);
    const remoteChanged = !sameField(base, remote, field);
    if (localChanged && remoteChanged && !sameField(local, remote, field)) {
      conflicts.push(field);
      continue;
    }
    const source = localChanged ? local : remote;
    if (hasField(source, field)) merged.push([field, source.fields[field]]);
  }

  return conflicts.length > 0
    ? { kind: 'conflict', fields: conflicts }
    : { kind: 'merged', fields: Object.fromEntries(merged) };
}
