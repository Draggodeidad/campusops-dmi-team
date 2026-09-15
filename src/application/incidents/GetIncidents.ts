import type { Incident } from '../../domain/incidents/Incident';
import type { IncidentRepository } from '../../domain/incidents/IncidentRepository';

export class GetIncidents {
  constructor(private readonly repository: IncidentRepository) {}

  execute(): Promise<readonly Incident[]> {
    return this.repository.findAll();
  }
}
