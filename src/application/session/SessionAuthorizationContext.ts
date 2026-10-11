/** Narrow port consumed by infrastructure transport decorator. */
export interface SessionAuthorizationContext {
  getAuthorizationHeader(): string | null;
  getActorId(): string | null;
  getGeneration(): number;
  refresh(expectedGeneration?: number): Promise<void>;
}
