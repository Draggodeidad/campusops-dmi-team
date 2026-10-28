import type { ResilienceClock } from '../../application/resilience/ResilienceClock';

export class SystemResilienceClock implements ResilienceClock {
  now(): number { return Date.now(); }
  sleep(delayMs: number): Promise<void> {
    if (!Number.isFinite(delayMs) || delayMs < 0 || delayMs > 2147483647) return Promise.reject(new Error('Invalid delay'));
    return new Promise(resolve => setTimeout(resolve, Math.ceil(delayMs)));
  }
}
