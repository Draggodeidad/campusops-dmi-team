import type { ResilienceClock } from '../../application/resilience/ResilienceClock';

export class SystemResilienceClock implements ResilienceClock {
  now(): number { return Date.now(); }
  sleep(delayMs: number): Promise<void> {
    if (!Number.isFinite(delayMs) || delayMs < 0 || delayMs > 2147483647) return Promise.reject(new Error('Invalid delay'));
    const startedAt = this.now();
    const deadline = startedAt + delayMs;
    if (!Number.isFinite(startedAt) || !Number.isFinite(deadline)) return Promise.reject(new Error('Invalid clock'));
    return new Promise((resolve, reject) => {
      let previousTime = startedAt;
      let callbacks = 0;
      const finish = (): void => {
        const now = this.now();
        if (!Number.isFinite(now) || now < previousTime) { reject(new Error('Invalid clock')); return; }
        previousTime = now;
        const remaining = deadline - now;
        if (remaining <= 0) { resolve(); return; }
        // Native timers may wake slightly early. Complete the minimum wait with
        // a bounded number of callbacks rather than authorizing an early replay.
        if (++callbacks >= 4) { reject(new Error('Timer did not complete the minimum wait')); return; }
        setTimeout(finish, Math.ceil(remaining));
      };
      setTimeout(finish, Math.ceil(delayMs));
    });
  }
}
