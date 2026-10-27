import { LookupIncidentLocation } from '../src/application/location/LookupIncidentLocation';
import { selectIncidentLocation } from '../src/course-evaluation';
import type { LocationCache, LocationCacheEntry } from '../src/application/location/LocationCache';
import { createLocationFixture, createLocationProviderDouble } from './fixtures/week-09/scenario';
import { createVirtualClock } from './fixtures/week-09/virtualClock';

const valid = { label: 'Zona ficticia', latitude: 0, longitude: 0 };
const manual = { source: 'manual', label: 'Edificio manual' };
const input = { query: '  EDIFICIO\n de prueba A ', manualLabel: manual.label };
function setup(ttl = 300000) {
  let time = 1000;
  const entries = new Map<string, LocationCacheEntry>();
  const cache: LocationCache = { get: jest.fn(async key => entries.get(key) ?? null), put: jest.fn(async (key, value) => { entries.set(key, value); }) };
  const provider = { lookup: jest.fn(async (_query: string): Promise<unknown> => valid) };
  const useCase = new LookupIncidentLocation(provider, cache, { now: () => time }, { cacheTtlMs: ttl, timeoutMs: 1000 });
  return { entries, cache, provider, useCase, now: (value: number) => { time = value; } };
}

test.each([[0, 0], [-90, -180], [90, 180]])('accepts finite boundary coordinates %s/%s through public real logic', (latitude, longitude) => {
  expect(selectIncidentLocation({ ...valid, latitude, longitude }, manual.label)).toEqual({ source: 'provider', ...valid, latitude, longitude });
});
test.each([null, undefined, [], 'text', { status: 429 }, { ...valid, error: true }, { label: 'Zona' },
  { ...valid, latitude: NaN }, { ...valid, latitude: Infinity }, { ...valid, latitude: 91 },
  { ...valid, longitude: -181 }, { ...valid, longitude: '0' }, { ...valid, label: ' ' }, { ...valid, label: 7 }])('invalid external data uses manual without coordinates: %p', value => {
  expect(selectIncidentLocation(value, ' Edificio manual ')).toEqual(manual);
});
test('invalid manual input is rejected even if provider is valid', () => {
  expect(() => selectIncidentLocation(valid, ' ')).toThrow('referencia manual');
});
test('normalizes lookup and cache keys, hits while valid and misses at expiry or clock rollback', async () => {
  const s = setup();
  expect(await s.useCase.execute(input)).toMatchObject({ location: { source: 'provider' }, cacheHit: false });
  expect(s.provider.lookup).toHaveBeenCalledWith('edificio de prueba a');
  expect(await s.useCase.execute({ ...input, query: 'edificio de prueba a' })).toMatchObject({ cacheHit: true });
  expect(s.provider.lookup).toHaveBeenCalledTimes(1);
  s.now(301000); await s.useCase.execute(input);
  expect(s.provider.lookup).toHaveBeenCalledTimes(2);
  s.now(2000); await s.useCase.execute(input);
  expect(s.provider.lookup).toHaveBeenCalledTimes(3);
});
test('normalizes Unicode NFC before both cache and provider', async () => {
  const s = setup(); await s.useCase.execute({ ...input, query: '  ZONA CAFE\u0301 ' });
  expect(s.provider.lookup).toHaveBeenCalledWith('zona café');
  expect(s.cache.get).toHaveBeenCalledWith('zona café');
});
test('TTL zero avoids all cache access; empty query avoids cache and network', async () => {
  const s = setup(0); await s.useCase.execute(input); await s.useCase.execute(input);
  expect(s.cache.get).not.toHaveBeenCalled(); expect(s.cache.put).not.toHaveBeenCalled();
  await expect(s.useCase.execute({ ...input, query: ' ' })).rejects.toMatchObject({ code: 'INVALID_LOCATION_INPUT' });
  expect(s.provider.lookup).toHaveBeenCalledTimes(2);
});
test.each([
  { location: { source: 'provider', ...valid, latitude: 999 }, storedAtMs: 0, expiresAtMs: 2000 },
  { location: { source: 'manual', ...valid }, storedAtMs: 0, expiresAtMs: 2000 },
  { location: { source: 'provider', ...valid }, storedAtMs: Infinity, expiresAtMs: 2000 },
  { location: { source: 'provider', ...valid }, storedAtMs: 0, expiresAtMs: NaN },
  { location: null, storedAtMs: 0, expiresAtMs: 2000 },
])('corrupt cache entry is a miss: %p', async entry => {
  const s = setup(); s.entries.set('edificio de prueba a', entry as LocationCacheEntry);
  await s.useCase.execute(input); expect(s.provider.lookup).toHaveBeenCalledTimes(1);
});
test('cache rejection still allows provider result', async () => {
  const s = setup(); jest.mocked(s.cache.get).mockRejectedValue(new Error('sensitive'));
  jest.mocked(s.cache.put).mockRejectedValue(new Error('sensitive'));
  expect(await s.useCase.execute(input)).toMatchObject({ location: { source: 'provider' } });
});
test.each(['incomplete', 'invalid_coordinates', 'timeout', 'rate_limited', 'offline'] as const)('shared %s fixture remains manual, distinguishable and never cached', async scenario => {
  const s = setup(); const clock = createVirtualClock();
  const provider = createLocationProviderDouble(createLocationFixture(scenario), clock.sleep);
  const useCase = new LookupIncidentLocation(provider, s.cache, clock);
  expect(await useCase.execute(input)).toMatchObject({ location: manual, failure: { kind: scenario } });
  expect(s.cache.put).not.toHaveBeenCalled();
});
test('unexpected rejection is safe, with no original error or query', async () => {
  const s = setup(); s.provider.lookup.mockRejectedValue(new Error('secret query'));
  expect(await s.useCase.execute(input)).toEqual({ location: manual, failure: { kind: 'unavailable' }, cacheHit: false });
});
test.each([{ cacheTtlMs: -1, timeoutMs: 1 }, { cacheTtlMs: Infinity, timeoutMs: 1 },
  { cacheTtlMs: 0, timeoutMs: 0 }, { cacheTtlMs: 0, timeoutMs: NaN }])('rejects invalid configuration %p', config => {
  const s = setup(); expect(() => new LookupIncidentLocation(s.provider, s.cache, { now: () => 0 }, config)).toThrow('configuración');
});
