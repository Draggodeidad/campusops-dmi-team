import type { SessionAuthorizationContext } from '../../application/session/SessionAuthorizationContext';
import type { IncidentTransport, TransportRequest, TransportResponse } from './IncidentTransport';

export class SessionTransportDecorator implements IncidentTransport {
  constructor(
    private readonly baseTransport: IncidentTransport,
    private readonly sessionContext: SessionAuthorizationContext,
  ) {}

  async send(request: TransportRequest, isRetry = false): Promise<TransportResponse> {
    const isAuthEndpoint = this.isAuthPath(request.path);

    const headers: Record<string, string> = {
      ...(request.headers ?? {}),
    };

    const initialGeneration = this.sessionContext.getGeneration();

    if (!isAuthEndpoint) {
      const authHeader = this.sessionContext.getAuthorizationHeader();
      if (authHeader && !headers.authorization) {
        headers.authorization = authHeader;
      }

      const actorId = this.sessionContext.getActorId();
      if (actorId && !headers['x-course-actor']) {
        headers['x-course-actor'] = actorId;
      }
    }

    const outgoingRequest: TransportRequest = {
      method: request.method,
      path: request.path,
      headers,
      ...(request.body !== undefined ? { body: request.body } : {}),
      ...(request.timeoutMs !== undefined ? { timeoutMs: request.timeoutMs } : {}),
    };

    const response = await this.baseTransport.send(outgoingRequest);

    // Si recibimos 401 en una petición protegida y aún no se ha reintentado
    if (response.status === 401 && !isAuthEndpoint && !isRetry) {
      try {
        // Disparar o sumarse al refresh de la generación activa
        await this.sessionContext.refresh(initialGeneration);
      } catch {
        // Si el refresh falla, devolver la respuesta 401 original
        return response;
      }

      // Reintento único con credenciales renovadas
      const newAuthHeader = this.sessionContext.getAuthorizationHeader();
      const retryHeaders: Record<string, string> = {
        ...(request.headers ?? {}),
      };

      if (newAuthHeader) {
        retryHeaders.authorization = newAuthHeader;
      }

      const actorId = this.sessionContext.getActorId();
      if (actorId && !retryHeaders['x-course-actor']) {
        retryHeaders['x-course-actor'] = actorId;
      }

      const retryRequest: TransportRequest = {
        method: request.method,
        path: request.path,
        headers: retryHeaders,
        ...(request.body !== undefined ? { body: request.body } : {}),
        ...(request.timeoutMs !== undefined ? { timeoutMs: request.timeoutMs } : {}),
      };

      return this.send(retryRequest, true);
    }

    return response;
  }

  private isAuthPath(path: string): boolean {
    const clean = path.replace(/^\/+/, '');
    return (
      clean.startsWith('v1/session/login') ||
      clean.startsWith('v1/session/refresh') ||
      path.includes('/session/login') ||
      path.includes('/session/refresh')
    );
  }
}
