import type { IncidentCategory, IncidentStatus } from '../../campusops/contracts';

export type Incident = Readonly<{
  id: string;
  /** Present for versioned repositories; legacy in-memory fixtures may omit it. */
  version?: number;
  title: string;
  description: string;
  category: IncidentCategory;
  status: IncidentStatus;
  locationLabel: string;
}>;
