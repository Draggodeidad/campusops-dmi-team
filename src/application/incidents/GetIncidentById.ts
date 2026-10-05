import type { Incident } from '../../domain/incidents/Incident';
import type { IncidentRepository } from '../../domain/incidents/IncidentRepository';
import { ApplicationFailure } from '../errors/ApplicationFailure';

export class GetIncidentById {
  constructor(private readonly repository: IncidentRepository) {}

  async execute(id: string): Promise<Incident | null> {
    if (typeof id !== 'string' || id.trim().length === 0) {
      throw new ApplicationFailure('INVALID_INCIDENT_ID', 'La incidencia solicitada no es válida.');
    }
    try {
      return await this.repository.findById(id);
    } catch (error: unknown) {
      if (error instanceof ApplicationFailure) throw error;
      throw new ApplicationFailure(
        'INCIDENT_UNAVAILABLE',
        'No fue posible cargar el detalle.',
      );
    }
  }
}
