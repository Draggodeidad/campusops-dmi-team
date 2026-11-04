import type { Incident } from '../../domain/incidents/Incident';
import type { IncidentRepository } from '../../domain/incidents/IncidentRepository';
import { ApplicationFailure } from '../errors/ApplicationFailure';

export class GetIncidents {
  constructor(private readonly repository: IncidentRepository) {}

  async execute(signal?: AbortSignal, correlationId?: string): Promise<readonly Incident[]> {
    try {
      return await this.repository.findAll(signal, correlationId);
    } catch (error: unknown) {
      if (error instanceof ApplicationFailure) throw error;
      throw new ApplicationFailure(
        'INCIDENTS_UNAVAILABLE',
        'No fue posible cargar las incidencias.',
      );
    }
  }
}
