import { startLocalBackend, type LocalBackend } from './fixtures/week-06/localBackend';

type LoginBody = Readonly<{
  actorId: string;
  role: string;
  accessToken: string;
  refreshToken: string;
}>;

type IncidentBody = Readonly<{
  id: string;
  version: number;
  status: string;
  payload: Readonly<{ assignedTechnicianId: string | null }>;
}>;

let backend: LocalBackend;

beforeAll(async () => {
  backend = await startLocalBackend();
});

afterAll(async () => {
  await backend.stop();
});

async function login(actorId: string): Promise<LoginBody> {
  const response = await backend.request<LoginBody>('/v1/session/login', {
    method: 'POST',
    body: { actorId },
  });
  expect(response.status).toBe(200);
  return response.body;
}

test('local backend enforces reporter, technician and coordinator permissions without mutating rejected incidents', async () => {
  const reporter = await login('reporter-1');
  const technicianOne = await login('technician-1');
  const technicianTwo = await login('technician-2');
  const coordinator = await login('coordinator-1');

  expect(reporter.role).toBe('reporter');
  expect(technicianOne.role).toBe('technician');
  expect(technicianTwo.role).toBe('technician');
  expect(coordinator.role).toBe('coordinator');

  const created = await backend.request('/v1/incidents', {
    method: 'POST',
    actorId: 'reporter-1',
    accessToken: reporter.accessToken,
    idempotencyKey: 'w06-reporter-create-1',
    body: {
      category: 'water',
      description: 'Fuga ficticia para autorización W06',
      location: 'Zona de prueba W06',
    },
  });
  expect(created.status).toBe(201);

  const originalPath = '/v1/incidents/campus-inc-001';
  const originalActionPath = `${originalPath}/actions`;
  const beforeReporterDenials = await backend.request<IncidentBody>(originalPath, {
    actorId: 'reporter-1',
    accessToken: reporter.accessToken,
  });
  expect(beforeReporterDenials.status).toBe(200);

  for (const [action, key] of [
    ['resolve', 'w06-reporter-resolve'],
    ['close', 'w06-reporter-close'],
  ] as const) {
    const denied = await backend.request(originalActionPath, {
      method: 'POST',
      actorId: 'reporter-1',
      accessToken: reporter.accessToken,
      idempotencyKey: key,
      body: { action, baseVersion: beforeReporterDenials.body.version, diagnosis: 'Ficticio' },
    });
    expect(denied.status).toBe(403);
  }

  const afterReporterDenials = await backend.request<IncidentBody>(originalPath, {
    actorId: 'reporter-1',
    accessToken: reporter.accessToken,
  });
  expect(afterReporterDenials.body.version).toBe(beforeReporterDenials.body.version);
  expect(afterReporterDenials.body.status).toBe(beforeReporterDenials.body.status);

  const beforeForeignResolve = await backend.request<IncidentBody>(originalPath, {
    actorId: 'technician-1',
    accessToken: technicianOne.accessToken,
  });
  expect(beforeForeignResolve.status).toBe(200);
  const foreignResolve = await backend.request(originalActionPath, {
    method: 'POST',
    actorId: 'technician-2',
    accessToken: technicianTwo.accessToken,
    idempotencyKey: 'w06-technician-two-resolve',
    body: {
      action: 'resolve',
      baseVersion: beforeForeignResolve.body.version,
      diagnosis: 'Intento sintético no autorizado',
    },
  });
  expect(foreignResolve.status).toBe(403);

  const afterForeignResolve = await backend.request<IncidentBody>(originalPath, {
    actorId: 'technician-1',
    accessToken: technicianOne.accessToken,
  });
  expect(afterForeignResolve.body.version).toBe(beforeForeignResolve.body.version);
  expect(afterForeignResolve.body.status).toBe(beforeForeignResolve.body.status);

  const started = await backend.request<{ incident: IncidentBody }>(originalActionPath, {
    method: 'POST',
    actorId: 'technician-1',
    accessToken: technicianOne.accessToken,
    idempotencyKey: 'w06-technician-start',
    body: { action: 'start', baseVersion: afterForeignResolve.body.version },
  });
  expect(started.status).toBe(201);
  expect(started.body.incident.status).toBe('in_progress');

  const resolved = await backend.request<{ incident: IncidentBody }>(originalActionPath, {
    method: 'POST',
    actorId: 'technician-1',
    accessToken: technicianOne.accessToken,
    idempotencyKey: 'w06-technician-resolve',
    body: {
      action: 'resolve',
      baseVersion: started.body.incident.version,
      diagnosis: 'Reparación ficticia completada',
    },
  });
  expect(resolved.status).toBe(201);
  expect(resolved.body.incident.status).toBe('resolved');

  const staleClose = await backend.request(originalActionPath, {
    method: 'POST',
    actorId: 'coordinator-1',
    accessToken: coordinator.accessToken,
    idempotencyKey: 'w06-coordinator-stale-close',
    body: { action: 'close', baseVersion: started.body.incident.version },
  });
  expect(staleClose.status).toBe(409);
  const afterStaleClose = await backend.request<IncidentBody>(originalPath, {
    actorId: 'coordinator-1',
    accessToken: coordinator.accessToken,
  });
  expect(afterStaleClose.body.version).toBe(resolved.body.incident.version);
  expect(afterStaleClose.body.status).toBe('resolved');

  const closed = await backend.request<{ incident: IncidentBody }>(originalActionPath, {
    method: 'POST',
    actorId: 'coordinator-1',
    accessToken: coordinator.accessToken,
    idempotencyKey: 'w06-coordinator-close',
    body: { action: 'close', baseVersion: afterStaleClose.body.version },
  });
  expect(closed.status).toBe(201);
  expect(closed.body.incident.status).toBe('closed');

  const reopened = await backend.request<{ incident: IncidentBody }>(originalActionPath, {
    method: 'POST',
    actorId: 'coordinator-1',
    accessToken: coordinator.accessToken,
    idempotencyKey: 'w06-coordinator-reopen',
    body: { action: 'reopen', baseVersion: closed.body.incident.version },
  });
  expect(reopened.status).toBe(201);
  expect(reopened.body.incident.status).toBe('assigned');
  expect(reopened.body.incident.payload.assignedTechnicianId).toBe('technician-1');
});
