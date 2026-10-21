import { deduplicateOperations } from '../src/application/sync/deduplicateOperations';
import { resolveSync } from '../src/application/sync/resolveSync';
import type { SyncRecord } from '../src/domain/sync/SyncRecord';
import { createWeek08Scenario } from './fixtures/week-08/scenario';

function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

function record(fields: SyncRecord['fields'], version = 1): SyncRecord {
  return { id: 'campus-inc-001', version, fields };
}

type MergeCase = Readonly<{
  name: string;
  base: SyncRecord['fields'];
  local: SyncRecord['fields'];
  remote: SyncRecord['fields'];
  expected: ReturnType<typeof resolveSync>;
}>;

const cases: readonly MergeCase[] = [
  { name: 'empty records', base: {}, local: {}, remote: {},
    expected: { kind: 'merged', fields: {} } },
  { name: 'no changes despite nested object key order and new references',
    base: { details: { a: 1, b: [null, { c: false, d: 'same' }] } },
    local: { details: { b: [null, { d: 'same', c: false }], a: 1 } },
    remote: { details: { b: [null, { c: false, d: 'same' }], a: 1 } },
    expected: { kind: 'merged', fields: { details: { a: 1, b: [null, { c: false, d: 'same' }] } } } },
  { name: 'local-only change', base: { title: 'A' }, local: { title: 'Local' }, remote: { title: 'A' },
    expected: { kind: 'merged', fields: { title: 'Local' } } },
  { name: 'remote-only change', base: { title: 'A' }, local: { title: 'A' }, remote: { title: 'Remote' },
    expected: { kind: 'merged', fields: { title: 'Remote' } } },
  { name: 'independent changes', base: { title: 'A', priority: 1 },
    local: { title: 'Local', priority: 1 }, remote: { title: 'A', priority: 2 },
    expected: { kind: 'merged', fields: { title: 'Local', priority: 2 } } },
  { name: 'same structural change with different key order', base: { details: { old: true } },
    local: { details: { a: 1, nested: [{ b: 2, c: null }] } },
    remote: { details: { nested: [{ c: null, b: 2 }], a: 1 } },
    expected: { kind: 'merged', fields: { details: { a: 1, nested: [{ b: 2, c: null }] } } } },
  { name: 'different array order conflicts', base: { items: [] },
    local: { items: [1, 2] }, remote: { items: [2, 1] },
    expected: { kind: 'conflict', fields: ['items'] } },
  { name: 'array and object are different JSON values', base: {},
    local: { items: [] }, remote: { items: {} },
    expected: { kind: 'conflict', fields: ['items'] } },
  { name: 'scalar types are distinct', base: { priority: null },
    local: { priority: 1 }, remote: { priority: '1' },
    expected: { kind: 'conflict', fields: ['priority'] } },
  { name: 'null differs from an empty object', base: {}, local: { details: null }, remote: { details: {} },
    expected: { kind: 'conflict', fields: ['details'] } },
  { name: 'independent additions', base: {}, local: { a: false }, remote: { b: 0 },
    expected: { kind: 'merged', fields: { a: false, b: 0 } } },
  { name: 'local deletion and remote addition', base: { title: 'A' }, local: {}, remote: { title: 'A', note: null },
    expected: { kind: 'merged', fields: { note: null } } },
  { name: 'remote deletion', base: { title: 'A' }, local: { title: 'A' }, remote: {},
    expected: { kind: 'merged', fields: {} } },
  { name: 'both delete the same field', base: { title: 'A' }, local: {}, remote: {},
    expected: { kind: 'merged', fields: {} } },
  { name: 'delete versus edit conflicts', base: { title: 'A' }, local: {}, remote: { title: 'Remote' },
    expected: { kind: 'conflict', fields: ['title'] } },
  { name: 'null is a value, not deletion', base: { title: 'A' }, local: {}, remote: { title: null },
    expected: { kind: 'conflict', fields: ['title'] } },
  { name: 'conflicts are sorted by field name; compatible fields are not conflicts',
    base: { z: 0, a: 0, m: 0, unchanged: true },
    local: { z: 1, a: 1, m: 1, unchanged: true, localOnly: true },
    remote: { unchanged: true, m: 2, z: 2, a: 2 },
    expected: { kind: 'conflict', fields: ['a', 'm', 'z'] } },
  { name: 'nested siblings in the same field remain atomic', base: { work: { assigned: 'one', status: 'assigned' } },
    local: { work: { assigned: 'one', status: 'in_progress' } },
    remote: { work: { assigned: 'two', status: 'assigned' } },
    expected: { kind: 'conflict', fields: ['work'] } },
];

test.each(cases)('$name (frozen inputs, both branch orders)', ({ base, local, remote, expected }) => {
  const records = freeze([record(base), record(local), record(remote, 2)] as const);
  const before = JSON.stringify(records);
  expect(resolveSync(...records)).toEqual(expected);
  // Merge policy is symmetric; version is metadata, never a last-write-wins rule.
  expect(resolveSync(records[0], records[2], records[1])).toEqual(expected);
  expect(JSON.stringify(records)).toBe(before);
});

test('all own JSON keys, including __proto__, survive without changing prototypes', () => {
  const fields = JSON.parse('{"__proto__":{"kept":true},"constructor":"synthetic"}') as SyncRecord['fields'];
  const result = resolveSync(record({}), record(fields), record({}));
  expect(result).toEqual({ kind: 'merged', fields });
  if (result.kind !== 'merged') throw new Error('Expected a merge');
  expect(Object.getPrototypeOf(result.fields)).toBe(Object.prototype);
  expect(Object.prototype.hasOwnProperty.call(result.fields, '__proto__')).toBe(true);
});

test('required reassignment conflicts only on work and preserves the original pending intention', () => {
  const scenario = freeze(createWeek08Scenario('file:///synthetic.svg'));
  const pending = freeze([scenario.operation, scenario.noteOperation, scenario.photoOperation]);
  const before = JSON.stringify({ scenario, pending });
  expect(resolveSync(scenario.base, scenario.local, scenario.remote)).toEqual({ kind: 'conflict', fields: ['work'] });
  expect(deduplicateOperations([...pending, scenario.operation])).toEqual(pending);
  expect(scenario.remote.fields.work).toEqual({ assignedTechnicianId: 'technician-2', status: 'assigned' });
  expect(scenario.local.fields.work).toEqual({ assignedTechnicianId: 'technician-1', status: 'in_progress' });
  expect(scenario.operation).toMatchObject({ operationId: 'w08-start-001', baseVersion: 1, action: 'start' });
  expect(JSON.stringify({ scenario, pending })).toBe(before);
});

test('dedupe keeps first objects, exact IDs and insertion order even for divergent replay content', () => {
  const first = { operationId: 'op-2', payload: { value: 1 } };
  const second = { operationId: 'op-1', payload: { value: 2 } };
  const special = { operationId: '__proto__', payload: {} };
  const differentCase = { operationId: 'OP-2', payload: {} };
  const operations = freeze([first, second, { operationId: 'op-2', payload: { value: 99 } },
    special, { operationId: 'op-1', payload: { value: 3 } }, differentCase, special]);
  const before = JSON.stringify(operations);
  const result = deduplicateOperations(operations);
  expect(result).toEqual([first, second, special, differentCase]);
  expect(result[0]).toBe(first);
  expect(result[1]).toBe(second);
  expect(result[2]).toBe(special);
  expect(result[3]).toBe(differentCase);
  expect(result).not.toBe(operations);
  expect(deduplicateOperations(result)).toEqual(result);
  expect(JSON.stringify(operations)).toBe(before);
});

test('dedupe accepts an empty readonly list', () => {
  expect(deduplicateOperations(freeze([]))).toEqual([]);
});
