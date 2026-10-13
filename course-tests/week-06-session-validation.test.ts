import * as SecureStore from 'expo-secure-store';

import { ApplicationFailure } from '../src/application/errors/ApplicationFailure';
import { DefaultSessionController } from '../src/application/session/DefaultSessionController';
import type { SessionClock } from '../src/application/session/SessionClock';
import type { SessionProvider, SessionTokens } from '../src/application/session/SessionProvider';
import type { SessionSecretStore } from '../src/application/session/SessionSecretStore';
import type { IncidentTransport, TransportRequest } from '../src/infrastructure/http/IncidentTransport';
import { SessionTransportDecorator } from '../src/infrastructure/http/SessionTransportDecorator';
import { ExpoSecureSessionSecretStore } from '../src/infrastructure/session/ExpoSecureSessionSecretStore';
import { HttpSessionProvider } from '../src/infrastructure/session/HttpSessionProvider';
import { createDeferred } from './fixtures/week-06/deferred';

jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

class TestClock implements SessionClock {
  constructor(public currentTime = 1000) {}
  now(): number {
    return this.currentTime;
  }
}

class TestSecretStore implements SessionSecretStore {
  stored: string | null = null;
  clearCalls = 0;
  failSave = false;
  failClear = false;

  async save(secret: string): Promise<void> {
    if (this.failSave) throw new Error('synthetic storage save failure');
    this.stored = secret;
  }
  async read(): Promise<string | null> {
    return this.stored;
  }
  async clear(): Promise<void> {
    this.clearCalls++;
    if (this.failClear) throw new Error('synthetic storage clear failure');
    this.stored = null;
  }
}

function sessionTokens(accessToken: string, refreshToken: string): SessionTokens {
  return { accessToken, refreshToken, expiresIn: 60 };
}

function providerFor(actorRole: 'reporter' | 'technician' | 'coordinator' = 'reporter'): SessionProvider {
  return {
    login: async (actorId) => ({
      actorId,
      role: actorRole,
      ...sessionTokens(`access-${actorId}`, `refresh-${actorId}`),
    }),
    refresh: async () => sessionTokens('access-renewed', 'refresh-renewed'),
  };
}

describe('Week 06 login, expiry, and persistence', () => {
  it('treats expiresAt - 1 as authenticated, expiresAt as expired, and expiresAt + 1 as expired', async () => {
    const clock = new TestClock();
    const controller = new DefaultSessionController(providerFor(), new TestSecretStore(), clock);
    await controller.login('reporter-1');
    const expiresAt = controller.getSnapshot().expiresAt!;

    clock.currentTime = expiresAt - 1;
    expect(controller.getSnapshot().state).toBe('authenticated');
    clock.currentTime = expiresAt;
    expect(controller.getSnapshot().state).toBe('expired');
    clock.currentTime = expiresAt + 1;
    expect(controller.getSnapshot().state).toBe('expired');
  });

  it('handles invalid login, transport failure, and persistence failure without publishing an authenticated state', async () => {
    const store = new TestSecretStore();
    const invalidProvider: SessionProvider = {
      ...providerFor(),
      login: async () => { throw new ApplicationFailure('AUTHENTICATION_FAILED', 'Actor sintético inválido.'); },
    };
    const invalidController = new DefaultSessionController(invalidProvider, store, new TestClock());
    await expect(invalidController.login('unknown-fixture')).rejects.toMatchObject({ code: 'AUTHENTICATION_FAILED' });
    expect(invalidController.getSnapshot().state).toBe('anonymous');
    expect(store.stored).toBeNull();

    const transport: IncidentTransport = {
      send: async () => { throw new Error('synthetic transport secret'); },
    };
    const transportController = new DefaultSessionController(new HttpSessionProvider(transport), store, new TestClock());
    await expect(transportController.login('reporter-1')).rejects.toMatchObject({
      code: 'AUTHENTICATION_FAILED',
      message: 'Falla de comunicación al intentar iniciar sesión.',
    });
    expect(transportController.getSnapshot().state).toBe('anonymous');

    store.failSave = true;
    const persistenceController = new DefaultSessionController(providerFor(), store, new TestClock());
    await expect(persistenceController.login('reporter-1')).rejects.toMatchObject({ code: 'AUTHENTICATION_FAILED' });
    expect(persistenceController.getSnapshot()).toMatchObject({ state: 'anonymous', actorId: null, role: null });
  });

  it('uses the native SecureStore adapter mock for read/write/delete and rejects a failed delete', async () => {
    const setItem = SecureStore.setItemAsync as jest.MockedFunction<typeof SecureStore.setItemAsync>;
    const getItem = SecureStore.getItemAsync as jest.MockedFunction<typeof SecureStore.getItemAsync>;
    const deleteItem = SecureStore.deleteItemAsync as jest.MockedFunction<typeof SecureStore.deleteItemAsync>;
    jest.resetAllMocks();
    getItem.mockResolvedValueOnce('synthetic-persisted-session');

    const adapter = new ExpoSecureSessionSecretStore();
    await adapter.save('synthetic-persisted-session');
    await expect(adapter.read()).resolves.toBe('synthetic-persisted-session');
    expect(setItem).toHaveBeenCalledWith('campusops.session.access-token', 'synthetic-persisted-session', {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });

    deleteItem.mockRejectedValueOnce(new Error('synthetic delete failure'));
    await expect(adapter.clear()).rejects.toMatchObject({
      code: 'SECURE_STORAGE_UNAVAILABLE',
      message: 'No fue posible borrar la sesión de forma segura.',
    });
    expect(deleteItem).toHaveBeenCalledTimes(1);
  });
});

describe('Week 06 single-flight concurrency and races', () => {
  it('coalesces three 401 requests into one held refresh, records three waiters, then retries once each', async () => {
    const store = new TestSecretStore();
    const refreshGate = createDeferred<SessionTokens>();
    const refreshStarted = createDeferred<void>();
    const allInitialRequests = createDeferred<void>();
    const idsInitiated: string[] = [];
    const idsCompleted: string[] = [];
    const attempts = new Map<string, number>();
    let providerRefreshCount = 0;
    let waiterCount = 0;
    const provider: SessionProvider = {
      ...providerFor(),
      refresh: async () => {
        providerRefreshCount++;
        refreshStarted.resolve();
        return refreshGate.promise;
      },
    };
    const controller = new DefaultSessionController(provider, store, new TestClock());
    await controller.login('reporter-1');
    const generationId = controller.getGeneration();

    const transport: IncidentTransport = {
      send: async (request: TransportRequest) => {
        const id = request.headers?.['x-request-id'] ?? 'unknown';
        const attempt = (attempts.get(id) ?? 0) + 1;
        attempts.set(id, attempt);
        if (attempt === 1) {
          idsInitiated.push(id);
          if (idsInitiated.length === 3) allInitialRequests.resolve();
          await allInitialRequests.promise;
          idsCompleted.push(id);
          return { status: 401, headers: {}, bodyText: '{"code":"unauthorized"}' };
        }
        idsCompleted.push(id);
        return { status: 200, headers: {}, bodyText: '{}' };
      },
    };
    const context = {
      getSnapshot: () => controller.getSnapshot(),
      invalidate: (generation: number) => controller.invalidate(generation),
      getAuthorizationHeader: () => controller.getAuthorizationHeader(),
      getActorId: () => controller.getActorId(),
      getGeneration: () => controller.getGeneration(),
      refresh: async (expectedGeneration?: number) => {
        waiterCount++;
        await controller.refresh(expectedGeneration);
      },
    };
    const decorator = new SessionTransportDecorator(transport, context);
    const requests = ['A', 'B', 'C'].map((id) => decorator.send({
      method: 'GET',
      path: `/controlled/${id.toLowerCase()}`,
      headers: { 'x-request-id': id },
    }));

    await allInitialRequests.promise;
    await refreshStarted.promise;
    expect(waiterCount).toBe(3);
    expect(providerRefreshCount).toBe(1);
    expect(controller.getGeneration()).toBe(generationId);

    refreshGate.resolve(sessionTokens('access-renewed', 'refresh-renewed'));
    const responses = await Promise.all(requests);
    expect(responses.map((response) => response.status)).toEqual([200, 200, 200]);
    expect(attempts).toEqual(new Map([['A', 2], ['B', 2], ['C', 2]]));
    expect(idsInitiated.sort()).toEqual(['A', 'B', 'C']);
    expect(idsCompleted.sort()).toEqual(['A', 'A', 'B', 'B', 'C', 'C']);
    expect(controller.getGeneration()).toBe(generationId);
  });

  it('does not refresh for 403 and does not repeat refresh after a retried request returns 401', async () => {
    let refreshCalls = 0;
    const provider: SessionProvider = {
      ...providerFor(),
      refresh: async () => {
        refreshCalls++;
        return sessionTokens('access-renewed', 'refresh-renewed');
      },
    };
    const controller = new DefaultSessionController(provider, new TestSecretStore(), new TestClock());
    await controller.login('reporter-1');
    const attempts = new Map<string, number>();
    const transport: IncidentTransport = {
      send: async (request) => {
        const count = (attempts.get(request.path) ?? 0) + 1;
        attempts.set(request.path, count);
        return { status: request.path === '/forbidden' ? 403 : 401, headers: {}, bodyText: '{}' };
      },
    };
    const decorator = new SessionTransportDecorator(transport, controller);

    expect((await decorator.send({ method: 'GET', path: '/forbidden' })).status).toBe(403);
    expect(refreshCalls).toBe(0);
    expect((await decorator.send({ method: 'GET', path: '/retry-once' })).status).toBe(401);
    expect(refreshCalls).toBe(1);
    expect(attempts.get('/retry-once')).toBe(2);
  });

  it('cleans the session on refresh failure and resolves every request without unhandled rejection', async () => {
    const store = new TestSecretStore();
    const refreshGate = createDeferred<SessionTokens>();
    const refreshStarted = createDeferred<void>();
    const provider: SessionProvider = {
      ...providerFor(),
      refresh: async () => {
        refreshStarted.resolve();
        return refreshGate.promise;
      },
    };
    const controller = new DefaultSessionController(provider, store, new TestClock());
    await controller.login('reporter-1');
    const allInitial = createDeferred<void>();
    let started = 0;
    const transport: IncidentTransport = {
      send: async () => {
        started++;
        if (started === 3) allInitial.resolve();
        await allInitial.promise;
        return { status: 401, headers: {}, bodyText: '{}' };
      },
    };
    const decorator = new SessionTransportDecorator(transport, {
      getSnapshot: () => controller.getSnapshot(),
      invalidate: (generation: number) => controller.invalidate(generation),
      getAuthorizationHeader: () => controller.getAuthorizationHeader(),
      getActorId: () => controller.getActorId(),
      getGeneration: () => controller.getGeneration(),
      refresh: (generation) => controller.refresh(generation),
    });
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);

    try {
      const requests = ['A', 'B', 'C'].map((id) => decorator.send({ method: 'GET', path: `/failure/${id}` }));
      await allInitial.promise;
      await refreshStarted.promise;
      refreshGate.reject(new Error('synthetic refresh provider failure'));
      const responses = await Promise.all(requests);
      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(responses.map((response) => response.status)).toEqual([401, 401, 401]);
      expect(controller.getSnapshot()).toMatchObject({ state: 'anonymous', actorId: null, role: null });
      expect(await store.read()).toBeNull();
      expect(store.clearCalls).toBe(1);
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });

  it('logout during refresh prevents stale restoration; old refresh after a new login preserves the new session', async () => {
    const store = new TestSecretStore();
    const refreshGate = createDeferred<SessionTokens>();
    const refreshStarted = createDeferred<void>();
    const provider: SessionProvider = {
      login: async (actorId) => ({
        actorId,
        role: actorId === 'reporter-1' ? 'reporter' : 'technician',
        ...sessionTokens(`access-${actorId}`, `refresh-${actorId}`),
      }),
      refresh: async () => {
        refreshStarted.resolve();
        return refreshGate.promise;
      },
    };
    const controller = new DefaultSessionController(provider, store, new TestClock());
    await controller.login('reporter-1');
    const originalGeneration = controller.getGeneration();
    const refresh = controller.refresh(originalGeneration);
    await refreshStarted.promise;

    await controller.logout();
    refreshGate.resolve(sessionTokens('stale-access', 'stale-refresh'));
    await refresh;
    expect(controller.getSnapshot()).toMatchObject({ state: 'anonymous', actorId: null, role: null });
    expect(await store.read()).toBeNull();

    const newRefreshGate = createDeferred<SessionTokens>();
    const newRefreshStarted = createDeferred<void>();
    const raceProvider: SessionProvider = {
      login: provider.login,
      refresh: async () => {
        newRefreshStarted.resolve();
        return newRefreshGate.promise;
      },
    };
    const raceController = new DefaultSessionController(raceProvider, store, new TestClock());
    await raceController.login('reporter-1');
    const oldRefresh = raceController.refresh(raceController.getGeneration());
    await newRefreshStarted.promise;
    await raceController.login('technician-1');
    const currentGeneration = raceController.getGeneration();
    newRefreshGate.resolve(sessionTokens('old-refresh-result', 'old-refresh-token'));
    await oldRefresh;

    expect(raceController.getSnapshot()).toMatchObject({
      state: 'authenticated', actorId: 'technician-1', role: 'technician', generation: currentGeneration,
    });
    expect(raceController.getAuthorizationHeader()).toBe('Bearer access-technician-1');
    expect(JSON.parse((await store.read()) ?? '{}')).toMatchObject({ actorId: 'technician-1', accessToken: 'access-technician-1' });
  });
});

describe('Week 06 native storage adapter behavior', () => {
  it('reads, writes, and deletes through the mocked native provider; failed deletion is rejected', async () => {
    const setItem = SecureStore.setItemAsync as jest.MockedFunction<typeof SecureStore.setItemAsync>;
    const getItem = SecureStore.getItemAsync as jest.MockedFunction<typeof SecureStore.getItemAsync>;
    const deleteItem = SecureStore.deleteItemAsync as jest.MockedFunction<typeof SecureStore.deleteItemAsync>;
    jest.resetAllMocks();
    getItem.mockResolvedValueOnce('synthetic-session-secret');
    const adapter = new ExpoSecureSessionSecretStore();

    await adapter.save('synthetic-session-secret');
    await expect(adapter.read()).resolves.toBe('synthetic-session-secret');
    expect(setItem).toHaveBeenCalledWith('campusops.session.access-token', 'synthetic-session-secret', {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });

    await adapter.clear();
    expect(deleteItem).toHaveBeenCalledTimes(1);
    deleteItem.mockRejectedValueOnce(new Error('synthetic secure-store deletion failure'));
    await expect(adapter.clear()).rejects.toMatchObject({
      code: 'SECURE_STORAGE_UNAVAILABLE',
      message: 'No fue posible borrar la sesión de forma segura.',
    });
  });
});
