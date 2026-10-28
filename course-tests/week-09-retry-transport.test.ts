import { IncidentRetryExecutor, type RetryAttemptMetric } from '../src/infrastructure/http/IncidentRetryExecutor';
import { SystemResilienceClock } from '../src/infrastructure/http/SystemResilienceClock';
import { SessionTransportDecorator } from '../src/infrastructure/http/SessionTransportDecorator';
import { HttpIncidentRepository } from '../src/infrastructure/incidents/HttpIncidentRepository';
import type { SessionAuthorizationContext } from '../src/application/session/SessionAuthorizationContext';
import { DEFAULT_RETRY_CONFIGURATION, type RetryConfiguration } from '../src/application/resilience/RetryPolicy';
import type { IncidentTransport, TransportRequest } from '../src/infrastructure/http/IncidentTransport';
import type { ResilienceClock } from '../src/application/resilience/ResilienceClock';
import { createVirtualClock } from './fixtures/week-09/virtualClock';

const response = (status: number, headers = {}, bodyText = '{}') => ({ status, headers, bodyText });
const request: TransportRequest = { method: 'GET', path: '/v1/incidents/campus-inc-001' };
function setup(base: IncidentTransport, config: RetryConfiguration = DEFAULT_RETRY_CONFIGURATION, clock: ResilienceClock = createVirtualClock()) {
  let generation = 1; let token = 'Bearer course-valid-token';
  const metrics: RetryAttemptMetric[] = [];
  const refresh = jest.fn(async () => { token = 'Bearer synthetic-renewed-token'; });
  const context: SessionAuthorizationContext = {
    getSnapshot: () => ({ state: 'authenticated', actorId: 'technician-1', role: 'technician', generation, expiresAt: Infinity }),
    getGeneration: () => generation, getActorId: () => 'technician-1', getAuthorizationHeader: () => token,
    refresh, invalidate: jest.fn(async () => {}),
  };
  return { metrics, context, refresh, clock, changeSession: () => { generation++; },
    transport: new SessionTransportDecorator(base, context, new IncidentRetryExecutor(clock, config, metric => metrics.push(metric))) };
}

test.each(['0.8', 'invalid', 'Infinity', '-1'])('GET 429 header %s waits safely before repository success', async header => {
  const clock = createVirtualClock(); const times: number[] = [];
  const send = jest.fn(async () => { times.push(clock.now()); return times.length === 1
    ? response(429, { 'ReTrY-AfTeR': header }) : response(200, {}, '{"items":[]}'); });
  const { transport, metrics } = setup({ send }, undefined, clock);
  await expect(new HttpIncidentRepository(transport).findAll()).resolves.toEqual([]);
  expect(clock.delays).toEqual([header === '0.8' ? 800 : 250]);
  expect(times[1]! - times[0]!).toBe(clock.delays[0]);
  expect(metrics.map(m => [m.attempt, m.status])).toEqual([[1, 429], [2, 200]]);
});
test('HTTP date and normalized milliseconds use the same policy', async () => {
  const clock = createVirtualClock();
  const send = jest.fn().mockResolvedValueOnce(response(429, { 'retry-after': new Date(clock.now() + 2000).toUTCString() }))
    .mockResolvedValueOnce({ ...response(503), retryAfterMs: 600 }).mockResolvedValue(response(200));
  await setup({ send }, undefined, clock).transport.send(request);
  expect(clock.delays).toEqual([2000, 600]);
});
test('transient errors stop after four actual sends, with one progressive wait between sends', async () => {
  const send = jest.fn(async () => response(503)); const clock = createVirtualClock();
  const { transport, metrics } = setup({ send }, undefined, clock);
  await expect(transport.send(request)).resolves.toMatchObject({ status: 503 });
  expect(send).toHaveBeenCalledTimes(4); expect(clock.delays).toEqual([250, 500, 1000]);
  expect(metrics.map(m => m.attempt)).toEqual([1, 2, 3, 4]);
});
test('POST without stable identity, offline, conflict and validation errors do not retry', async () => {
  const send = jest.fn(async () => response(503)); const clock = createVirtualClock();
  const { transport } = setup({ send }, undefined, clock);
  await transport.send({ ...request, method: 'POST', path: `${request.path}/actions`, body: '{}' });
  expect(send).toHaveBeenCalledTimes(1); expect(clock.delays).toEqual([]);
  send.mockRejectedValueOnce(new TypeError('Synthetic offline'));
  await expect(transport.send(request)).rejects.toThrow('Synthetic offline');
  expect(send).toHaveBeenCalledTimes(2);
  for (const status of [400, 403, 409, 422]) {
    send.mockResolvedValueOnce(response(status)); await transport.send(request);
  }
  expect(send).toHaveBeenCalledTimes(6); expect(clock.delays).toEqual([]);
});
test('server delay outside cap or time budget stops without sleeping or truncating', async () => {
  for (const header of ['6', '0.8']) {
    const clock = createVirtualClock();
    const send = jest.fn(async () => { clock.advance(600); return response(429, { 'retry-after': header }); });
    const config = { ...DEFAULT_RETRY_CONFIGURATION, maxDelayMs: 1000, maxElapsedMs: 1000 };
    await setup({ send }, config, clock).transport.send(request);
    expect(send).toHaveBeenCalledTimes(1); expect(clock.delays).toEqual([]);
  }
});
test('request durations consume budget and each timeout uses only remaining time', async () => {
  const clock = createVirtualClock(); const limits: number[] = [];
  const send = jest.fn(async (req: TransportRequest) => {
    limits.push(req.timeoutMs!); clock.advance(400); return response(500);
  });
  const config = { ...DEFAULT_RETRY_CONFIGURATION, baseDelayMs: 100, maxDelayMs: 500, maxElapsedMs: 1000 };
  await setup({ send }, config, clock).transport.send({ ...request, timeoutMs: 800 });
  expect(limits).toEqual([800, 500]); expect(clock.delays).toEqual([100]);
});
test('W06 replay consumes the same four-send budget and retains body and key', async () => {
  const codes = [503, 401, 503, 200]; const writes: TransportRequest[] = [];
  const { transport, refresh, metrics } = setup({ async send(req) { writes.push(req); return response(codes.shift()!); } });
  const body = '{"action":"resolve","baseVersion":2,"diagnosis":"Sintético"}';
  const post: TransportRequest = { ...request, method: 'POST', path: `${request.path}/actions`, body,
    headers: { 'Idempotency-Key': 'stable-synthetic-operation' } };
  await expect(transport.send(post)).resolves.toMatchObject({ status: 200 });
  expect(writes).toHaveLength(4); expect(refresh).toHaveBeenCalledTimes(1);
  expect(metrics.map(m => m.attempt)).toEqual([1, 2, 3, 4]);
  expect(writes.every(r => r.body === body && r.headers?.['Idempotency-Key'] === post.headers?.['Idempotency-Key'])).toBe(true);
  expect(writes.map(r => r.headers?.authorization)).toEqual([
    'Bearer course-valid-token', 'Bearer course-valid-token', 'Bearer synthetic-renewed-token', 'Bearer synthetic-renewed-token',
  ]);
});
test('exhaustion before auth replay never opens another retry loop', async () => {
  const codes = [503, 503, 503, 401]; const send = jest.fn(async () => response(codes.shift()!));
  const { transport } = setup({ send });
  await expect(transport.send(request)).rejects.toMatchObject({ code: 'RETRY_BUDGET_EXHAUSTED' });
  expect(send).toHaveBeenCalledTimes(4);
});
test('a session change during sleep stops all further sends', async () => {
  const clock = createVirtualClock(); const sleep = clock.sleep;
  const send = jest.fn(async () => response(503)); const app = setup({ send }, undefined, clock);
  clock.sleep = async ms => { await sleep(ms); app.changeSession(); };
  await expect(app.transport.send({ ...request, session: { actorId: 'technician-1', generation: 1 } }))
    .rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
  expect(send).toHaveBeenCalledTimes(1);
});
test('nonincident paths and session endpoints are never retried', async () => {
  const send = jest.fn(async () => response(503)); const { transport } = setup({ send });
  for (const path of ['/v1/session/login', '/health', '/api/?q=synthetic', '/v1/incidents/one/unrelated']) {
    await transport.send({ method: 'GET', path });
  }
  expect(send).toHaveBeenCalledTimes(4);
});
test('metrics contain only sanitized technical fields even with hostile content and logger failure', async () => {
  const send = jest.fn(async () => { throw new Error('token=sensitive; body=private'); });
  const { transport, metrics } = setup({ send });
  await expect(transport.send({ ...request, method: 'POST', body: 'private body',
    headers: { authorization: 'secret', 'x-correlation-id': 'private comment', 'idempotency-key': 'private-synthetic-key' } })).rejects.toThrow();
  expect(metrics).toEqual([{ correlationId: 'w09-request-1', incidentId: 'campus-inc-001', method: 'POST', status: 'offline', attempt: 1, durationMs: 0 }]);
  const executor = new IncidentRetryExecutor(createVirtualClock(), undefined, () => { throw new Error('logger failed'); });
  await expect(executor.forRequest({ async send() { return response(200); } }, request, async r => r).send(request)).resolves.toMatchObject({ status: 200 });
});
test('invalid, backward, early or oversleeping clocks cannot trigger a replay', async () => {
  const send = jest.fn(async () => response(503));
  const invalid = { now: () => Infinity, sleep: async () => {} };
  await expect(setup({ send }, undefined, invalid).transport.send(request)).rejects.toMatchObject({ code: 'RETRY_BUDGET_EXHAUSTED' });
  expect(send).not.toHaveBeenCalled();
  for (const behavior of ['early', 'backward', 'oversleep'] as const) {
    send.mockClear(); const clock = createVirtualClock(); let offset = 0;
    const modified: ResilienceClock = { now: () => clock.now() + offset,
      async sleep() { if (behavior === 'backward') offset = -1; if (behavior === 'oversleep') clock.advance(20000); } };
    await expect(setup({ send }, undefined, modified).transport.send(request)).rejects.toMatchObject({ code: 'RETRY_BUDGET_EXHAUSTED' });
    expect(send).toHaveBeenCalledTimes(1);
  }
});
test('POST caller mutation during wait cannot change path, identity, session or serialized body', async () => {
  const clock = createVirtualClock(); const sleep = clock.sleep; const writes: TransportRequest[] = [];
  const mutable = { method: 'POST' as const, path: `${request.path}/actions`, body: '{"baseVersion":1}',
    headers: { 'idempotency-key': 'stable-original-operation' }, session: { actorId: 'technician-1', generation: 1 } };
  const app = setup({ async send(req) { writes.push(req); return response(writes.length === 1 ? 503 : 200); } }, undefined, clock);
  clock.sleep = async ms => { mutable.path = '/v1/incidents/other/actions'; mutable.body = 'changed';
    mutable.headers['idempotency-key'] = 'changed-operation'; mutable.session.actorId = 'technician-2'; await sleep(ms); };
  await app.transport.send(mutable);
  expect(writes).toHaveLength(2);
  expect(writes.every(req => req.path === `${request.path}/actions` && req.body === '{"baseVersion":1}'
    && req.headers?.['idempotency-key'] === 'stable-original-operation' && req.session?.actorId === 'technician-1')).toBe(true);
});
test('timeouts remain distinguishable after exhaustion and a POST obeys Retry-After', async () => {
  const clock = createVirtualClock(); const error = new Error('Synthetic timeout'); error.name = 'TimeoutError';
  const send = jest.fn().mockResolvedValueOnce(response(429, { 'retry-after': '0.8' })).mockRejectedValue(error);
  const app = setup({ send }, undefined, clock);
  await expect(app.transport.send({ ...request, method: 'POST', body: '{}', headers: { 'idempotency-key': 'stable-original-operation' } }))
    .rejects.toMatchObject({ name: 'TimeoutError' });
  expect(send).toHaveBeenCalledTimes(4); expect(clock.delays).toEqual([800, 500, 1000]);
  expect(app.metrics.map(metric => metric.status)).toEqual([429, 'timeout', 'timeout', 'timeout']);
});
test('refresh time and actual request durations share the elapsed budget', async () => {
  const clock = createVirtualClock(); const send = jest.fn(async () => response(401));
  const app = setup({ send }, { ...DEFAULT_RETRY_CONFIGURATION, maxDelayMs: 1000, maxElapsedMs: 1000 }, clock);
  app.refresh.mockImplementation(async () => { clock.advance(1000); });
  await expect(app.transport.send(request)).rejects.toMatchObject({ code: 'RETRY_BUDGET_EXHAUSTED' });
  expect(send).toHaveBeenCalledTimes(1);
});
test.each(['key', 'duplicate', 'version', 'status', 'history', 'diagnosis', 'resource'] as const)(
  'online resolution rejects a successful but mismatching %s confirmation without retry', async field => {
    const key = 'resolve-synthetic-operation';
    const receipt = { operationId: key, duplicate: true, incident: { id: 'campus-inc-001', version: 3, status: 'resolved',
      payload: { category: 'equipment', description: 'Equipo sintético', location: 'Zona ficticia', diagnosis: 'Diagnóstico sintético',
        assignedTechnicianId: 'technician-1', history: [{ operationId: key, action: 'resolve', version: 3 }] } } };
    if (field === 'key') receipt.operationId = 'different-operation';
    if (field === 'duplicate') Object.assign(receipt, { duplicate: 'true' });
    if (field === 'version') receipt.incident.version = 4;
    if (field === 'status') receipt.incident.status = 'in_progress';
    if (field === 'history') receipt.incident.payload.history = [];
    if (field === 'diagnosis') receipt.incident.payload.diagnosis = 'Otro diagnóstico';
    if (field === 'resource') receipt.incident.id = 'campus-inc-002';
    const send = jest.fn(async () => response(200, {}, JSON.stringify(receipt)));
    const { transport } = setup({ send });
    await expect(new HttpIncidentRepository(transport).performAction({ incidentId: 'campus-inc-001', baseVersion: 2, action: 'resolve',
      diagnosis: 'Diagnóstico sintético', idempotencyKey: key })).rejects.toMatchObject({ code: 'UPDATE_INCIDENT_FAILED', reason: 'contract' });
    expect(send).toHaveBeenCalledTimes(1);
  });
test.each(['key', 'content'] as const)('creation rejects a successful but mismatching %s receipt', async field => {
  const key = 'create-synthetic-operation';
  const send = jest.fn(async () => response(201, {}, JSON.stringify({ operationId: field === 'key' ? 'other-operation' : key,
    duplicate: false, incident: { id: 'campus-inc-002', version: 1, status: 'open', payload: {
      category: 'water', description: field === 'content' ? 'Otra descripción' : 'Fuga sintética', location: 'Zona ficticia',
    } } })));
  await expect(new HttpIncidentRepository(setup({ send }).transport).create({ category: 'water', description: 'Fuga sintética',
    locationLabel: 'Zona ficticia', idempotencyKey: key })).rejects.toMatchObject({ code: 'CREATE_INCIDENT_FAILED', reason: 'contract' });
  expect(send).toHaveBeenCalledTimes(1);
});
test('system clock completes the minimum wait when a native timer callback arrives one millisecond early', async () => {
  jest.useFakeTimers();
  try {
    const clock = new SystemResilienceClock(); const started = clock.now();
    const schedule = global.setTimeout;
    jest.spyOn(global, 'setTimeout').mockImplementationOnce((callback, delay, ...args) =>
      schedule(callback, Math.max(0, (delay ?? 0) - 1), ...args));
    const times: number[] = [];
    const app = setup({ async send() { times.push(clock.now()); return response(times.length === 1 ? 429 : 200,
      times.length === 1 ? { 'retry-after': '0.25' } : {}); } }, undefined, clock);
    const outcome = app.transport.send(request).catch((error: unknown) => error);
    await jest.advanceTimersByTimeAsync(249);
    expect(times).toEqual([started]);
    await jest.advanceTimersByTimeAsync(1);
    await expect(outcome).resolves.toMatchObject({ status: 200 });
    expect(times).toEqual([started, started + 250]);
  } finally { jest.restoreAllMocks(); jest.useRealTimers(); }
});
test('system wait stops a scheduler that repeatedly wakes before its deadline', async () => {
  jest.useFakeTimers();
  try {
    const schedule = global.setTimeout;
    const timer = jest.spyOn(global, 'setTimeout').mockImplementation((callback, _delay, ...args) => schedule(callback, 0, ...args));
    const outcome = new SystemResilienceClock().sleep(250).catch((error: unknown) => error);
    await jest.advanceTimersByTimeAsync(10);
    await expect(outcome).resolves.toMatchObject({ message: 'Timer did not complete the minimum wait' });
    expect(timer.mock.calls.length).toBeLessThanOrEqual(4);
    expect(jest.getTimerCount()).toBe(0);
  } finally { jest.restoreAllMocks(); jest.useRealTimers(); }
});
