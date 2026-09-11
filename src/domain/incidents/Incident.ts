import type { IncidentCategory, IncidentStatus } from '../../campusops/contracts';

export type Incident = Readonly<{
  id: string;
  title: string;
  description: string;
  category: IncidentCategory;
  status: IncidentStatus;
  locationLabel: string;
}>;
