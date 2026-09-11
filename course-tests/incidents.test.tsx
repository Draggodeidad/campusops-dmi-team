import { fireEvent, render, waitFor } from '@testing-library/react-native';

import App from '../App';
import { GetIncidentById } from '../src/application/incidents/GetIncidentById';
import { GetIncidents } from '../src/application/incidents/GetIncidents';
import type { Incident } from '../src/domain/incidents/Incident';
import type { IncidentRepository } from '../src/domain/incidents/IncidentRepository';

jest.mock('../src/api/courseBackend', () => ({
  getBackendHealth: jest.fn().mockResolvedValue({
    ok: true,
    service: 'dmi-controlled-backend',
    contractVersion: 1,
  }),
}));

test('opens an incident from the list and returns from its detail', async () => {
  const view = await render(<App />);

  await waitFor(() => expect(view.getByText('Fuga de agua en laboratorio')).toBeTruthy());
  await fireEvent.press(view.getByTestId('incident-INC-001'));

  await waitFor(() => expect(view.getByTestId('incident-detail')).toBeTruthy());
  expect(view.getByText('ID: INC-001')).toBeTruthy();
  expect(view.getByText('Ubicación: Laboratorio B-204')).toBeTruthy();

  await fireEvent.press(view.getByTestId('back-to-incidents'));
  await waitFor(() => expect(view.getByText('Incidencias')).toBeTruthy());
});

test('application use cases accept a substitute repository', async () => {
  const substituteIncident: Incident = {
    id: 'SUB-001',
    title: 'Incidencia sustituida',
    description: 'Dato devuelto por un repositorio alternativo.',
    category: 'maintenance',
    status: 'open',
    locationLabel: 'Zona de prueba',
  };
  const substitute: IncidentRepository = {
    findAll: async () => [substituteIncident],
    findById: async (id) => (id === substituteIncident.id ? substituteIncident : null),
  };

  await expect(new GetIncidents(substitute).execute()).resolves.toEqual([substituteIncident]);
  await expect(new GetIncidentById(substitute).execute('SUB-001')).resolves.toEqual(
    substituteIncident,
  );
});
