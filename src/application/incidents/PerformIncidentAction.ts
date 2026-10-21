import type { CampusRole } from '../../campusops/contracts';
import type { Incident } from '../../domain/incidents/Incident';
import type { IncidentActionData, IncidentRepository } from '../../domain/incidents/IncidentRepository';
import { ApplicationFailure } from '../errors/ApplicationFailure';

export type AllowedIncidentAction = 'start' | 'resolve' | 'close' | 'reopen';

export type PerformIncidentActionInput = Readonly<{
  incidentId: string;
  action: AllowedIncidentAction;
  baseVersion: number;
  actorRole?: CampusRole | null | undefined;
  diagnosis?: string | undefined;
  idempotencyKey?: string | undefined;
}>;

const TECHNICIAN_ACTIONS = new Set<AllowedIncidentAction>(['start', 'resolve']);
const COORDINATOR_ACTIONS = new Set<AllowedIncidentAction>(['close', 'reopen']);

export class PerformIncidentAction {
  constructor(
    private readonly repository: IncidentRepository,
    private readonly localStart?: { start(incidentId: string, baseVersion: number, operationId?: string): Promise<Incident> },
  ) {}

  async execute(input: PerformIncidentActionInput): Promise<Incident> {
    if (!input || typeof input !== 'object') {
      throw new ApplicationFailure(
        'INVALID_INCIDENT_INPUT',
        'Los datos de la acción son requeridos.',
      );
    }

    if (typeof input.incidentId !== 'string' || input.incidentId.trim().length === 0) {
      throw new ApplicationFailure(
        'INVALID_INCIDENT_ID',
        'Identificador de incidencia inválido.',
      );
    }

    if (!Number.isInteger(input.baseVersion) || input.baseVersion < 0) {
      throw new ApplicationFailure(
        'INVALID_INCIDENT_INPUT',
        'La versión base de la incidencia debe ser un entero no negativo.',
      );
    }

    if (input.actorRole) {
      if (TECHNICIAN_ACTIONS.has(input.action) && input.actorRole !== 'technician') {
        throw new ApplicationFailure(
          'UNAUTHORIZED_ACTION',
          `El rol '${input.actorRole}' no está autorizado para ejecutar la acción '${input.action}'.`,
        );
      }
      if (COORDINATOR_ACTIONS.has(input.action) && input.actorRole !== 'coordinator') {
        throw new ApplicationFailure(
          'UNAUTHORIZED_ACTION',
          `El rol '${input.actorRole}' no está autorizado para ejecutar la acción '${input.action}'.`,
        );
      }
    }

    if (input.action === 'resolve') {
      if (typeof input.diagnosis !== 'string' || input.diagnosis.trim().length === 0) {
        throw new ApplicationFailure(
          'INVALID_INCIDENT_INPUT',
          'El diagnóstico es requerido para resolver la incidencia.',
        );
      }
    }

    if (typeof this.repository.performAction !== 'function') {
      throw new ApplicationFailure(
        'UPDATE_INCIDENT_FAILED',
        'El repositorio configurado no admite operaciones de acción sobre incidencias.',
      );
    }

    const actionData: IncidentActionData = {
      incidentId: input.incidentId.trim(),
      action: input.action,
      baseVersion: input.baseVersion,
      ...(input.diagnosis ? { diagnosis: input.diagnosis.trim() } : {}),
      ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey.trim() } : {}),
    };

    if (input.action === 'start' && this.localStart) {
      return this.localStart.start(actionData.incidentId, actionData.baseVersion, actionData.idempotencyKey);
    }
    return await this.repository.performAction(actionData);
  }
}
