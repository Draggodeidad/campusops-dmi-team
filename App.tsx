import { Platform } from 'react-native';

import { CreateIncident } from './src/application/incidents/CreateIncident';
import { GetIncidentById } from './src/application/incidents/GetIncidentById';
import { GetIncidents } from './src/application/incidents/GetIncidents';
import { GetBackendStatus } from './src/application/system/GetBackendStatus';
import type { IncidentRepository } from './src/domain/incidents/IncidentRepository';
import { FetchIncidentTransport } from './src/infrastructure/http/FetchIncidentTransport';
import { FakeIncidentRepository } from './src/infrastructure/incidents/FakeIncidentRepository';
import { HttpIncidentRepository } from './src/infrastructure/incidents/HttpIncidentRepository';
import { CourseBackendHealthAdapter } from './src/infrastructure/system/CourseBackendHealthAdapter';
import { CampusOpsApp } from './src/ui/CampusOpsApp';

export const BACKEND_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:4310' : 'http://localhost:4310';

export function createDefaultRepository(): IncidentRepository {
  if (process.env.NODE_ENV === 'test' && !process.env.EXPO_PUBLIC_USE_HTTP) {
    return new FakeIncidentRepository();
  }
  const transport = new FetchIncidentTransport(BACKEND_URL);
  return new HttpIncidentRepository(transport);
}

const defaultRepository = createDefaultRepository();
const defaultGetIncidents = new GetIncidents(defaultRepository);
const defaultGetIncidentById = new GetIncidentById(defaultRepository);
const defaultCreateIncident = new CreateIncident(defaultRepository);
const defaultGetBackendStatus = new GetBackendStatus(new CourseBackendHealthAdapter());

export default function App() {
  return (
    <CampusOpsApp
      createIncident={defaultCreateIncident}
      getBackendStatus={defaultGetBackendStatus}
      getIncidentById={defaultGetIncidentById}
      getIncidents={defaultGetIncidents}
    />
  );
}
