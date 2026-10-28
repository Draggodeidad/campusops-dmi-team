import { planRetry as publicPlan } from '../src/course-evaluation';
import { decideRetry, planRetry, DEFAULT_RETRY_CONFIGURATION as config, type RetryConfiguration } from '../src/application/resilience/RetryPolicy';
import { parseRetryAfter } from '../src/infrastructure/http/parseRetryAfter';

const input = { method: 'GET', status: 'timeout', attempt: 1 } as const;
test('evaluation reexports the production policy and backoff grows with each failed send', () => {
  expect(publicPlan).toBe(planRetry);
  expect([1, 2, 3].map(attempt => planRetry({ ...input, attempt }).delayMs)).toEqual([250, 500, 1000]);
});
test.each([0, -1, 1.5, 4, 5, Infinity, -Infinity, NaN])('invalid or terminal attempt %s never retries', attempt => {
  expect(planRetry({ ...input, attempt })).toEqual({ retry: false, delayMs: 0, requiresStableIdempotencyKey: false });
});
test.each([429, 500, 502, 503, 504, 'timeout'] as const)('published transient %s retries safely', status => {
  expect(planRetry({ ...input, status }).retry).toBe(true);
});
test.each([0, 200, 201, 400, 401, 403, 404, 408, 409, 422, 501, 505, NaN, Infinity])('status %s does not retry', status => {
  expect(planRetry({ ...input, status }).retry).toBe(false);
});
test.each([undefined, '', 'short', '        ', ' stable-operation', 'stable-operation\n'])('POST key %j cannot authorize retry', idempotencyKey => {
  expect(planRetry({ ...input, method: 'POST', ...(idempotencyKey !== undefined ? { idempotencyKey } : {}) }))
    .toEqual({ retry: false, delayMs: 0, requiresStableIdempotencyKey: true });
});
test('POST identity remains a precondition, including a terminal failure', () => {
  expect(planRetry({ ...input, method: 'POST', status: 503, idempotencyKey: 'resolve-campus-inc-001-op-1' }))
    .toEqual({ retry: true, delayMs: 250, requiresStableIdempotencyKey: false });
  expect(planRetry({ ...input, method: 'POST', attempt: 4 }).requiresStableIdempotencyKey).toBe(true);
});
test.each([0, 800, 5000])('valid server minimum %s is preserved exactly', retryAfterMs => {
  expect(planRetry({ ...input, status: 429, retryAfterMs })).toEqual({ retry: true, delayMs: retryAfterMs, requiresStableIdempotencyKey: false });
});
test.each([-1, NaN, Infinity, -Infinity])('invalid server minimum %s falls back to finite backoff', retryAfterMs => {
  expect(planRetry({ ...input, status: 429, retryAfterMs }).delayMs).toBe(250);
});
test('a valid server minimum is never truncated to the cap or remaining budget', () => {
  expect(planRetry({ ...input, retryAfterMs: 5001 }).retry).toBe(false);
  expect(decideRetry({ ...input, retryAfterMs: 800 }, config, 799).retry).toBe(false);
  expect(decideRetry({ ...input, retryAfterMs: 800 }, config, 800).retry).toBe(false);
  expect(decideRetry({ ...input, retryAfterMs: 800 }, config, 801).delayMs).toBe(800);
});
test('configuration reduces attempts, caps backoff and rejects incoherent limits', () => {
  const small: RetryConfiguration = { maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 150, maxElapsedMs: 1000 };
  expect(decideRetry({ ...input, attempt: 2 }, small, 1000).delayMs).toBe(150);
  expect(decideRetry({ ...input, attempt: 3 }, small, 1000).retry).toBe(false);
  for (const invalid of [{ maxAttempts: 5 }, { maxAttempts: 1.5 }, { baseDelayMs: -1 }, { baseDelayMs: Infinity },
    { maxDelayMs: 0 }, { maxElapsedMs: NaN }, { maxElapsedMs: 100 }, { maxElapsedMs: 2147483648 }]) {
    expect(decideRetry(input, { ...config, ...invalid } as RetryConfiguration, 10000).retry).toBe(false);
  }
  for (const left of [0, -1, Infinity, NaN]) expect(decideRetry(input, config, left).retry).toBe(false);
});
test('Retry-After seconds and HTTP dates normalize against injected epoch time', () => {
  const now = Date.UTC(2026, 9, 27);
  expect(parseRetryAfter('0', now)).toBe(0);
  expect(parseRetryAfter('0.8', now)).toBe(800);
  expect(parseRetryAfter(' 1 ', now)).toBe(1000);
  expect(parseRetryAfter(new Date(now + 2000).toUTCString(), now)).toBe(2000);
  for (const value of [undefined, '', 'Infinity', 'NaN', '-1', '1e3', '1 second', new Date(now - 1000).toUTCString(), '9'.repeat(400)]) {
    expect(parseRetryAfter(value, now)).toBeUndefined();
  }
  expect(parseRetryAfter('1', Infinity)).toBeUndefined();
});
