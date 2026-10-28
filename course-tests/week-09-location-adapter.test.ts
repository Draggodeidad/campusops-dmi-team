import { PhotonLocationProvider, parseLocationRetryAfter } from '../src/infrastructure/location/PhotonLocationProvider';
import { MemoryLocationCache } from '../src/infrastructure/location/MemoryLocationCache';
import { FetchIncidentTransport } from '../src/infrastructure/http/FetchIncidentTransport';
import { selectIncidentLocation } from '../src/course-evaluation';
import type { LocationCacheEntry } from '../src/application/location/LocationCache';

const feature = { type: 'Feature', properties: { name: 'Zona sintética', city: 'Campus ficticio' }, geometry: { type: 'Point', coordinates: [12, 34] } };
const envelope = (features: unknown[] = [feature]) => ({ type: 'FeatureCollection', features });
const response = (value: unknown) => ({ status: 200, headers: {}, bodyText: JSON.stringify(value) });
const config = { timeoutMs: 250, cacheTtlMs: 300000 };
const clock = { now: () => 0 };
function setup(value: unknown = envelope()) {
  const send = jest.fn(async () => response(value));
  return { send, provider: new PhotonLocationProvider({ send }, clock, config) };
}

test('Photon maps GeoJSON axes without coercion and sends no session or auth', async () => {
  const s = setup(); const raw = await s.provider.lookup('zona sintética');
  expect(selectIncidentLocation(raw, 'Manual')).toEqual({ source: 'provider', label: 'Zona sintética, Campus ficticio', latitude: 34, longitude: 12 });
  expect(s.send).toHaveBeenCalledWith({ method: 'GET', path: '/api/?q=zona%20sint%C3%A9tica&limit=1', timeoutMs: 250 });
});
test.each([envelope([]), null, {}, { type: 'FeatureCollection', features: 'x' }, envelope([null]),
  envelope([{ ...feature, geometry: null }]), envelope([{ ...feature, geometry: { type: 'Point', coordinates: [] } }]),
  envelope([{ ...feature, geometry: { type: 'Point', coordinates: ['0', 0] } }]),
  envelope([{ ...feature, geometry: { type: 'Point', coordinates: [0, 91] } }]),
  envelope([{ ...feature, properties: {} }]), envelope([{ ...feature, geometry: { type: 'Polygon', coordinates: [0, 0] } }])])('empty/corrupt wire response uses manual: %p', async body => {
  const s = setup(body); expect(selectIncidentLocation(await s.provider.lookup('zona ficticia'), 'Manual')).toEqual({ source: 'manual', label: 'Manual' });
});
test('malformed JSON and HTTP errors are safe unavailable results', async () => {
  const s = setup(); s.send.mockResolvedValue({ status: 200, headers: {}, bodyText: '{bad' });
  expect(await s.provider.lookup('x')).toEqual({ available: false, failure: { kind: 'invalid_response' } });
  s.send.mockResolvedValue({ status: 500, headers: {}, bodyText: 'private' });
  expect(await s.provider.lookup('x')).toEqual({ available: false, failure: { kind: 'unavailable' } });
});
test.each([['0', 0], ['1', 1000], ['0.5', 500], ['Tue, 27 Oct 2026 00:00:01 GMT', 1000], ['-1', undefined], ['bad', undefined], ['Infinity', undefined]])('parses safe Retry-After %s', (text, expected) => {
  expect(parseLocationRetryAfter(text as string, Date.parse('Tue, 27 Oct 2026 00:00:00 GMT'))).toBe(expected);
});
test('429 prevents another request until its delay expires, including case-insensitive headers', async () => {
  let now = 0; const send = jest.fn(async () => ({ status: 429, headers: { 'Retry-After': '1' }, bodyText: 'private' }));
  const provider = new PhotonLocationProvider({ send }, { now: () => now });
  expect(await provider.lookup('x')).toEqual({ available: false, failure: { kind: 'rate_limited', retryAfterMs: 1000 } });
  now = 500; expect(await provider.lookup('x')).toMatchObject({ failure: { retryAfterMs: 500 } });
  expect(send).toHaveBeenCalledTimes(1);
  now = 1000; await provider.lookup('x'); expect(send).toHaveBeenCalledTimes(2);
});
test('invalid Retry-After does not leak headers or nonfinite delays', async () => {
  const send = jest.fn(async () => ({ status: 429, headers: { 'retry-after': '1e999' }, bodyText: 'private' }));
  expect(await new PhotonLocationProvider({ send }, clock).lookup('x')).toEqual({ available: false, failure: { kind: 'rate_limited' } });
});
test('disconnect and unexpected transport errors contain no original message', async () => {
  const s = setup(); s.send.mockRejectedValue(new Error('private endpoint'));
  expect(await s.provider.lookup('x')).toEqual({ available: false, failure: { kind: 'offline' } });
});
test('real fetch transport aborts hanging HTTP and clears the timer', async () => {
  jest.useFakeTimers(); const previous = global.fetch; let signal: AbortSignal | undefined;
  global.fetch = jest.fn((_url, init) => new Promise((_resolve, reject) => {
    signal = init?.signal ?? undefined;
    signal?.addEventListener('abort', () => { const error = new Error('private'); error.name = 'AbortError'; reject(error); });
  }));
  try {
    const provider = new PhotonLocationProvider(new FetchIncidentTransport('https://synthetic.invalid'), clock, config);
    const pending = provider.lookup('ficticio'); await jest.advanceTimersByTimeAsync(250);
    expect(await pending).toEqual({ available: false, failure: { kind: 'timeout' } });
    expect(signal?.aborted).toBe(true); expect(jest.getTimerCount()).toBe(0);
  } finally { global.fetch = previous; jest.useRealTimers(); }
});
test('LRU cache is capped at 50, clones values and rejects invalid writes', async () => {
  const cache = new MemoryLocationCache();
  const entry: LocationCacheEntry = { location: { source: 'provider', label: 'Zona ficticia', latitude: 0, longitude: 0 }, storedAtMs: 0, expiresAtMs: 1000 };
  for (let i = 0; i < 50; i++) await cache.put(String(i), entry);
  const copy = (await cache.get('0'))!; (copy.location as { label: string }).label = 'changed';
  await cache.put('50', entry);
  expect(await cache.get('1')).toBeNull(); expect((await cache.get('0'))?.location.label).toBe('Zona ficticia');
  await cache.put('bad', { ...entry, location: { ...entry.location, latitude: NaN } }); expect(await cache.get('bad')).toBeNull();
});
