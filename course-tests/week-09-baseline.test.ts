import type { LocationCache, LocationCacheEntry } from '../src/application/location/LocationCache';
import type { RetryPolicy } from '../src/application/resilience/RetryPolicy';
import type { planRetry } from '../src/course-evaluation';
import {
  createLocationFixture, createLocationProviderDouble, createLostResponseFixture,
  LOCATION_QUERY, NORMALIZED_LOCATION_QUERY,
} from './fixtures/week-09/scenario';
import { createVirtualClock } from './fixtures/week-09/virtualClock';

// Bidirectional assignment checks the public signature without calling its pending stub.
const samePublicPolicy: (policy: typeof planRetry) => RetryPolicy = policy => policy;
const sameApplicationPolicy: (policy: RetryPolicy) => typeof planRetry = policy => policy;

test('published policy types remain compatible and cache port can be substituted', async () => {
  const policy: RetryPolicy = () => ({ retry: false, delayMs: 0, requiresStableIdempotencyKey: false });
  expect(sameApplicationPolicy(samePublicPolicy(policy))).toBe(policy);
  const entries = new Map<string, LocationCacheEntry>();
  const cache: LocationCache = {
    async get(key) { return entries.get(key) ?? null; },
    async put(key, entry) { entries.set(key, entry); },
  };
  const clock = createVirtualClock(100);
  const entry: LocationCacheEntry = { location: { source: 'provider', label: LOCATION_QUERY, latitude: 0, longitude: 0 },
    storedAtMs: clock.now(), expiresAtMs: clock.now() + 300000 };
  expect(await cache.get(NORMALIZED_LOCATION_QUERY)).toBeNull();
  await cache.put(NORMALIZED_LOCATION_QUERY, entry);
  expect(await cache.get(NORMALIZED_LOCATION_QUERY)).toEqual(entry);
  clock.advance(300000);
  expect(clock.now()).toBe(entry.expiresAtMs); // The future use case must reject this expired entry.
});

test('controlled provider waits on injected time and gives isolated raw responses', async () => {
  const clock = createVirtualClock(0);
  const fixture = createLocationFixture('slow');
  const provider = createLocationProviderDouble(fixture, clock.sleep);
  const first = await provider.lookup(LOCATION_QUERY) as { label: string };
  first.label = 'Modified test copy';
  expect(await provider.lookup(LOCATION_QUERY)).toEqual({ label: LOCATION_QUERY, latitude: 0, longitude: 0 });
  expect(provider.queries).toEqual([LOCATION_QUERY, LOCATION_QUERY]);
  expect(clock.delays).toEqual([1200, 1200]);
  expect(clock.now()).toBe(2400);
});

test('failure fixtures distinguish unavailable transport from invalid raw data', async () => {
  const clock = createVirtualClock();
  for (const kind of ['timeout', 'rate_limited', 'offline'] as const) {
    const provider = createLocationProviderDouble(createLocationFixture(kind), clock.sleep);
    expect(await provider.lookup(LOCATION_QUERY)).toEqual({ available: false,
      failure: { kind, ...(kind === 'rate_limited' ? { retryAfterMs: 1000 } : {}) } });
  }
  expect(createLocationFixture('incomplete').response).toEqual({ label: 'Zona ficticia' });
  expect(createLocationFixture('invalid_coordinates').response).toEqual({ label: 'Zona ficticia', latitude: 999, longitude: null });
  await expect(clock.sleep(Infinity)).rejects.toThrow('Invalid virtual delay');
  await expect(clock.sleep(-1)).rejects.toThrow('Invalid virtual delay');
  expect(clock.delays).toEqual([]);
});

test('lost-response fixture preserves the W08 serialization and independent lifecycle inputs', () => {
  const first = createLostResponseFixture();
  const second = createLostResponseFixture();
  expect(first).toEqual(second);
  expect(first.operation).not.toBe(second.operation);
  expect(first.request.operationId).toBe(first.operation.operationId);
  expect(JSON.parse(first.request.body)).toEqual({ ...first.operation.payload,
    action: first.operation.action, baseVersion: first.operation.baseVersion });
  expect(first.operation.baseVersion).toBe(first.preparation.body.baseVersion + 1);
  expect(first.close.body.baseVersion).toBe(first.expected.version);
});
