import type { CampusRole } from '../../campusops/contracts';
import { ApplicationFailure } from '../../application/errors/ApplicationFailure';
import type { SessionProvider, SessionTokens } from '../../application/session/SessionProvider';
import type { IncidentTransport } from '../http/IncidentTransport';

const VALID_ROLES = new Set<CampusRole>(['reporter', 'technician', 'coordinator']);

export class HttpSessionProvider implements SessionProvider {
  constructor(
    private readonly transport: IncidentTransport,
    private readonly loginEndpoint: string = '/v1/session/login',
    private readonly refreshEndpoint: string = '/v1/session/refresh',
  ) {}

  async login(actorId: string): Promise<
    SessionTokens & Readonly<{ actorId: string; role: CampusRole }>
  > {
    if (typeof actorId !== 'string' || actorId.trim().length === 0) {
      throw new ApplicationFailure('AUTHENTICATION_FAILED', 'Identificador de actor inválido.');
    }

    try {
      const response = await this.transport.send({
        method: 'POST',
        path: this.loginEndpoint,
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ actorId: actorId.trim() }),
      });

      if (response.status !== 200) {
        throw new ApplicationFailure(
          'AUTHENTICATION_FAILED',
          `Credenciales o actor inválido (código HTTP ${response.status}).`,
        );
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(response.bodyText);
      } catch {
        throw new ApplicationFailure(
          'AUTHENTICATION_FAILED',
          'Respuesta de inicio de sesión malformada.',
        );
      }

      if (!parsed || typeof parsed !== 'object') {
        throw new ApplicationFailure(
          'AUTHENTICATION_FAILED',
          'Sobre de respuesta de sesión inválido.',
        );
      }

      const rec = parsed as Record<string, unknown>;
      const respActorId = rec.actorId;
      const respRole = rec.role;
      const respAccessToken = rec.accessToken;
      const respRefreshToken = rec.refreshToken;
      const respExpiresIn = rec.expiresIn;

      if (
        typeof respActorId !== 'string' ||
        respActorId !== actorId.trim() ||
        typeof respRole !== 'string' ||
        !VALID_ROLES.has(respRole as CampusRole) ||
        typeof respAccessToken !== 'string' ||
        respAccessToken.trim().length === 0 ||
        typeof respRefreshToken !== 'string' ||
        respRefreshToken.trim().length === 0 ||
        typeof respExpiresIn !== 'number' ||
        !Number.isFinite(respExpiresIn) ||
        respExpiresIn <= 0
      ) {
        throw new ApplicationFailure(
          'AUTHENTICATION_FAILED',
          'La carga útil de la sesión no cumple el contrato esperado.',
        );
      }

      return {
        actorId: respActorId,
        role: respRole as CampusRole,
        accessToken: respAccessToken,
        refreshToken: respRefreshToken,
        expiresIn: respExpiresIn,
      };
    } catch (error: unknown) {
      if (error instanceof ApplicationFailure) {
        throw error;
      }
      throw new ApplicationFailure(
        'AUTHENTICATION_FAILED',
        'Falla de comunicación al intentar iniciar sesión.',
      );
    }
  }

  async refresh(refreshToken: string): Promise<SessionTokens> {
    if (typeof refreshToken !== 'string' || refreshToken.trim().length === 0) {
      throw new ApplicationFailure('SESSION_EXPIRED', 'Token de renovación ausente o inválido.');
    }

    try {
      const response = await this.transport.send({
        method: 'POST',
        path: this.refreshEndpoint,
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: refreshToken.trim() }),
      });

      if (response.status !== 200) {
        throw new ApplicationFailure(
          'SESSION_EXPIRED',
          `No fue posible renovar la sesión (código HTTP ${response.status}).`,
        );
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(response.bodyText);
      } catch {
        throw new ApplicationFailure(
          'SESSION_EXPIRED',
          'Respuesta de renovación malformada.',
        );
      }

      if (!parsed || typeof parsed !== 'object') {
        throw new ApplicationFailure(
          'SESSION_EXPIRED',
          'Sobre de respuesta de renovación inválido.',
        );
      }

      const rec = parsed as Record<string, unknown>;
      const respAccessToken = rec.accessToken;
      const respRefreshToken = rec.refreshToken;
      const respExpiresIn = rec.expiresIn;

      if (
        typeof respAccessToken !== 'string' ||
        respAccessToken.trim().length === 0 ||
        typeof respRefreshToken !== 'string' ||
        respRefreshToken.trim().length === 0 ||
        typeof respExpiresIn !== 'number' ||
        !Number.isFinite(respExpiresIn) ||
        respExpiresIn <= 0
      ) {
        throw new ApplicationFailure(
          'SESSION_EXPIRED',
          'La respuesta de renovación no contiene tokens válidos.',
        );
      }

      return {
        accessToken: respAccessToken,
        refreshToken: respRefreshToken,
        expiresIn: respExpiresIn,
      };
    } catch (error: unknown) {
      if (error instanceof ApplicationFailure) {
        throw error;
      }
      throw new ApplicationFailure(
        'SESSION_EXPIRED',
        'Falla de comunicación al renovar la sesión.',
      );
    }
  }
}
