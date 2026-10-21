import type { IncidentCategory, IncidentStatus } from '../../campusops/contracts';

export type Incident = Readonly<{
  id: string;
  /** Present for versioned repositories; legacy in-memory fixtures may omit it. */
  version?: number;
  assignedTechnicianId?: string | null;
  reporterId?: string;
  notes?: readonly Readonly<{ actorId: string; text: string }>[];
  evidence?: readonly Readonly<{ actorId: string; evidenceId: string }>[];
  priority?: string;
  title: string;
  description: string;
  category: IncidentCategory;
  status: IncidentStatus;
  locationLabel: string;
}>;
