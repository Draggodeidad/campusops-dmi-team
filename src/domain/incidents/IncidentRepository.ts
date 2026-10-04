import type { IncidentCategory } from '../../campusops/contracts';
import type { Incident } from './Incident';

export type CreateIncidentData = Readonly<{
  category: IncidentCategory;
  description: string;
  locationLabel: string;
  idempotencyKey?: string;
}>;

export interface IncidentRepository {
  findAll(): Promise<readonly Incident[]>;
  findById(id: string): Promise<Incident | null>;
  create?(input: CreateIncidentData): Promise<Incident>;
}
