import { DefaultSessionController } from '../src/application/session/DefaultSessionController';
import type { SessionClock } from '../src/application/session/SessionClock';
import type { SessionProvider, SessionTokens } from '../src/application/session/SessionProvider';
import type { SessionSecretStore } from '../src/application/session/SessionSecretStore';
import { SessionTransportDecorator } from '../src/infrastructure/http/SessionTransportDecorator';
import type { IncidentTransport, TransportRequest, TransportResponse } from '../src/infrastructure/http/IncidentTransport';

class MemorySecretStore implements SessionSecretStore {
  public stored: string | null = null;
  public clearCalls = 0;
  public saveCalls = 0;

  async save(secret: string): Promise<void> {
    this.saveCalls++;
    this.stored = secret;
  }

  async read(): Promise<string | null> {
    return this.stored;
  }

  async clear(): Promise<void> {
    this.clearCalls++;
    this.stored = null;
  }
}

class FakeClock implements SessionClock {
  public currentTime = 1000;
  now(): number {
    return this.currentTime;
  }
}

class FakeProvider implements SessionProvider {
  public loginCalls = 0;
  public refreshCalls = 0;
  public failNextRefresh = false;

  async login(actorId: string): Promise<SessionTokens & { actorId: string; role: 'reporter' | 'technician' | 'coordinator' }> {
    this.loginCalls++;
    return {
      actorId,
      role: 'reporter',
      accessToken: 'token-initial',
      refreshToken: 'refresh-initial',
      expiresIn: 60,
    };
  }

  async refresh(_refreshToken: string): Promise<SessionTokens> {
    this.refreshCalls++;
    if (this.failNextRefresh) {
      throw new Error('Refresh rejected');
    }
    return {
      accessToken: 'token-renewed',
      refreshToken: 'refresh-renewed',
      expiresIn: 60,
    };
  }
}

describe('DefaultSessionController (Issue #37)', () => {
  let clock: FakeClock;
  let store: MemorySecretStore;
  let provider: FakeProvider;
  let controller: DefaultSessionController;

  beforeEach(() => {
    clock = new FakeClock();
    store = new MemorySecretStore();
    provider = new FakeProvider();
    controller = new DefaultSessionController(provider, store, clock);
  });

  it('inicia en estado anonymous con generación 0', () => {
    const snap = controller.getSnapshot();
    expect(snap.state).toBe('anonymous');
    expect(snap.actorId).toBeNull();
    expect(snap.role).toBeNull();
    expect(snap.generation).toBe(0);
  });

  it('inicia sesión, incrementa generación y persiste en SecureStore con schemaVersion 1', async () => {
    await controller.login('reporter-1');
    const snap = controller.getSnapshot();

    expect(snap.state).toBe('authenticated');
    expect(snap.actorId).toBe('reporter-1');
    expect(snap.role).toBe('reporter');
    expect(snap.generation).toBe(1);
    expect(snap.expiresAt).toBe(1000 + 60 * 1000);

    expect(store.stored).not.toBeNull();
    const parsed = JSON.parse(store.stored!);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.actorId).toBe('reporter-1');
    expect(parsed.accessToken).toBe('token-initial');
  });

  it('detecta expiración en getSnapshot cuando clock.now() >= expiresAt', async () => {
    await controller.login('reporter-1');
    clock.currentTime = 1000 + 60 * 1000 + 1;

    const snap = controller.getSnapshot();
    expect(snap.state).toBe('expired');
  });

  it('coalesce llamadas concurrentes a refresh en una sola ejecución del proveedor', async () => {
    await controller.login('reporter-1');
    const p1 = controller.refresh(1);
    const p2 = controller.refresh(1);
    const p3 = controller.refresh(1);

    await Promise.all([p1, p2, p3]);

    expect(provider.refreshCalls).toBe(1);
    expect(controller.getAuthorizationHeader()).toBe('Bearer token-renewed');
  });

  it('logout incrementa generación, purga SecureStore y vuelve a anonymous', async () => {
    await controller.login('reporter-1');
    await controller.logout();

    const snap = controller.getSnapshot();
    expect(snap.state).toBe('anonymous');
    expect(snap.actorId).toBeNull();
    expect(snap.generation).toBe(2);
    expect(store.stored).toBeNull();
    expect(store.clearCalls).toBe(1);
  });

  it('restaura sesión válida no expirada al arrancar', async () => {
    store.stored = JSON.stringify({
      schemaVersion: 1,
      actorId: 'technician-1',
      role: 'technician',
      accessToken: 'token-stored',
      refreshToken: 'refresh-stored',
      expiresAt: 200000,
    });

    clock.currentTime = 1000;
    await controller.restore();

    const snap = controller.getSnapshot();
    expect(snap.state).toBe('authenticated');
    expect(snap.actorId).toBe('technician-1');
    expect(snap.role).toBe('technician');
  });

  it('purga y permanece anónimo si los datos almacenados están expirados', async () => {
    store.stored = JSON.stringify({
      schemaVersion: 1,
      actorId: 'technician-1',
      role: 'technician',
      accessToken: 'token-stored',
      refreshToken: 'refresh-stored',
      expiresAt: 500,
    });

    clock.currentTime = 1000;
    await controller.restore();

    const snap = controller.getSnapshot();
    expect(snap.state).toBe('anonymous');
    expect(store.stored).toBeNull();
  });
});

describe('SessionTransportDecorator (Issue #37)', () => {
  it('inyecta cabeceras de autorización y actor activo, captura 401 y reintenta con nuevo token', async () => {
    const clock = new FakeClock();
    const store = new MemorySecretStore();
    const provider = new FakeProvider();
    const controller = new DefaultSessionController(provider, store, clock);
    await controller.login('reporter-1');

    let requestCount = 0;
    const baseTransport: IncidentTransport = {
      async send(req: TransportRequest): Promise<TransportResponse> {
        requestCount++;
        if (req.path === '/v1/incidents') {
          if (req.headers?.authorization === 'Bearer token-initial') {
            return { status: 401, headers: {}, bodyText: '{"code":"unauthorized"}' };
          }
          if (req.headers?.authorization === 'Bearer token-renewed') {
            return { status: 200, headers: {}, bodyText: '{"items":[]}' };
          }
        }
        return { status: 200, headers: {}, bodyText: '{}' };
      },
    };

    const decorator = new SessionTransportDecorator(baseTransport, controller);

    const resp = await decorator.send({ method: 'GET', path: '/v1/incidents' });

    expect(resp.status).toBe(200);
    expect(requestCount).toBe(2);
    expect(provider.refreshCalls).toBe(1);
  });
});
