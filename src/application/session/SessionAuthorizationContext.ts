import type { SessionSnapshot } from './SessionSnapshot';

/** Narrow port consumed by infrastructure transport decorator. */
export interface SessionAuthorizationContext {
  getSnapshot(): SessionSnapshot;
  getAuthorizationHeader(): string | null;
  getActorId(): string | null;
  getGeneration(): number;
  refresh(expectedGeneration?: number): Promise<void>;
  invalidate(expectedGeneration: number): Promise<void>;
}
