import { GetBackendStatus } from './src/application/system/GetBackendStatus';
import { GetIncidentById } from './src/application/incidents/GetIncidentById';
import { GetIncidents } from './src/application/incidents/GetIncidents';
import { FakeIncidentRepository } from './src/infrastructure/incidents/FakeIncidentRepository';
import { CourseBackendHealthAdapter } from './src/infrastructure/system/CourseBackendHealthAdapter';
import { CampusOpsApp } from './src/ui/CampusOpsApp';

const incidentRepository = new FakeIncidentRepository();
const getIncidents = new GetIncidents(incidentRepository);
const getIncidentById = new GetIncidentById(incidentRepository);
const getBackendStatus = new GetBackendStatus(new CourseBackendHealthAdapter());

export default function App() {
  return (
    <CampusOpsApp
      getBackendStatus={getBackendStatus}
      getIncidentById={getIncidentById}
      getIncidents={getIncidents}
    />
  );
}
