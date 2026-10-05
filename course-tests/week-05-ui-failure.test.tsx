import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { GetIncidentById } from '../src/application/incidents/GetIncidentById';
import { GetIncidents } from '../src/application/incidents/GetIncidents';
import { GetBackendStatus } from '../src/application/system/GetBackendStatus';
import type { IncidentTransport, TransportResponse } from '../src/infrastructure/http/IncidentTransport';
import { HttpIncidentRepository } from '../src/infrastructure/incidents/HttpIncidentRepository';
import { CampusOpsApp } from '../src/ui/CampusOpsApp';

const validEnvelope = {
  id: 'synthetic-inc-1',
  version: 1,
  status: 'open',
  payload: {
    category: 'water',
    description: 'Fuga sintética',
    location: 'Laboratorio ficticio',
  },
};

function response(status: number, body: unknown): TransportResponse {
  return { status, headers: {}, bodyText: JSON.stringify(body) };
}

function renderWithTransport(transport: IncidentTransport) {
  const repository = new HttpIncidentRepository(transport);
  return render(
    <CampusOpsApp
      getBackendStatus={new GetBackendStatus({ check: async () => undefined })}
      getIncidents={new GetIncidents(repository)}
      getIncidentById={new GetIncidentById(repository)}
    />,
  );
}

describe('Week 05 — fallas remotas distinguibles en UI', () => {
  it.each([
    ['contrato', response(200, { items: 'invalid' }), 'El servidor devolvió datos inválidos.'],
    ['servidor', response(500, { code: 'synthetic' }), 'El servidor informó un error temporal (500).'],
  ])('muestra el error de %s en la lista', async (_label, remote, expected) => {
    const view = await renderWithTransport({ send: async () => remote });
    await waitFor(() => expect(view.getByText(expected)).toBeTruthy());
    expect(view.queryByText('No hay incidencias registradas.')).toBeNull();
  });

  it('muestra timeout en la lista sin propagar el error técnico', async () => {
    const transport: IncidentTransport = {
      send: async () => {
        const error = new Error('synthetic provider detail must not appear');
        error.name = 'TimeoutError';
        throw error;
      },
    };
    const view = await renderWithTransport(transport);
    await waitFor(() => expect(view.getByText('El servicio tardó demasiado en responder.')).toBeTruthy());
    expect(view.queryByText('synthetic provider detail must not appear')).toBeNull();
  });

  it.each([
    ['ausente', response(404, { code: 'not_found' }), 'La incidencia solicitada no existe.'],
    [
      'payload nulo',
      response(200, { ...validEnvelope, payload: null }),
      'Los datos de la incidencia no están disponibles.',
    ],
    [
      'servidor',
      response(500, { code: 'synthetic' }),
      'El servidor informó un error temporal (500).',
    ],
  ])('distingue detalle %s', async (_label, detailResponse, expected) => {
    const transport: IncidentTransport = {
      send: async (request) =>
        request.path === '/v1/incidents'
          ? response(200, { items: [validEnvelope] })
          : detailResponse,
    };
    const view = await renderWithTransport(transport);
    await waitFor(() => expect(view.getByTestId('incident-synthetic-inc-1')).toBeTruthy());
    await fireEvent.press(view.getByTestId('incident-synthetic-inc-1'));
    await waitFor(() => expect(view.getByText(expected)).toBeTruthy());
    expect(view.queryByTestId('incident-detail')).toBeNull();
  });
});
