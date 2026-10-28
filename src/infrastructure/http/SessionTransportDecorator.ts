import { ApplicationFailure } from '../../application/errors/ApplicationFailure';
import type { SessionAuthorizationContext } from '../../application/session/SessionAuthorizationContext';
import type { IncidentTransport, TransportRequest, TransportResponse } from './IncidentTransport';
import type { IncidentRetryExecutor } from './IncidentRetryExecutor';

/** Session identity is authoritative; caller-supplied credentials never survive. */
export class SessionTransportDecorator implements IncidentTransport {
  constructor(
    private readonly baseTransport: IncidentTransport,
    private readonly sessionContext: SessionAuthorizationContext,
    private readonly retries?: IncidentRetryExecutor,
  ) {}

  async send(request: TransportRequest): Promise<TransportResponse> {
    request = { ...request, ...(request.headers ? { headers: { ...request.headers } } : {}),
      ...(request.session ? { session: { ...request.session } } : {}) };
    if (!this.matchesSession(request)) return sessionChanged();
    const generation = this.sessionContext.getGeneration();
    const authEndpoint = /^\/?v1\/session\/(login|refresh)(?:\?|$)/.test(request.path);
    if (authEndpoint) return this.baseTransport.send(this.authorize(request, false));
    const transport = this.retries?.forRequest(this.baseTransport, request, async outgoing => {
      if (generation !== this.sessionContext.getGeneration() || !this.matchesSession(request)) {
        throw new ApplicationFailure('SESSION_EXPIRED', 'La sesión cambió; se conserva la operación original.');
      }
      if (['expired', 'refreshing'].includes(this.sessionContext.getSnapshot().state)) await this.sessionContext.refresh(generation);
      if (generation !== this.sessionContext.getGeneration() || !this.matchesSession(request)) {
        throw new ApplicationFailure('SESSION_EXPIRED', 'La sesión cambió; se conserva la operación original.');
      }
      return this.authorize(outgoing, true);
    }) ?? this.baseTransport;

    const state = this.sessionContext.getSnapshot().state;
    const renewedBeforeSend = state === 'expired' || state === 'refreshing';
    if (renewedBeforeSend) await this.sessionContext.refresh(generation);
    if (generation !== this.sessionContext.getGeneration() || !this.matchesSession(request)) return sessionChanged();

    const sentAuthorization = this.sessionContext.getAuthorizationHeader();
    const response = await transport.send(this.authorize(request, true));
    if (generation !== this.sessionContext.getGeneration()) return sessionChanged();
    if (response.status !== 401 || !sentAuthorization) return response;
    if (renewedBeforeSend && sentAuthorization === this.sessionContext.getAuthorizationHeader()) {
      await this.sessionContext.invalidate(generation);
      return response;
    }

    try {
      // A delayed 401 for the previous token can use a renewal already completed
      // by another request. It must not start a second refresh.
      if (sentAuthorization === this.sessionContext.getAuthorizationHeader()) {
        await this.sessionContext.refresh(generation);
      }
    } catch (error) {
      if (error instanceof ApplicationFailure && error.code === 'SECURE_STORAGE_UNAVAILABLE') throw error;
      return response;
    }
    if (generation !== this.sessionContext.getGeneration() || !this.matchesSession(request) || !this.sessionContext.getAuthorizationHeader()) return response;
    const retried = await transport.send(this.authorize(request, true));
    if (generation !== this.sessionContext.getGeneration()) return sessionChanged();
    if (retried.status === 401) await this.sessionContext.invalidate(generation);
    return retried;
  }

  private matchesSession(request: TransportRequest): boolean {
    return !request.session || (request.session.generation === this.sessionContext.getGeneration()
      && request.session.actorId === this.sessionContext.getActorId());
  }

  private authorize(request: TransportRequest, protectedRequest: boolean): TransportRequest {
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(request.headers ?? {})) {
      if (!['authorization', 'x-course-actor'].includes(key.toLowerCase())) headers[key] = value;
    }
    if (protectedRequest) {
      const authorization = this.sessionContext.getAuthorizationHeader();
      const actor = this.sessionContext.getActorId();
      if (authorization) headers.authorization = authorization;
      if (actor && authorization) headers['x-course-actor'] = actor;
    }
    return { ...request, headers };
  }
}

function sessionChanged(): TransportResponse {
  return { status: 401, headers: {}, bodyText: '{"code":"session_changed"}' };
}
