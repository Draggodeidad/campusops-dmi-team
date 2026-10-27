/** No global timers in application policy; inject virtual time in deterministic tests. */
export interface ResilienceClock {
  /** Epoch milliseconds; usable by cache expiry and Retry-After HTTP dates. */
  now(): number;
  /** Finite, nonnegative delay. An adapter owns actual scheduling. */
  sleep(delayMs: number): Promise<void>;
}
