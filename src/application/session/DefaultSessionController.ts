import type { CampusRole } from '../../campusops/contracts';
import { ApplicationFailure } from '../errors/ApplicationFailure';
import type { SessionAuthorizationContext } from './SessionAuthorizationContext';
import { type SessionClock, SystemClock } from './SessionClock';
import type { SessionController } from './SessionController';
import type { SessionProvider } from './SessionProvider';
import type { SessionSecretStore } from './SessionSecretStore';
import type { SessionSnapshot, SessionState } from './SessionSnapshot';

export type StoredSessionRecord = Readonly<{
  schemaVersion: 1;
  actorId: string;
  role: CampusRole;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}>;

export class DefaultSessionController
  implements SessionController, SessionAuthorizationContext
{
  private state: SessionState = 'anonymous';
  private actorId: string | null = null;
  private role: CampusRole | null = null;
  private expiresAt: number | null = null;
  private generation = 0;

  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  private readonly listeners: Set<(snapshot: SessionSnapshot) => void> = new Set();
  private refreshPromise: Promise<void> | null = null;
  private refreshPromiseGeneration: number | null = null;
  private storageQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly provider: SessionProvider,
    private readonly storage?: SessionSecretStore,
    private readonly clock: SessionClock = new SystemClock(),
  ) {}

  getSnapshot(): SessionSnapshot {
    if (this.state === 'authenticated' && this.expiresAt !== null) {
      if (this.clock.now() >= this.expiresAt) {
        this.state = 'expired';
        this.notify();
      }
    }

    return {
      state: this.state,
      actorId: this.actorId,
      role: this.role,
      expiresAt: this.expiresAt,
      generation: this.generation,
    };
  }

  subscribe(listener: (snapshot: SessionSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const snapshot = {
      state: this.state,
      actorId: this.actorId,
      role: this.role,
      expiresAt: this.expiresAt,
      generation: this.generation,
    };
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  private serializeStorage<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.storageQueue.then(operation, operation);
    this.storageQueue = next.then(() => undefined, () => undefined);
    return next;
  }

  getAuthorizationHeader(): string | null {
    return this.accessToken ? `Bearer ${this.accessToken}` : null;
  }

  getActorId(): string | null {
    return this.actorId;
  }

  getGeneration(): number {
    return this.generation;
  }

  async login(actorId: string): Promise<void> {
    if (typeof actorId !== 'string' || actorId.trim().length === 0) {
      throw new ApplicationFailure('INVALID_SESSION_SECRET', 'Identificador de actor inválido.');
    }

    // Incrementar generación invalida operaciones anteriores en curso
    this.generation++;
    const currentGen = this.generation;
    this.refreshPromise = null;
    this.refreshPromiseGeneration = null;

    this.state = 'signing-in';
    this.notify();

    try {
      const result = await this.provider.login(actorId.trim());

      if (this.generation !== currentGen) {
        // Otra operación tomó control mientras el login estaba en vuelo
        return;
      }

      const expiresAt = this.clock.now() + result.expiresIn * 1000;

      const record: StoredSessionRecord = {
        schemaVersion: 1,
        actorId: result.actorId,
        role: result.role,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresAt,
      };

      // Persistir ANTES de publicar 'authenticated'
      await this.serializeStorage(async () => {
        if (this.generation !== currentGen) return;
        await this.storage?.save(JSON.stringify(record));
      });

      if (this.generation !== currentGen) return;

      this.actorId = result.actorId;
      this.role = result.role;
      this.accessToken = result.accessToken;
      this.refreshToken = result.refreshToken;
      this.expiresAt = expiresAt;
      this.state = 'authenticated';
      this.notify();
    } catch (error: unknown) {
      if (this.generation === currentGen) {
        this.actorId = null;
        this.role = null;
        this.accessToken = null;
        this.refreshToken = null;
        this.expiresAt = null;
        this.state = 'anonymous';
        this.notify();
      }
      if (error instanceof ApplicationFailure) {
        throw error;
      }
      throw new ApplicationFailure('AUTHENTICATION_FAILED', 'No fue posible iniciar sesión.');
    }
  }

  async refresh(expectedGeneration?: number): Promise<void> {
    if (this.state === 'anonymous' || this.state === 'logging-out' || !this.refreshToken) {
      throw new ApplicationFailure('SESSION_EXPIRED', 'No existe sesión activa para renovar.');
    }

    if (expectedGeneration !== undefined && expectedGeneration !== this.generation) {
      // El 401 proviene de una generación anterior ya invalidada
      return;
    }

    const currentGen = this.generation;

    // Coalescing: reutilizar promesa activa de la misma generación
    if (this.refreshPromise && this.refreshPromiseGeneration === currentGen) {
      return this.refreshPromise;
    }

    this.refreshPromiseGeneration = currentGen;
    this.refreshPromise = (async () => {
      try {
        this.state = 'refreshing';
        this.notify();

        const tokens = await this.provider.refresh(this.refreshToken!);

        if (this.generation !== currentGen) {
          // La sesión cambió o se cerró durante la llamada
          return;
        }

        const expiresAt = this.clock.now() + tokens.expiresIn * 1000;

        const record: StoredSessionRecord = {
          schemaVersion: 1,
          actorId: this.actorId!,
          role: this.role!,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt,
        };

        await this.serializeStorage(async () => {
          if (this.generation !== currentGen) return;
          await this.storage?.save(JSON.stringify(record));
        });

        if (this.generation !== currentGen) return;

        this.accessToken = tokens.accessToken;
        this.refreshToken = tokens.refreshToken;
        this.expiresAt = expiresAt;
        this.state = 'authenticated';
        this.notify();
      } catch (error: unknown) {
        if (this.generation === currentGen) {
          await this.doCleanup();
        }
        if (error instanceof ApplicationFailure) {
          throw error;
        }
        throw new ApplicationFailure('SESSION_EXPIRED', 'La renovación de sesión ha fallado.');
      } finally {
        if (this.refreshPromiseGeneration === currentGen) {
          this.refreshPromise = null;
          this.refreshPromiseGeneration = null;
        }
      }
    })();

    return this.refreshPromise;
  }

  async logout(): Promise<void> {
    this.generation++;
    const currentGen = this.generation;
    this.refreshPromise = null;
    this.refreshPromiseGeneration = null;

    this.state = 'logging-out';
    this.notify();

    this.accessToken = null;
    this.refreshToken = null;
    this.actorId = null;
    this.role = null;
    this.expiresAt = null;

    try {
      await this.serializeStorage(async () => {
        await this.storage?.clear();
      });
    } finally {
      if (this.generation === currentGen) {
        this.state = 'anonymous';
        this.notify();
      }
    }
  }

  private async doCleanup(): Promise<void> {
    this.accessToken = null;
    this.refreshToken = null;
    this.actorId = null;
    this.role = null;
    this.expiresAt = null;
    this.state = 'anonymous';
    this.notify();

    try {
      await this.serializeStorage(async () => {
        await this.storage?.clear();
      });
    } catch {
      // Ignorar fallos al limpiar almacenamiento persistente
    }
  }

  async restore(): Promise<void> {
    if (!this.storage) return;

    try {
      const raw = await this.storage.read();
      if (!raw) return;

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        await this.storage.clear();
        return;
      }

      if (
        !parsed ||
        typeof parsed !== 'object' ||
        (parsed as { schemaVersion: unknown }).schemaVersion !== 1 ||
        typeof (parsed as StoredSessionRecord).actorId !== 'string' ||
        typeof (parsed as StoredSessionRecord).role !== 'string' ||
        typeof (parsed as StoredSessionRecord).accessToken !== 'string' ||
        typeof (parsed as StoredSessionRecord).refreshToken !== 'string' ||
        typeof (parsed as StoredSessionRecord).expiresAt !== 'number'
      ) {
        // Formato corrupto o legado incompatible (e.g. string plano de W04)
        await this.storage.clear();
        return;
      }

      const record = parsed as StoredSessionRecord;

      if (this.clock.now() >= record.expiresAt) {
        // Sesión expirada
        await this.storage.clear();
        return;
      }

      this.generation++;
      this.actorId = record.actorId;
      this.role = record.role;
      this.accessToken = record.accessToken;
      this.refreshToken = record.refreshToken;
      this.expiresAt = record.expiresAt;
      this.state = 'authenticated';
      this.notify();
    } catch {
      await this.storage.clear();
    }
  }
}
