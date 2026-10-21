import { HttpIncidentSyncGateway } from '../src/infrastructure/sync/HttpIncidentSyncGateway';
import { SessionTransportDecorator } from '../src/infrastructure/http/SessionTransportDecorator';
import type { SessionAuthorizationContext } from '../src/application/session/SessionAuthorizationContext';
import { createDeferred } from './fixtures/week-06/deferred';

const operation = { operationId: 'w08-gateway-start', incidentId: 'campus-inc-001', actorId: 'technician-1', baseVersion: 1, action: 'start', payload: {} };
const identity = { actorId: operation.actorId, generation: 1 };
function receipt() {
  return { operationId: operation.operationId, duplicate: false, incident: {
    id: operation.incidentId, version: 2, status: 'in_progress', payload: {
      category: 'equipment', description: 'Equipo sintético', location: 'Zona ficticia', assignedTechnicianId: operation.actorId,
      notes: [], evidence: [], history: [{ operationId: operation.operationId, actorId: operation.actorId, action: 'start', version: 2 }],
    },
  } };
}

test.each(['operation', 'actor', 'action', 'resource', 'version', 'effect', 'history'] as const)('rejects a successful HTTP response with a mismatching %s receipt', async field => {
  const response = receipt();
  if (field === 'operation') response.operationId = 'another-operation';
  if (field === 'actor') response.incident.payload.history[0]!.actorId = 'technician-2';
  if (field === 'action') response.incident.payload.history[0]!.action = 'resolve';
  if (field === 'resource') response.incident.id = 'another-incident';
  if (field === 'version') response.incident.version = 3;
  if (field === 'effect') response.incident.status = 'assigned';
  if (field === 'history') response.incident.payload.history = [];
  const gateway = new HttpIncidentSyncGateway({ async send() { return { status: 200, headers: {}, bodyText: JSON.stringify(response) }; } });
  await expect(gateway.apply(operation, identity)).rejects.toMatchObject({ code: 'SYNC_CONFIRMATION_INVALID' });
});

test('a verified response preserves assignment and the exact queued request', async () => {
  const send = jest.fn(async () => ({ status: 201, headers: {}, bodyText: JSON.stringify(receipt()) }));
  const gateway = new HttpIncidentSyncGateway({ send });
  await expect(gateway.apply(operation, identity)).resolves.toMatchObject({ incident: { assignedTechnicianId: operation.actorId, version: 2 } });
  expect(send).toHaveBeenCalledWith(expect.objectContaining({ session: identity,
    headers: { 'idempotency-key': operation.operationId }, body: JSON.stringify({ action: 'start', baseVersion: 1 }) }));
  await expect(gateway.apply(operation, { ...identity, actorId: 'technician-2' })).rejects.toMatchObject({ code: 'UNAUTHORIZED_ACTION' });
  expect(send).toHaveBeenCalledTimes(1);
});

test('a queued request pinned before refresh never adopts a later login', async () => {
  let generation = 1;
  let actor = 'technician-1';
  const renewal = createDeferred<void>();
  const context: SessionAuthorizationContext = {
    getSnapshot: () => ({ state: 'expired', actorId: actor, role: 'technician', generation, expiresAt: 0 }),
    getGeneration: () => generation, getActorId: () => actor, getAuthorizationHeader: () => 'Bearer course-valid-token',
    refresh: () => renewal.promise, invalidate: async () => {},
  };
  const send = jest.fn(async () => ({ status: 201, headers: {}, bodyText: '{}' }));
  const transport = new SessionTransportDecorator({ send }, context);
  const pending = transport.send({ method: 'POST', path: '/v1/incidents/campus-inc-001/actions', session: identity });
  actor = 'technician-2'; generation++;
  renewal.resolve();
  await expect(pending).resolves.toMatchObject({ status: 401 });
  await expect(transport.send({ method: 'POST', path: '/v1/incidents/campus-inc-001/actions', session: identity })).resolves.toMatchObject({ status: 401 });
  expect(send).not.toHaveBeenCalled();
});
