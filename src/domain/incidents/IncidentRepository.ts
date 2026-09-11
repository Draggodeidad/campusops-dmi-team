import type { Incident } from './Incident';

export interface IncidentRepository {
  findAll(): Promise<readonly Incident[]>;
  findById(id: string): Promise<Incident | null>;
}
