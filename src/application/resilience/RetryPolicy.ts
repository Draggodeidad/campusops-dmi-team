/** Exact public planRetry shape; attempt is the send that just failed (starts at 1). */
export type RetryInput = Readonly<{
  method: 'GET' | 'POST';
  status: number | 'timeout';
  attempt: number;
  retryAfterMs?: number;
  idempotencyKey?: string;
}>;

export type RetryDecision = Readonly<{
  retry: boolean;
  delayMs: number;
  requiresStableIdempotencyKey: boolean;
}>;

export type RetryPolicy = (input: RetryInput) => RetryDecision;

/** Team configuration, not extra public function arguments. */
export type RetryConfiguration = Readonly<{
  maxAttempts: 1 | 2 | 3 | 4;
  baseDelayMs: number;
  maxDelayMs: number;
  maxElapsedMs: number;
}>;

/** Serialize once. Every attempt derives Idempotency-Key from operationId. */
export type StablePostRequest = Readonly<{
  operationId: string;
  path: string;
  body: string;
}>;

export const DEFAULT_RETRY_CONFIGURATION: RetryConfiguration = Object.freeze({
  maxAttempts: 4, baseDelayMs: 250, maxDelayMs: 5000, maxElapsedMs: 10000,
});

export function validRetryConfiguration(config: RetryConfiguration): boolean {
  return Number.isInteger(config.maxAttempts) && config.maxAttempts >= 1 && config.maxAttempts <= 4
    && Number.isFinite(config.baseDelayMs) && config.baseDelayMs >= 0
    && Number.isFinite(config.maxDelayMs) && config.maxDelayMs > 0
    && Number.isFinite(config.maxElapsedMs) && config.maxElapsedMs > 0
    && config.baseDelayMs <= config.maxDelayMs && config.maxDelayMs <= config.maxElapsedMs
    // Native timers must not overflow and silently schedule an earlier send.
    && config.maxElapsedMs <= 2147483647;
}

export function hasStableIdempotencyKey(key: string | undefined): boolean {
  return typeof key === 'string' && key.trim() === key && key.length >= 8 && !/[\s\u0000-\u001f\u007f]/u.test(key);
}

export function decideRetry(input: RetryInput, config: RetryConfiguration, remainingMs: number): RetryDecision {
  const requiresStableIdempotencyKey = input.method === 'POST' && !hasStableIdempotencyKey(input.idempotencyKey);
  const stop: RetryDecision = { retry: false, delayMs: 0, requiresStableIdempotencyKey };
  if (requiresStableIdempotencyKey || !validRetryConfiguration(config)
    || !Number.isFinite(remainingMs) || remainingMs <= 0
    || !Number.isInteger(input.attempt) || input.attempt < 1 || input.attempt >= config.maxAttempts
    || !['GET', 'POST'].includes(input.method)
    || !['timeout', 429, 500, 502, 503, 504].includes(input.status)) return stop;
  const delayMs = typeof input.retryAfterMs === 'number' && Number.isFinite(input.retryAfterMs) && input.retryAfterMs >= 0
    ? input.retryAfterMs : Math.min(config.maxDelayMs, config.baseDelayMs * 2 ** (input.attempt - 1));
  // A retry needs time left to send. Never truncate a valid server minimum.
  if (!Number.isFinite(delayMs) || delayMs > config.maxDelayMs || delayMs >= remainingMs) return stop;
  return { retry: true, delayMs, requiresStableIdempotencyKey: false };
}

export function planRetry(input: RetryInput): RetryDecision {
  return decideRetry(input, DEFAULT_RETRY_CONFIGURATION, DEFAULT_RETRY_CONFIGURATION.maxElapsedMs);
}
