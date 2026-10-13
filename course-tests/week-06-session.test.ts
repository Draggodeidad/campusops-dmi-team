import type { IncidentTransport, TransportRequest, TransportResponse } from '../src/infrastructure/http/IncidentTransport';
import type { SessionSecretStore } from '../src/application/session/SessionSecretStore';
import { AuthenticatedIncidentTransport } from '../src/infrastructure/http/AuthenticatedIncidentTransport';
import { ApplicationFailure } from '../src/application/errors/ApplicationFailure';

class MemorySecretStore implements SessionSecretStore {
  private secret: string | null = null;

  async save(secret: string): Promise<void> {
    this.secret = secret;
  }

  async read(): Promise<string | null> {
    return this.secret;
  }

  async clear(): Promise<void> {
    this.secret = null;
  }
}

class ControlledTransportMock implements IncidentTransport {
  public requestLog: { method: string; path: string; headers?: Record<string, string> | undefined }[] = [];
  public refreshEndpointCalls = 0;
  public failRefresh = false;

  async send(request: TransportRequest): Promise<TransportResponse> {
    this.requestLog.push({
      method: request.method,
      path: request.path,
      headers: request.headers ? { ...request.headers } : undefined,
    });

    const authHeader = request.headers?.authorization;

    // Refresh endpoint handler
    if (request.path === '/v1/session/refresh') {
      this.refreshEndpointCalls++;
      if (this.failRefresh) {
        return {
          status: 401,
          headers: { 'content-type': 'application/json' },
          bodyText: JSON.stringify({ code: 'invalid_grant' }),
        };
      }
      return {
        status: 200,
        headers: { 'content-type': 'application/json' },
        bodyText: JSON.stringify({
          accessToken: 'new-valid-course-token',
          refreshToken: 'course-refresh-1',
          expiresIn: 60,
        }),
      };
    }

    // Normal endpoints: require valid token
    if (authHeader !== 'Bearer new-valid-course-token') {
      return {
        status: 401,
        headers: { 'content-type': 'application/json' },
        bodyText: JSON.stringify({ code: 'unauthorized' }),
      };
    }

    if (request.path === '/v1/incidents') {
      return {
        status: 200,
        headers: { 'content-type': 'application/json' },
        bodyText: JSON.stringify({ items: [{ id: 'campus-inc-001', version: 1, status: 'open' }] }),
      };
    }

    if (request.path === '/v1/incidents/campus-inc-001') {
      return {
        status: 200,
        headers: { 'content-type': 'application/json' },
        bodyText: JSON.stringify({ id: 'campus-inc-001', version: 1, status: 'open' }),
      };
    }

    if (request.path === '/v1/resources') {
      return {
        status: 200,
        headers: { 'content-type': 'application/json' },
        bodyText: JSON.stringify({ items: [{ id: 'resource-1', version: 1 }] }),
      };
    }

    return {
      status: 404,
      headers: { 'content-type': 'application/json' },
      bodyText: JSON.stringify({ code: 'not_found' }),
    };
  }
}

describe('Semana 6 — Sesión segura: 3 peticiones, 1 solo refresh (#35)', () => {
  it('Caso A: Coalesce 3 peticiones concurrentes en 1 solo refresh y reintenta con 200 OK', async () => {
    const logs: string[] = [];
    const mockTransport = new ControlledTransportMock();
    const secretStore = new MemorySecretStore();
    await secretStore.save('initial-expired-token');

    const authTransport = new AuthenticatedIncidentTransport({
      transport: mockTransport,
      secretStore,
      initialAccessToken: 'initial-expired-token',
      initialRefreshToken: 'course-refresh-0',
      logger: (msg) => {
        logs.push(msg);
        console.log(msg);
      },
    });

    expect(authTransport.getSessionState()).toBe('authenticated');

    // Lanzar 3 peticiones casi al mismo tiempo (concurrentes)
    const [res1, res2, res3] = await Promise.all([
      authTransport.send({ method: 'GET', path: '/v1/incidents' }),
      authTransport.send({ method: 'GET', path: '/v1/incidents/campus-inc-001' }),
      authTransport.send({ method: 'GET', path: '/v1/resources' }),
    ]);

    // Verificaciones:
    // 1. Exactamente 1 llamada a refresh
    expect(authTransport.getRefreshCount()).toBe(1);
    expect(mockTransport.refreshEndpointCalls).toBe(1);

    // 2. Las 3 respuestas finales son 200 OK
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res3.status).toBe(200);

    // 3. El nuevo token se guardó en el SessionSecretStore
    expect(await secretStore.read()).toBe('new-valid-course-token');
    expect(authTransport.getAccessToken()).toBe('new-valid-course-token');
    expect(authTransport.getSessionState()).toBe('authenticated');

    // 4. Se observaron los eventos de 401, 1 refresh y 3 retries
    expect(logs).toContain('[A] 401');
    expect(logs).toContain('[B] 401');
    expect(logs).toContain('[C] 401');
    expect(logs).toContain('[AUTH] REFRESH START');
    expect(logs).toContain('[AUTH] REFRESH SUCCESS');
    expect(logs).toContain('[A] RETRY');
    expect(logs).toContain('[B] RETRY');
    expect(logs).toContain('[C] RETRY');
    expect(logs).toContain('[A] RESULT');
    expect(logs).toContain('[B] RESULT');
    expect(logs).toContain('[C] RESULT');
  });

  it('Caso B: Manejo seguro ante refresh fallido, limpieza de tokens y regreso a sesión anónima', async () => {
    const logs: string[] = [];
    const mockTransport = new ControlledTransportMock();
    mockTransport.failRefresh = true; // Simular que el refresh token fue revocado o expiró
    const secretStore = new MemorySecretStore();
    await secretStore.save('expired-token');

    let sessionStateChangedTo: string | null = null;

    const authTransport = new AuthenticatedIncidentTransport({
      transport: mockTransport,
      secretStore,
      initialAccessToken: 'expired-token',
      initialRefreshToken: 'revoked-refresh-token',
      onSessionStateChange: (state) => {
        sessionStateChangedTo = state;
      },
      logger: (msg) => {
        logs.push(msg);
        console.log(msg);
      },
    });

    // 3 peticiones concurrentes con refresh fallido
    const results = await Promise.allSettled([
      authTransport.send({ method: 'GET', path: '/v1/incidents' }),
      authTransport.send({ method: 'GET', path: '/v1/incidents/campus-inc-001' }),
      authTransport.send({ method: 'GET', path: '/v1/resources' }),
    ]);

    // Verificaciones:
    // 1. Exactamente 1 llamada de refresh
    expect(authTransport.getRefreshCount()).toBe(1);
    expect(mockTransport.refreshEndpointCalls).toBe(1);

    // 2. Todas las peticiones fueron rechazadas con ApplicationFailure
    expect(results[0].status).toBe('rejected');
    expect(results[1].status).toBe('rejected');
    expect(results[2].status).toBe('rejected');

    if (results[0].status === 'rejected') {
      expect(results[0].reason).toBeInstanceOf(ApplicationFailure);
      expect((results[0].reason as ApplicationFailure).code).toBe('INVALID_SESSION_SECRET');
    }

    // 3. Tokens eliminados del almacén seguro
    expect(await secretStore.read()).toBeNull();
    expect(authTransport.getAccessToken()).toBeNull();
    expect(authTransport.getRefreshToken()).toBeNull();

    // 4. Estado de sesión transiciona a 'anonymous' (login required)
    expect(authTransport.getSessionState()).toBe('anonymous');
    expect(sessionStateChangedTo).toBe('anonymous');

    // 5. Logs confirman limpieza y terminación sin bucle
    expect(logs).toContain('[AUTH] REFRESH START');
    expect(logs).toContain('[AUTH] REFRESH FAIL');
    expect(logs).toContain('[SESSION] CLEAR');
    expect(logs).toContain('[AUTH] ANONYMOUS');
    expect(logs).toContain('[LOGIN] REQUIRED');
  });

  it('Caso C: Protección contra bucle infinito (retry único)', async () => {
    const mockTransport: IncidentTransport = {
      send: async () => ({
        status: 401,
        headers: {},
        bodyText: JSON.stringify({ code: 'unauthorized' }),
      }),
    };

    const authTransport = new AuthenticatedIncidentTransport({
      transport: mockTransport,
      initialAccessToken: 'bad-token',
      initialRefreshToken: 'refresh-token',
    });

    // Si el refresh endpoint devuelve 200 pero el reintento vuelve a dar 401, no debe volver a reintentar
    const refreshSpy = jest.spyOn(mockTransport, 'send').mockImplementation(async (req) => {
      if (req.path === '/v1/session/refresh') {
        return {
          status: 200,
          headers: {},
          bodyText: JSON.stringify({ accessToken: 'new-token' }),
        };
      }
      return {
        status: 401,
        headers: {},
        bodyText: JSON.stringify({ code: 'still_unauthorized' }),
      };
    });

    const res = await authTransport.send({ method: 'GET', path: '/v1/incidents' });

    // La respuesta final es el 401 del reintento sin provocar un segundo refresh
    expect(res.status).toBe(401);
    expect(authTransport.getRefreshCount()).toBe(1);
    refreshSpy.mockRestore();
  });

  it('Caso D: Protección explícita del endpoint de refresh ante 401 (sin autorefresh recursivo)', async () => {
    const mockTransport: IncidentTransport = {
      send: async (req) => {
        if (req.path === '/v1/session/refresh') {
          return {
            status: 401,
            headers: {},
            bodyText: JSON.stringify({ code: 'invalid_grant' }),
          };
        }
        return { status: 200, headers: {}, bodyText: '{}' };
      },
    };

    const authTransport = new AuthenticatedIncidentTransport({
      transport: mockTransport,
      initialAccessToken: 'token',
      initialRefreshToken: 'refresh-token',
    });

    // Llamar directamente al refresh endpoint
    const res = await authTransport.send({ method: 'POST', path: '/v1/session/refresh' });

    expect(res.status).toBe(401);
    // No debe haber entrado al interceptor de refresh (refreshCount se mantiene en 0)
    expect(authTransport.getRefreshCount()).toBe(0);
  });
});
