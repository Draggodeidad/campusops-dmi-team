import type { IncidentCategory } from '../../campusops/contracts';
import type { Incident } from './Incident';

export type CreateIncidentData = Readonly<{
  category: IncidentCategory;
  description: string;
  locationLabel: string;
  idempotencyKey?: string;
}>;

export type IncidentActionData = Readonly<{
  incidentId: string;
  action: 'start' | 'resolve' | 'close' | 'reopen';
  baseVersion: number;
  idempotencyKey?: string;
  diagnosis?: string;
}>;

export interface IncidentRepository {
  findAll(): Promise<readonly Incident[]>;
  findById(id: string): Promise<Incident | null>;
  create?(input: CreateIncidentData): Promise<Incident>;
  performAction?(input: IncidentActionData): Promise<Incident>;
}
