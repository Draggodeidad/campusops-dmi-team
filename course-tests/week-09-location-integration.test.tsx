import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { createGraph } from '../App';
import { LookupIncidentLocation } from '../src/application/location/LookupIncidentLocation';
import { MemoryLocationCache } from '../src/infrastructure/location/MemoryLocationCache';
import { CreateIncidentScreen } from '../src/ui/incidents/CreateIncidentScreen';
import { CampusOpsApp } from '../src/ui/CampusOpsApp';
import { createDeferred } from './fixtures/week-06/deferred';
import { startLocalBackend } from './fixtures/week-06/localBackend';
import { createLocationFixture, createLocationProviderDouble } from './fixtures/week-09/scenario';
import { createVirtualClock } from './fixtures/week-09/virtualClock';
import { createTemporaryWorkspace } from './fixtures/week-08/temporaryWorkspace';
import { createNodeWorkspace } from './fixtures/week-08/nodeWorkspace';
import { SyncNetwork } from './fixtures/week-08/syncNetwork';

jest.mock('../src/api/courseBackend', () => ({ getBackendHealth: jest.fn().mockResolvedValue({ ok: true }) }));
const raw = { label: 'Zona del proveedor ficticia', latitude: 0, longitude: 0 };
const makeLookup = (lookup: (query: string) => Promise<unknown> = async () => raw) =>
  new LookupIncidentLocation({ lookup }, new MemoryLocationCache(), { now: () => 1000 });
async function screen(useCase = makeLookup()) {
  const onSubmit = jest.fn(); const onCancel = jest.fn();
  const view = await render(<CreateIncidentScreen loading={false} error={null} lookupIncidentLocation={useCase} onSubmit={onSubmit} onCancel={onCancel} />);
  await fireEvent.changeText(view.getByTestId('create-description-input'), 'Descripción sintética');
  await fireEvent.changeText(view.getByTestId('create-location-input'), 'Referencia manual ficticia');
  await fireEvent.changeText(view.getByTestId('location-query-input'), 'Edificio de prueba A');
  return { view, onSubmit, onCancel };
}

test('search is explicit, does not transmit manual text and requires acceptance', async () => {
  const provider = jest.fn(async () => raw); const s = await screen(makeLookup(provider));
  expect(provider).not.toHaveBeenCalled();
  await fireEvent.press(s.view.getByTestId('location-search-button'));
  await waitFor(() => expect(s.view.getByTestId('location-candidate')).toBeTruthy());
  expect(provider).toHaveBeenCalledWith('edificio de prueba a');
  await fireEvent.press(s.view.getByTestId('create-submit-button'));
  expect(s.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ locationLabel: 'Referencia manual ficticia' }));
  await fireEvent.press(s.view.getByTestId('location-accept-button'));
  await fireEvent.press(s.view.getByTestId('create-submit-button'));
  expect(s.onSubmit).toHaveBeenLastCalledWith(expect.objectContaining({ locationLabel: raw.label }));
});
test('manual editing and explicit manual choice clear accepted provider; repeat lookup reports a cache hit', async () => {
  const provider = jest.fn(async () => raw); const s = await screen(makeLookup(provider));
  await fireEvent.press(s.view.getByTestId('location-search-button'));
  await waitFor(() => expect(s.view.getByTestId('location-candidate')).toBeTruthy());
  await fireEvent.press(s.view.getByTestId('location-accept-button'));
  await fireEvent.changeText(s.view.getByTestId('create-location-input'), 'Otra zona ficticia');
  expect(s.view.queryByTestId('location-candidate')).toBeNull();
  await fireEvent.press(s.view.getByTestId('location-search-button'));
  await waitFor(() => expect(s.view.getByText(/desde caché/)).toBeTruthy());
  expect(provider).toHaveBeenCalledTimes(1);
  await fireEvent.press(s.view.getByTestId('location-accept-button'));
  await fireEvent.press(s.view.getByTestId('location-manual-button'));
  await fireEvent.press(s.view.getByTestId('create-submit-button'));
  expect(s.onSubmit).toHaveBeenLastCalledWith(expect.objectContaining({ locationLabel: 'Otra zona ficticia' }));
});
test.each(['edit', 'query', 'manual', 'cancel', 'submit', 'unmount'] as const)('late responses are ignored after %s', async action => {
  const pending = createDeferred<unknown>(); const s = await screen(makeLookup(() => pending.promise));
  await fireEvent.press(s.view.getByTestId('location-search-button'));
  expect(s.view.getByTestId('location-search-loading')).toBeTruthy();
  if (action === 'edit') await fireEvent.changeText(s.view.getByTestId('create-location-input'), 'Nueva referencia ficticia');
  if (action === 'query') await fireEvent.changeText(s.view.getByTestId('location-query-input'), 'Otra consulta ficticia');
  if (action === 'manual') await fireEvent.press(s.view.getByTestId('location-manual-button'));
  if (action === 'cancel') await fireEvent.press(s.view.getByTestId('create-cancel-button'));
  if (action === 'submit') {
    await fireEvent.press(s.view.getByTestId('create-submit-button'));
    expect(s.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ locationLabel: 'Referencia manual ficticia' }));
  }
  if (action === 'unmount') await s.view.unmount();
  await act(async () => pending.resolve(raw));
  if (action !== 'unmount') expect(s.view.queryByTestId('location-candidate')).toBeNull();
});
test('query/manual validation is visible without losing form contents', async () => {
  const provider = jest.fn(async () => raw); const s = await screen(makeLookup(provider));
  await fireEvent.changeText(s.view.getByTestId('create-location-input'), ' ');
  await fireEvent.press(s.view.getByTestId('location-search-button'));
  await waitFor(() => expect(s.view.getByTestId('location-search-error')).toBeTruthy());
  expect(provider).not.toHaveBeenCalled();
  expect(s.view.getByTestId('create-description-input').props.value).toBe('Descripción sintética');
});

describe('composition/UI with actual local backend and durable W08 workspace', () => {
  let backend: Awaited<ReturnType<typeof startLocalBackend>>;
  let fixture: Awaited<ReturnType<typeof createTemporaryWorkspace<ReturnType<typeof createNodeWorkspace>>>>;
  beforeEach(async () => { backend = await startLocalBackend(); fixture = await createTemporaryWorkspace(createNodeWorkspace); });
  afterEach(async () => { await fixture.cleanup(); await backend.stop(); });
  async function graph(lookup: (query: string) => Promise<unknown>) {
    let secret: string | null = null;
    const app = createGraph({ useHttp: true, transport: new SyncNetwork(backend.baseUrl), localWorkspace: await fixture.reopen(),
      secretStore: { read: async () => secret, save: async value => { secret = value; }, clear: async () => { secret = null; } },
      locationProvider: { lookup } });
    await app.sessionController.login('reporter-1'); return app;
  }
  test.each(['success', 'incomplete', 'invalid_coordinates', 'timeout', 'rate_limited', 'offline'] as const)('%s still creates with chosen or manual location', async scenario => {
    const clock = createVirtualClock(); const provider = createLocationProviderDouble(createLocationFixture(scenario), clock.sleep);
    const app = await graph(provider.lookup); const view = await render(<CampusOpsApp {...app} />);
    await waitFor(() => expect(view.getByTestId('open-create-incident')).toBeTruthy());
    await fireEvent.press(view.getByTestId('open-create-incident'));
    await fireEvent.changeText(view.getByTestId('create-description-input'), 'Incidencia W09 sintética');
    await fireEvent.changeText(view.getByTestId('create-location-input'), 'Zona manual ficticia');
    await fireEvent.changeText(view.getByTestId('location-query-input'), 'Edificio de prueba A');
    await fireEvent.press(view.getByTestId('location-search-button'));
    await waitFor(() => expect(view.queryByTestId('location-search-loading')).toBeNull());
    if (scenario === 'success') await fireEvent.press(view.getByTestId('location-accept-button'));
    else expect(view.getByText(/Puedes continuar con tu referencia manual/)).toBeTruthy();
    await fireEvent.press(view.getByTestId('create-submit-button'));
    await waitFor(() => expect(view.getByTestId('open-create-incident')).toBeTruthy());
    const incidents = await app.getIncidents.execute();
    expect(incidents.find(incident => incident.description === 'Incidencia W09 sintética')?.locationLabel)
      .toBe(scenario === 'success' ? 'Edificio de prueba A' : 'Zona manual ficticia');
  });
  test('a session generation change unmounts the form and ignores old lookup', async () => {
    const pending = createDeferred<unknown>(); const app = await graph(() => pending.promise);
    const view = await render(<CampusOpsApp {...app} />);
    await waitFor(() => expect(view.getByTestId('open-create-incident')).toBeTruthy());
    await fireEvent.press(view.getByTestId('open-create-incident'));
    await fireEvent.changeText(view.getByTestId('create-location-input'), 'Zona manual ficticia');
    await fireEvent.changeText(view.getByTestId('location-query-input'), 'Consulta ficticia');
    await fireEvent.press(view.getByTestId('location-search-button'));
    await act(async () => app.sessionController.logout());
    await act(async () => pending.resolve(raw));
    expect(view.queryByTestId('location-candidate')).toBeNull();
    expect(view.queryByTestId('create-submit-button')).toBeNull();
  });
});
