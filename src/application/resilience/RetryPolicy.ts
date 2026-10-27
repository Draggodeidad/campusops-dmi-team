/** Exact public planRetry shape; implementation remains assigned to #62. */
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

/** Team configuration for the future executor, not extra public function arguments. */
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
