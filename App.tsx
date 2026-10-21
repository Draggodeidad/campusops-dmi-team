import { Platform } from 'react-native';

import { CreateIncident } from './src/application/incidents/CreateIncident';
import { GetIncidentById } from './src/application/incidents/GetIncidentById';
import { GetIncidents } from './src/application/incidents/GetIncidents';
import { PerformIncidentAction } from './src/application/incidents/PerformIncidentAction';
import type { LocalWorkspace } from './src/application/persistence/LocalWorkspace';
import { createExpoWorkspace } from './src/infrastructure/persistence/createExpoWorkspace';
import type { SessionClock } from './src/application/session/SessionClock';
import type { SessionSecretStore } from './src/application/session/SessionSecretStore';
import type { IncidentTransport } from './src/infrastructure/http/IncidentTransport';
import { DefaultSessionController } from './src/application/session/DefaultSessionController';
import { SystemClock } from './src/application/session/SessionClock';
import { GetBackendStatus } from './src/application/system/GetBackendStatus';
import { resolveSync } from './src/application/sync/resolveSync';
import { deduplicateOperations } from './src/application/sync/deduplicateOperations';
import type { IncidentRepository } from './src/domain/incidents/IncidentRepository';
import { FetchIncidentTransport } from './src/infrastructure/http/FetchIncidentTransport';
import { SessionTransportDecorator } from './src/infrastructure/http/SessionTransportDecorator';
import { FakeIncidentRepository } from './src/infrastructure/incidents/FakeIncidentRepository';
import { HttpIncidentRepository } from './src/infrastructure/incidents/HttpIncidentRepository';
import { ExpoSecureSessionSecretStore } from './src/infrastructure/session/ExpoSecureSessionSecretStore';
import { HttpSessionProvider } from './src/infrastructure/session/HttpSessionProvider';
import { CourseBackendHealthAdapter } from './src/infrastructure/system/CourseBackendHealthAdapter';
import { CampusOpsApp } from './src/ui/CampusOpsApp';

export const BACKEND_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:4310' : 'http://localhost:4310';

export function createGraph(options: Readonly<{
  useHttp?: boolean;
  transport?: IncidentTransport;
  secretStore?: SessionSecretStore;
  clock?: SessionClock;
  localWorkspace?: LocalWorkspace;
}> = {}) {
  const isTest = options.useHttp !== true && process.env.NODE_ENV === 'test' && !process.env.EXPO_PUBLIC_USE_HTTP;
  const baseTransport = options.transport ?? new FetchIncidentTransport(BACKEND_URL);
  const sessionProvider = new HttpSessionProvider(baseTransport);
  const sessionStore = options.secretStore ?? new ExpoSecureSessionSecretStore();
  const sessionClock = options.clock ?? new SystemClock();
  const sessionController = new DefaultSessionController(sessionProvider, sessionStore, sessionClock);
  const sessionTransport = new SessionTransportDecorator(baseTransport, sessionController);

  const repository: IncidentRepository = isTest
    ? new FakeIncidentRepository()
    : new HttpIncidentRepository(sessionTransport);

  const getIncidents = new GetIncidents(repository);
  const getIncidentById = new GetIncidentById(repository);
  const createIncident = new CreateIncident(repository);
  const performIncidentAction = new PerformIncidentAction(repository);
  const getBackendStatus = new GetBackendStatus(new CourseBackendHealthAdapter());
  const localWorkspace = options.localWorkspace ?? createExpoWorkspace();

  return {
    repository,
    localWorkspace,
    syncEngine: { resolveSync, deduplicateOperations },
    useSession: !isTest,
    sessionController,
    getIncidents,
    getIncidentById,
    createIncident,
    performIncidentAction,
    getBackendStatus,
  };
}

const defaultGraph = createGraph();

export function createDefaultRepository(): IncidentRepository {
  return defaultGraph.repository;
}

export default function App() {
  return (
    <CampusOpsApp
      createIncident={defaultGraph.createIncident}
      getBackendStatus={defaultGraph.getBackendStatus}
      getIncidentById={defaultGraph.getIncidentById}
      getIncidents={defaultGraph.getIncidents}
      performIncidentAction={defaultGraph.performIncidentAction}
      {...(defaultGraph.useSession ? { sessionController: defaultGraph.sessionController } : {})}
    />
  );
}
