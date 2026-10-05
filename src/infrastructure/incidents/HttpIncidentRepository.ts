import type { Incident } from '../../domain/incidents/Incident';
import type { CreateIncidentData, IncidentRepository } from '../../domain/incidents/IncidentRepository';
import { ApplicationFailure } from '../../application/errors/ApplicationFailure';
import type { IncidentTransport } from '../http/IncidentTransport';
import { mapDtoToIncident } from './dto/IncidentDtoMapper';
import { parseRemoteResource } from './parseRemoteResource';

function generateIdempotencyKey(): string {
  const timestamp = Date.now().toString(36);
  const randomSuffix = Math.random().toString(36).slice(2, 10);
  return `idemp-${timestamp}-${randomSuffix}`;
}

export class HttpIncidentRepository implements IncidentRepository {
  constructor(
    private readonly transport: IncidentTransport,
    private readonly actorId: string = 'reporter-1',
    private readonly authToken: string = 'Bearer course-valid-token',
  ) {}

  private get authHeaders(): Record<string, string> {
    return {
      authorization: this.authToken,
      'x-course-actor': this.actorId,
    };
  }

  async findAll(): Promise<readonly Incident[]> {
    try {
      const response = await this.transport.send({
        method: 'GET',
        path: '/v1/incidents',
        headers: this.authHeaders,
      });

      if (response.status === 500) {
        throw new ApplicationFailure(
          'INCIDENTS_UNAVAILABLE',
          'El servicio de incidencias no está disponible (error 500).',
          'server',
        );
      }

      if (response.status !== 200) {
        throw new ApplicationFailure(
          'INCIDENTS_UNAVAILABLE',
          `No fue posible cargar las incidencias (código HTTP ${response.status}).`,
        );
      }

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(response.bodyText);
      } catch {
        throw new ApplicationFailure(
          'INCIDENTS_UNAVAILABLE',
          'Respuesta del servidor malformada.',
          'contract',
        );
      }

      if (
        parsedJson === null ||
        typeof parsedJson !== 'object' ||
        !('items' in parsedJson) ||
        !Array.isArray((parsedJson as { items: unknown }).items)
      ) {
        throw new ApplicationFailure(
          'INCIDENTS_UNAVAILABLE',
          'El sobre de la lista de incidencias es inválido.',
          'contract',
        );
      }

      const rawItems = (parsedJson as { items: readonly unknown[] }).items;
      const validIncidents: Incident[] = [];

      for (const rawItem of rawItems) {
        const envelopeResult = parseRemoteResource(rawItem);
        if (envelopeResult.ok) {
          const incident = mapDtoToIncident(envelopeResult.value);
          if (incident !== null) {
            validIncidents.push(incident);
          }
        }
      }

      return validIncidents;
    } catch (error: unknown) {
      if (error instanceof ApplicationFailure) {
        throw error;
      }
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new ApplicationFailure(
          'INCIDENT_TIMEOUT',
          'La consulta de incidencias excedió el tiempo límite.',
        );
      }
      throw new ApplicationFailure(
        'REMOTE_COMMUNICATION_ERROR',
        'Falla de comunicación al consultar incidencias.',
      );
    }
  }

  async findById(id: string): Promise<Incident | null> {
    if (typeof id !== 'string' || id.trim().length === 0) {
      throw new ApplicationFailure('INVALID_INCIDENT_ID', 'Identificador de incidencia inválido.');
    }

    try {
      const response = await this.transport.send({
        method: 'GET',
        path: `/v1/incidents/${encodeURIComponent(id)}`,
        headers: this.authHeaders,
      });

      if (response.status === 404) {
        return null;
      }

      if (response.status === 500) {
        throw new ApplicationFailure(
          'INCIDENT_UNAVAILABLE',
          'El servicio no está disponible temporalmente (error 500).',
          'server',
        );
      }

      if (response.status !== 200) {
        throw new ApplicationFailure(
          'INCIDENT_UNAVAILABLE',
          `No fue posible cargar el detalle (código HTTP ${response.status}).`,
        );
      }

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(response.bodyText);
      } catch {
        throw new ApplicationFailure(
          'INCIDENT_UNAVAILABLE',
          'Respuesta del detalle malformada.',
          'contract',
        );
      }

      const envelopeResult = parseRemoteResource(parsedJson);
      if (!envelopeResult.ok) {
        throw new ApplicationFailure(
          'INCIDENT_UNAVAILABLE',
          'El sobre de la incidencia no cumple el contrato.',
          'contract',
        );
      }

      const incident = mapDtoToIncident(envelopeResult.value);
      if (incident === null) {
        throw new ApplicationFailure(
          'INCIDENT_UNAVAILABLE',
          envelopeResult.value.payload === null
            ? 'Los datos de la incidencia no están disponibles.'
            : 'Los datos de la incidencia no cumplen el contrato.',
          envelopeResult.value.payload === null ? 'payload_unavailable' : 'contract',
        );
      }
      return incident;
    } catch (error: unknown) {
      if (error instanceof ApplicationFailure) {
        throw error;
      }
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new ApplicationFailure(
          'INCIDENT_TIMEOUT',
          'La consulta de detalle excedió el tiempo límite.',
        );
      }
      throw new ApplicationFailure(
        'REMOTE_COMMUNICATION_ERROR',
        'Falla de comunicación al consultar el detalle de la incidencia.',
      );
    }
  }

  async create(input: CreateIncidentData): Promise<Incident> {
    const key =
      input.idempotencyKey && input.idempotencyKey.trim().length >= 8
        ? input.idempotencyKey.trim()
        : generateIdempotencyKey();

    try {
      const response = await this.transport.send({
        method: 'POST',
        path: '/v1/incidents',
        headers: {
          ...this.authHeaders,
          'idempotency-key': key,
        },
        body: JSON.stringify({
          category: input.category,
          description: input.description,
          location: input.locationLabel,
        }),
      });

      if (response.status === 500) {
        throw new ApplicationFailure(
          'CREATE_INCIDENT_FAILED',
          'Error del servidor al registrar la incidencia.',
          'server',
        );
      }

      if (response.status !== 201 && response.status !== 200) {
        throw new ApplicationFailure(
          'CREATE_INCIDENT_FAILED',
          `No fue posible crear la incidencia (código HTTP ${response.status}).`,
        );
      }

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(response.bodyText);
      } catch {
        throw new ApplicationFailure(
          'CREATE_INCIDENT_FAILED',
          'Respuesta de creación malformada.',
          'contract',
        );
      }

      if (
        parsedJson === null ||
        typeof parsedJson !== 'object' ||
        !('incident' in parsedJson)
      ) {
        throw new ApplicationFailure(
          'CREATE_INCIDENT_FAILED',
          'El sobre de creación no contiene la incidencia generada.',
          'contract',
        );
      }

      const envelopeResult = parseRemoteResource(
        (parsedJson as { incident: unknown }).incident,
      );
      if (!envelopeResult.ok) {
        throw new ApplicationFailure(
          'CREATE_INCIDENT_FAILED',
          'El sobre de la incidencia creada es inválido.',
          'contract',
        );
      }

      const created = mapDtoToIncident(envelopeResult.value);
      if (created === null) {
        throw new ApplicationFailure(
          'CREATE_INCIDENT_FAILED',
          'No fue posible construir la entidad interna a partir de la respuesta.',
          'contract',
        );
      }

      return created;
    } catch (error: unknown) {
      if (error instanceof ApplicationFailure) {
        throw error;
      }
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new ApplicationFailure(
          'INCIDENT_TIMEOUT',
          'El registro de incidencia excedió el tiempo límite.',
        );
      }
      throw new ApplicationFailure(
        'REMOTE_COMMUNICATION_ERROR',
        'Falla de red o comunicación al registrar la incidencia.',
      );
    }
  }
}
