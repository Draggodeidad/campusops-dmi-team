import { render, waitFor } from '@testing-library/react-native';

import { GetIncidentById } from '../src/application/incidents/GetIncidentById';
import { GetIncidents } from '../src/application/incidents/GetIncidents';
import { GetBackendStatus } from '../src/application/system/GetBackendStatus';
import { ApplicationFailure } from '../src/application/errors/ApplicationFailure';
import { FetchIncidentTransport } from '../src/infrastructure/http/FetchIncidentTransport';
import { HttpIncidentRepository } from '../src/infrastructure/incidents/HttpIncidentRepository';
import { CampusOpsApp } from '../src/ui/CampusOpsApp';

function responseWithBody(status: number, bodyText: string): Response {
  return {
    status,
    text: async () => bodyText,
    headers: { forEach: () => undefined },
  } as unknown as Response;
}

describe('Week 05 transport and invalid DTO boundaries', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('converts a real AbortController timeout to TimeoutError', async () => {
    const controlledFetch = jest.spyOn(global, 'fetch').mockImplementation((...args) => {
      const [, init] = args;
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => {
            const error = new Error('synthetic abort');
            error.name = 'AbortError';
            reject(error);
          },
          { once: true },
        );
        if (init?.signal?.aborted) {
          const error = new Error('synthetic abort');
          error.name = 'AbortError';
          reject(error);
        }
      });
    });

    const transport = new FetchIncidentTransport('http://controlled.test', 5);
    await expect(
      transport.send({ method: 'GET', path: '/v1/incidents' }),
    ).rejects.toMatchObject({ name: 'TimeoutError' });
    expect(controlledFetch).toHaveBeenCalledTimes(1);
  });

  it('does not render a DTO rejected by the real repository mapper', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      responseWithBody(
        200,
        JSON.stringify({
          items: [
            {
              id: 'synthetic-invalid-incident',
              version: 1,
              status: 'open',
              payload: {
                category: 'invalid-category',
                description: 'synthetic invalid DTO must not reach UI',
                location: 'synthetic location',
              },
            },
          ],
        }),
      ),
    );

    const repository = new HttpIncidentRepository(
      new FetchIncidentTransport('http://controlled.test'),
    );
    const getIncidents = new GetIncidents(repository);
    const view = await render(
      <CampusOpsApp
        getBackendStatus={new GetBackendStatus({ check: async () => undefined })}
        getIncidents={getIncidents}
        getIncidentById={new GetIncidentById(repository)}
      />,
    );

    await waitFor(() => expect(view.getByText('No hay incidencias registradas.')).toBeTruthy());
    expect(view.queryByText('synthetic invalid DTO must not reach UI')).toBeNull();
    expect(view.queryByTestId('incident-synthetic-invalid-incident')).toBeNull();
  });

  it('maps malformed JSON into a controlled application failure', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(responseWithBody(200, '{invalid-json'));
    const repository = new HttpIncidentRepository(
      new FetchIncidentTransport('http://controlled.test'),
    );

    await expect(repository.findAll()).rejects.toMatchObject({
      name: 'ApplicationFailure',
      code: 'INCIDENTS_UNAVAILABLE',
      message: 'Respuesta del servidor malformada.',
    });
  });

  it('maps HTTP 500 to its declared typed application failure code', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(responseWithBody(500, '{"code":"synthetic"}'));
    const repository = new HttpIncidentRepository(
      new FetchIncidentTransport('http://controlled.test'),
    );

    await expect(repository.findAll()).rejects.toBeInstanceOf(ApplicationFailure);
    await expect(repository.findAll()).rejects.toMatchObject({
      code: 'INCIDENTS_UNAVAILABLE',
      message: 'El servicio de incidencias no está disponible (error 500).',
    });
  });
});