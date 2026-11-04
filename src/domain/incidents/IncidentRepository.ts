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
  findAll(signal?: AbortSignal): Promise<readonly Incident[]>;
  findById(id: string, signal?: AbortSignal): Promise<Incident | null>;
  create?(input: CreateIncidentData): Promise<Incident>;
  performAction?(input: IncidentActionData): Promise<Incident>;
}
