import type { JsonObject } from '../../../course-evaluation/contracts';

export type IncidentPayloadDto = Readonly<{
  category?: unknown;
  description?: unknown;
  location?: unknown;
  reporterId?: unknown;
  assignedTechnicianId?: unknown;
  priority?: unknown;
  notes?: unknown;
  evidence?: unknown;
  history?: unknown;
}>;

export type RemoteIncidentEnvelopeDto = Readonly<{
  id: string;
  version: number;
  status: string;
  payload: JsonObject | null;
}>;

export type IncidentListResponseDto = Readonly<{
  items: readonly unknown[];
}>;

export type IncidentCreateResponseDto = Readonly<{
  incident: unknown;
  operationId: string;
  duplicate: boolean;
}>;
