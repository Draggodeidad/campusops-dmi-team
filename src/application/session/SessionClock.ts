/** Clock abstraction for deterministic time testing. */
export interface SessionClock {
  /** Current epoch time in milliseconds. */
  now(): number;
}

export class SystemClock implements SessionClock {
  now(): number {
    return Date.now();
  }
}
