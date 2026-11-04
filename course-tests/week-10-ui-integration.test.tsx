import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { ApplicationFailure } from '../src/application/errors/ApplicationFailure';
import { GetIncidentById } from '../src/application/incidents/GetIncidentById';
import { GetIncidents } from '../src/application/incidents/GetIncidents';
import { PerformIncidentAction } from '../src/application/incidents/PerformIncidentAction';
import type { SessionController } from '../src/application/session/SessionController';
import { GetBackendStatus } from '../src/application/system/GetBackendStatus';
import type { Incident } from '../src/domain/incidents/Incident';
import type { IncidentRepository } from '../src/domain/incidents/IncidentRepository';
import { FetchIncidentTransport } from '../src/infrastructure/http/FetchIncidentTransport';
import { HttpIncidentRepository } from '../src/infrastructure/incidents/HttpIncidentRepository';
import { CampusOpsApp } from '../src/ui/CampusOpsApp';
import { createDeferred } from './fixtures/week-06/deferred';
import { incidentA, incidentB } from './fixtures/week-10';

function app(repository: IncidentRepository) {
  return {
    getIncidents: new GetIncidents(repository),
    getIncidentById: new GetIncidentById(repository),
    getBackendStatus: new GetBackendStatus({ check: async () => {} }),
  };
}

test.each(['before', 'after'])('A arriving %s B leaves only the active detail eligible to settle', async order => {
  const a = createDeferred<Incident>();
  const b = createDeferred<Incident>();
  const findById = jest.fn((id: string, _signal?: AbortSignal) => id === incidentA.id ? a.promise : b.promise);
  await render(<CampusOpsApp {...app({ findAll: async () => [incidentA, incidentB], findById })} />);

  await fireEvent.press(await screen.findByRole('button', { name: new RegExp(incidentA.title) }));
  expect(screen.getByRole('progressbar', { name: 'Cargando detalle…' })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: '← Volver a incidencias' }));
  await fireEvent.press(screen.getByRole('button', { name: new RegExp(incidentB.title) }));
  expect(findById.mock.calls[0]?.[1]?.aborted).toBe(true);

  if (order === 'before') {
    await act(async () => a.resolve(incidentA));
    expect(screen.getByRole('progressbar', { name: 'Cargando detalle…' })).toBeOnTheScreen();
  }
  await act(async () => b.resolve(incidentB));
  if (order === 'after') await act(async () => a.resolve(incidentA));

  expect(screen.getByRole('header', { name: incidentB.title })).toBeOnTheScreen();
  expect(screen.queryByRole('header', { name: incidentA.title })).toBeNull();
  expect(screen.queryByRole('progressbar')).toBeNull();
});

test('detail cancellation and retry isolate a late failure for the same selection', async () => {
  const original = createDeferred<Incident>();
  const retried = createDeferred<Incident | null>();
  const findById = jest.fn<Promise<Incident | null>, [string, AbortSignal?]>()
    .mockReturnValueOnce(original.promise).mockReturnValueOnce(retried.promise);
  await render(<CampusOpsApp {...app({ findAll: async () => [incidentA], findById })} />);

  await fireEvent.press(await screen.findByRole('button', { name: new RegExp(incidentA.title) }));
  await fireEvent.press(screen.getByRole('button', { name: 'Cancelar detalle' }));
  expect(screen.getByText('Espera cancelada.')).toBeOnTheScreen();
  expect(screen.queryByRole('progressbar')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Reintentar detalle' }));
  expect(findById.mock.calls[1]?.[1]).not.toBe(findById.mock.calls[0]?.[1]);
  await act(async () => original.reject(new Error('fallo sintético tardío')));
  expect(screen.getByRole('progressbar', { name: 'Cargando detalle…' })).toBeOnTheScreen();
  await act(async () => retried.resolve(null));

  expect(screen.getByText('La incidencia solicitada no existe.')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Actualizar detalle' })).toBeOnTheScreen();
  expect(screen.queryByRole('progressbar')).toBeNull();
});

test('list cancellation reaches fetch and a failed retry can reload an empty list', async () => {
  let firstSignal: AbortSignal | null | undefined;
  const fetchMock = jest.spyOn(global, 'fetch')
    .mockImplementationOnce((_url, init) => {
      firstSignal = init?.signal;
      return new Promise((_resolve, reject) => firstSignal?.addEventListener('abort', () => {
        reject(Object.assign(new Error('synthetic abort'), { name: 'AbortError' }));
      }));
    })
    .mockRejectedValueOnce(new Error('synthetic offline'))
    .mockResolvedValueOnce({ status: 200, headers: new Headers(), text: async () => '{"items":[]}' } as Response);
  try {
    await render(<CampusOpsApp {...app(new HttpIncidentRepository(new FetchIncidentTransport('http://127.0.0.1:4310')))} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar lista' }));
    expect(firstSignal?.aborted).toBe(true);
    expect(screen.getByText('Espera cancelada.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Reintentar lista' }));
    expect(await screen.findByRole('alert', { name: 'No hay conexión con el servicio.' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Reintentar lista' }));
    expect(await screen.findByText('No hay incidencias registradas.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Actualizar lista' })).toBeOnTheScreen();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  } finally {
    fetchMock.mockRestore();
  }
});

const technician: SessionController = {
  getSnapshot: () => ({
    generation: 1, state: 'authenticated', role: 'technician', actorId: 'technician-1', expiresAt: null,
  }),
  subscribe: () => () => {},
  login: async () => {},
  logout: async () => {},
  restore: async () => {},
  refresh: async () => {},
};

test('cancelled attention ignores its receipt and recovery reads before offering another write', async () => {
  const original = { ...incidentA, version: 1 };
  const committed = { ...original, version: 2, status: 'in_progress' } as const;
  const action = createDeferred<Incident>();
  const performAction = jest.fn(() => action.promise);
  const findById = jest.fn().mockResolvedValueOnce(original).mockResolvedValueOnce(committed);
  const repository = { findAll: async () => [original], findById, performAction };

  await render(<CampusOpsApp {...app(repository)} sessionController={technician}
    performIncidentAction={new PerformIncidentAction(repository)} />);
  await fireEvent.press(await screen.findByRole('button', { name: new RegExp(incidentA.title) }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Iniciar atención' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Cancelar atención' }));

  expect(screen.getByText('Espera cancelada.')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Iniciar atención' })).toBeDisabled();
  expect(screen.queryByRole('progressbar')).toBeNull();
  await act(async () => action.resolve(committed));
  expect(screen.getByText('Estado: assigned')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Consultar estado de atención' }));
  expect(await screen.findByRole('button', { name: 'Resolver incidencia' })).toBeEnabled();
  expect(performAction).toHaveBeenCalledTimes(1);
  expect(findById).toHaveBeenCalledTimes(2);
});

test('an active attention failure exits loading and offers an accessible status check', async () => {
  const original = { ...incidentA, version: 1 };
  const repository: IncidentRepository = {
    findAll: async () => [original],
    findById: async () => original,
    performAction: async () => {
      throw new ApplicationFailure('VERSION_CONFLICT', 'La versión cambió.');
    },
  };
  await render(<CampusOpsApp {...app(repository)} sessionController={technician}
    performIncidentAction={new PerformIncidentAction(repository)} />);
  await fireEvent.press(await screen.findByRole('button', { name: new RegExp(incidentA.title) }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Iniciar atención' }));
  expect(await screen.findByRole('alert', { name: 'La versión cambió.' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Consultar estado de atención' })).toBeOnTheScreen();
  expect(screen.queryByRole('progressbar')).toBeNull();
});
