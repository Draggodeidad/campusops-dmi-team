import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { GetIncidentById } from '../src/application/incidents/GetIncidentById';
import { GetIncidents } from '../src/application/incidents/GetIncidents';
import { GetBackendStatus } from '../src/application/system/GetBackendStatus';
import type { Incident } from '../src/domain/incidents/Incident';
import type { IncidentRepository } from '../src/domain/incidents/IncidentRepository';
import { CampusOpsApp } from '../src/ui/CampusOpsApp';

const privateDetail = 'synthetic-private-location-and-token';
const incident: Incident = {
  id: 'SYN-001',
  title: 'Incidencia sintética',
  description: 'Dato de prueba',
  category: 'maintenance',
  status: 'open',
  locationLabel: 'Zona ficticia',
};
const backendStatus = new GetBackendStatus({ check: async () => undefined });

test('list failure exposes only a fixed application message in the UI', async () => {
  const repository: IncidentRepository = {
    findAll: async () => { throw new Error(privateDetail); },
    findById: async () => null,
  };
  const getIncidents = new GetIncidents(repository);
  await expect(getIncidents.execute()).rejects.toMatchObject({
    code: 'INCIDENTS_UNAVAILABLE',
    message: 'No fue posible cargar las incidencias.',
  });

  const view = await render(
    <CampusOpsApp
      getBackendStatus={backendStatus}
      getIncidents={getIncidents}
      getIncidentById={new GetIncidentById(repository)}
    />,
  );
  await waitFor(() => expect(view.getByText('No fue posible cargar las incidencias.')).toBeTruthy());
  expect(JSON.stringify(view.toJSON())).not.toContain(privateDetail);
});

test('detail failure and invalid ID never expose repository errors or inputs', async () => {
  const repository: IncidentRepository = {
    findAll: async () => [incident],
    findById: async () => { throw new Error(privateDetail); },
  };
  const getIncidentById = new GetIncidentById(repository);
  await expect(getIncidentById.execute('  ')).rejects.toMatchObject({
    code: 'INVALID_INCIDENT_ID',
    message: 'La incidencia solicitada no es válida.',
  });
  await expect(getIncidentById.execute('SYN-001')).rejects.toMatchObject({
    code: 'INCIDENT_UNAVAILABLE',
    message: 'No fue posible cargar el detalle.',
  });

  const view = await render(
    <CampusOpsApp
      getBackendStatus={backendStatus}
      getIncidents={new GetIncidents(repository)}
      getIncidentById={getIncidentById}
    />,
  );
  await waitFor(() => expect(view.getByText('Incidencia sintética')).toBeTruthy());
  await fireEvent.press(view.getByTestId('incident-SYN-001'));
  await waitFor(() => expect(view.getByText('No fue posible cargar el detalle.')).toBeTruthy());
  expect(JSON.stringify(view.toJSON())).not.toContain(privateDetail);
});
