import type { Incident } from '../../domain/incidents/Incident';
import type { IncidentRepository } from '../../domain/incidents/IncidentRepository';
import { ApplicationFailure } from '../errors/ApplicationFailure';

export class GetIncidents {
  constructor(private readonly repository: IncidentRepository) {}

  async execute(): Promise<readonly Incident[]> {
    try {
      return await this.repository.findAll();
    } catch (error: unknown) {
      if (error instanceof ApplicationFailure) throw error;
      throw new ApplicationFailure(
        'INCIDENTS_UNAVAILABLE',
        'No fue posible cargar las incidencias.',
      );
    }
  }
}
