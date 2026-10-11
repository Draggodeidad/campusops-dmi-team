import type { IncidentTransport, TransportRequest, TransportResponse } from './IncidentTransport';
import type { SessionSecretStore } from '../../application/session/SessionSecretStore';
import { ApplicationFailure } from '../../application/errors/ApplicationFailure';

export type SessionState = 'authenticated' | 'anonymous';

export type AuthenticatedTransportOptions = Readonly<{
  transport: IncidentTransport;
  secretStore?: SessionSecretStore | undefined;
  initialAccessToken?: string | null | undefined;
  initialRefreshToken?: string | null | undefined;
  refreshEndpoint?: string | undefined;
  onSessionStateChange?: ((state: SessionState) => void) | undefined;
  logger?: ((event: string) => void) | undefined;
}>;

export class AuthenticatedIncidentTransport implements IncidentTransport {
  private readonly transport: IncidentTransport;
  private readonly secretStore?: SessionSecretStore | undefined;
  private readonly refreshEndpoint: string;
  private readonly onSessionStateChange?: ((state: SessionState) => void) | undefined;
  private readonly logger?: ((event: string) => void) | undefined;

  private accessToken: string | null;
  private refreshToken: string | null;
  private sessionState: SessionState;
  private refreshPromise: Promise<string> | null = null;
  private refreshCount = 0;

  constructor(options: AuthenticatedTransportOptions) {
    this.transport = options.transport;
    this.secretStore = options.secretStore;
    this.refreshEndpoint = options.refreshEndpoint ?? '/v1/session/refresh';
    this.onSessionStateChange = options.onSessionStateChange;
    this.logger = options.logger;

    this.accessToken = options.initialAccessToken ?? null;
    this.refreshToken = options.initialRefreshToken ?? null;
    this.sessionState = this.accessToken ? 'authenticated' : 'anonymous';
  }

  getRefreshCount(): number {
    return this.refreshCount;
  }

  getSessionState(): SessionState {
    return this.sessionState;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  getRefreshToken(): string | null {
    return this.refreshToken;
  }

  setSession(accessToken: string | null, refreshToken: string | null): void {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.setSessionState(accessToken ? 'authenticated' : 'anonymous');
  }

  private setSessionState(state: SessionState): void {
    if (this.sessionState !== state) {
      this.sessionState = state;
      this.onSessionStateChange?.(state);
    }
  }

  private log(event: string): void {
    console.log(event); // TEMP-SEM6
    this.logger?.(event);
  }

  async send(request: TransportRequest, isRetry = false): Promise<TransportResponse> {
    const isRefreshEndpoint = this.isRefreshRequest(request);

    // TEMP-SEM6: Identificador de la petición para los logs exactos requeridos
    const reqId = request.headers?.['x-request-id'] ??
      (request.path.endsWith('/a') ? 'A' : request.path.endsWith('/b') ? 'B' : request.path.endsWith('/c') ? 'C' :
       request.path === '/v1/incidents' ? 'A' :
       request.path.includes('/incidents/') ? 'B' :
       request.path.includes('/resources') ? 'C' : 'REQ');

    if (!isRefreshEndpoint && !isRetry) {
      this.log(`[${reqId}] REQUEST`); // TEMP-SEM6
    }

    const headers: Record<string, string> = {
      ...(request.headers ?? {}),
    };

    if (!isRefreshEndpoint && this.accessToken && !headers.authorization) {
      headers.authorization = `Bearer ${this.accessToken}`;
    }

    const outgoingRequest: TransportRequest = {
      method: request.method,
      path: request.path,
      headers,
      ...(request.body !== undefined ? { body: request.body } : {}),
      ...(request.timeoutMs !== undefined ? { timeoutMs: request.timeoutMs } : {}),
    };

    const response = await this.transport.send(outgoingRequest);

    if (response.status === 401 && !isRefreshEndpoint && !isRetry) {
      this.log(`[${reqId}] 401`); // TEMP-SEM6

      if (!this.refreshPromise) {
        this.log('[AUTH] REFRESH START'); // TEMP-SEM6
        this.refreshPromise = this.performRefresh();
      }

      let newAccessToken: string;
      try {
        newAccessToken = await this.refreshPromise;
      } catch (refreshError) {
        this.log(`[${reqId}] RESULT`); // TEMP-SEM6
        throw refreshError;
      } finally {
        this.refreshPromise = null;
      }

      this.log(`[${reqId}] RETRY`); // TEMP-SEM6
      const retryRequest: TransportRequest = {
        method: request.method,
        path: request.path,
        headers: {
          ...(request.headers ?? {}),
          authorization: `Bearer ${newAccessToken}`,
        },
        ...(request.body !== undefined ? { body: request.body } : {}),
        ...(request.timeoutMs !== undefined ? { timeoutMs: request.timeoutMs } : {}),
      };

      const retryResponse = await this.send(retryRequest, true);
      this.log(`[${reqId}] RESULT`); // TEMP-SEM6
      return retryResponse;
    }

    if (!isRefreshEndpoint && !isRetry && response.status === 200) {
      this.log(`[${reqId}] RESULT`); // TEMP-SEM6
    }

    return response;
  }

  private isRefreshRequest(request: TransportRequest): boolean {
    const cleanPath = request.path.replace(/^\/+/, '');
    const cleanRefresh = this.refreshEndpoint.replace(/^\/+/, '');
    return cleanPath === cleanRefresh || request.path.includes('/session/refresh');
  }

  private async performRefresh(): Promise<string> {
    this.refreshCount++;

    if (!this.refreshToken) {
      this.log('[AUTH] REFRESH FAIL'); // TEMP-SEM6
      await this.handleSessionFailure();
      throw new ApplicationFailure('INVALID_SESSION_SECRET', 'No hay refresh token disponible.');
    }

    try {
      const response = await this.transport.send({
        method: 'POST',
        path: this.refreshEndpoint,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refreshToken: this.refreshToken,
        }),
      });

      if (response.status !== 200) {
        this.log('[AUTH] REFRESH FAIL'); // TEMP-SEM6
        await this.handleSessionFailure();
        throw new ApplicationFailure(
          'INVALID_SESSION_SECRET',
          `No fue posible renovar la sesión (HTTP ${response.status}).`,
        );
      }

      let parsed: { accessToken?: string; refreshToken?: string };
      try {
        parsed = JSON.parse(response.bodyText);
      } catch {
        this.log('[AUTH] REFRESH FAIL'); // TEMP-SEM6
        await this.handleSessionFailure();
        throw new ApplicationFailure('INVALID_SESSION_SECRET', 'Respuesta de refresh malformada.');
      }

      if (!parsed.accessToken || typeof parsed.accessToken !== 'string') {
        this.log('[AUTH] REFRESH FAIL'); // TEMP-SEM6
        await this.handleSessionFailure();
        throw new ApplicationFailure(
          'INVALID_SESSION_SECRET',
          'La respuesta de refresh no contiene un accessToken válido.',
        );
      }

      this.accessToken = parsed.accessToken;
      if (parsed.refreshToken && typeof parsed.refreshToken === 'string') {
        this.refreshToken = parsed.refreshToken;
      }
      this.setSessionState('authenticated');

      if (this.secretStore && this.accessToken) {
        await this.secretStore.save(this.accessToken);
      }

      this.log('[AUTH] REFRESH SUCCESS'); // TEMP-SEM6
      return this.accessToken;
    } catch (error: unknown) {
      if (error instanceof ApplicationFailure) {
        throw error;
      }
      this.log('[AUTH] REFRESH FAIL'); // TEMP-SEM6
      await this.handleSessionFailure();
      throw new ApplicationFailure(
        'INVALID_SESSION_SECRET',
        'Falla inesperada al intentar renovar la sesión.',
      );
    }
  }

  private async handleSessionFailure(): Promise<void> {
    this.accessToken = null;
    this.refreshToken = null;
    this.setSessionState('anonymous');
    this.log('[SESSION] CLEAR');
    this.log('[AUTH] ANONYMOUS');
    this.log('[LOGIN] REQUIRED');

    if (this.secretStore) {
      try {
        await this.secretStore.clear();
      } catch {
        // Ignorar fallos al limpiar almacén seguro en estado de error
      }
    }
  }
}
