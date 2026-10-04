import type { IncidentCategory } from '../../campusops/contracts';
import type { Incident } from '../../domain/incidents/Incident';
import type { CreateIncidentData, IncidentRepository } from '../../domain/incidents/IncidentRepository';
import { ApplicationFailure } from '../errors/ApplicationFailure';

const VALID_CATEGORIES = new Set<IncidentCategory>([
  'electrical',
  'laboratory',
  'water',
  'connectivity',
  'equipment',
  'safety',
  'maintenance',
]);

export type CreateIncidentInput = Readonly<{
  category: IncidentCategory;
  description: string;
  locationLabel: string;
  idempotencyKey?: string;
}>;

export class CreateIncident {
  constructor(private readonly repository: IncidentRepository) {}

  async execute(input: CreateIncidentInput): Promise<Incident> {
    if (!input || typeof input !== 'object') {
      throw new ApplicationFailure(
        'INVALID_INCIDENT_INPUT',
        'Los datos de la incidencia son requeridos.',
      );
    }

    if (!VALID_CATEGORIES.has(input.category)) {
      throw new ApplicationFailure(
        'INVALID_INCIDENT_INPUT',
        'La categoría de la incidencia no es válida.',
      );
    }

    if (typeof input.description !== 'string' || input.description.trim().length === 0) {
      throw new ApplicationFailure(
        'INVALID_INCIDENT_INPUT',
        'La descripción de la incidencia es requerida.',
      );
    }

    if (typeof input.locationLabel !== 'string' || input.locationLabel.trim().length === 0) {
      throw new ApplicationFailure(
        'INVALID_INCIDENT_INPUT',
        'La ubicación de la incidencia es requerida.',
      );
    }

    if (typeof this.repository.create !== 'function') {
      throw new ApplicationFailure(
        'CREATE_INCIDENT_FAILED',
        'El repositorio configurado no admite operaciones de creación.',
      );
    }

    const trimmedKey = input.idempotencyKey?.trim();

    const createPayload: CreateIncidentData = {
      category: input.category,
      description: input.description.trim(),
      locationLabel: input.locationLabel.trim(),
      ...(trimmedKey ? { idempotencyKey: trimmedKey } : {}),
    };

    return await this.repository.create(createPayload);
  }
}
