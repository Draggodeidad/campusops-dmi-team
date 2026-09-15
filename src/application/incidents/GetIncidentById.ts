import type { Incident } from '../../domain/incidents/Incident';
import type { IncidentRepository } from '../../domain/incidents/IncidentRepository';

export class GetIncidentById {
  constructor(private readonly repository: IncidentRepository) {}

  execute(id: string): Promise<Incident | null> {
    return this.repository.findById(id);
  }
}
