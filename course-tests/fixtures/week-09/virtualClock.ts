import type { ResilienceClock } from '../../../src/application/resilience/ResilienceClock';

/** Immediate virtual waits: reproducible cache/retry time without wall-clock sleeps. */
export function createVirtualClock(initialMs = Date.UTC(2026, 9, 27)): ResilienceClock & {
  readonly delays: number[];
  advance(delayMs: number): void;
} {
  if (!Number.isFinite(initialMs)) throw new Error('Invalid initial time');
  let current = initialMs;
  const delays: number[] = [];
  const advance = (delayMs: number): void => {
    if (!Number.isFinite(delayMs) || delayMs < 0 || !Number.isFinite(current + delayMs)) {
      throw new Error('Invalid virtual delay');
    }
    current += delayMs;
  };
  return {
    delays, advance, now: () => current,
    async sleep(delayMs) { advance(delayMs); delays.push(delayMs); },
  };
}
