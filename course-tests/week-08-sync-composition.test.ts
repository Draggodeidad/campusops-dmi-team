import { createGraph } from '../App';
import { deduplicateOperations, resolveSync } from '../src/course-evaluation';
import { createWeek08Scenario } from './fixtures/week-08/scenario';

test('real composition and evaluation expose the same engine and preserve a pending reassignment conflict', () => {
  const graph = createGraph();
  const scenario = createWeek08Scenario('file:///synthetic.svg');
  const operations = [scenario.operation, scenario.noteOperation, scenario.photoOperation];
  const before = JSON.stringify({ scenario, operations });

  expect(graph.syncEngine.resolveSync).toBe(resolveSync);
  expect(graph.syncEngine.deduplicateOperations).toBe(deduplicateOperations);
  expect(graph.syncEngine.resolveSync(scenario.snapshot.base, scenario.snapshot.local, scenario.remote))
    .toEqual({ kind: 'conflict', fields: ['work'] });
  const pending = graph.syncEngine.deduplicateOperations([...operations, scenario.operation]);
  expect(pending).toEqual(operations);
  expect(pending[0]).toBe(scenario.operation);
  expect(JSON.stringify({ scenario, operations })).toBe(before);
});

test('composed engine combines compatible JSON changes without sending or acknowledging operations', () => {
  const send = jest.fn(() => { throw new Error('Pure sync engine must not send requests'); });
  const graph = createGraph({ useHttp: true, transport: { send } });
  const base = { id: 'campus-inc-001', version: 1, fields: { details: { a: 1, b: 2 }, priority: 1 } };
  const local = { ...base, fields: { details: { b: 2, a: 1 }, priority: 2 } };
  const remote = { ...base, version: 2, fields: { details: { a: 3, b: 2 }, priority: 1 } };
  expect(graph.syncEngine.resolveSync(base, local, remote))
    .toEqual({ kind: 'merged', fields: { details: { a: 3, b: 2 }, priority: 2 } });
  expect(send).not.toHaveBeenCalled();
});
