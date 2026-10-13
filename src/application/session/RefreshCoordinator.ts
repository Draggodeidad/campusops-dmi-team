/** Shared generation and replay policy for runtime and the course adapter. */
export class RefreshCoordinator {
  private generation = 0;
  private flight: number | null = null;
  private status: 'anonymous' | 'authenticated' = 'anonymous';
  private activeGeneration: number | null = null;
  private persistedToken: string | null = null;
  private refreshCalls = 0;
  private readonly pending = new Set<string>();
  private readonly retried = new Set<string>();

  isCurrent(generation: number): boolean {
    return generation === this.generation;
  }

  replace(generation: number, token: string | null = null): void {
    this.generation = generation;
    this.flight = null;
    this.pending.clear();
    this.persistedToken = token;
    this.status = token ? 'authenticated' : 'anonymous';
    this.activeGeneration = token ? generation : null;
  }

  begin(generation: number, requestId?: string): boolean {
    if (generation < this.generation || (requestId && this.retried.has(requestId))) return false;
    if (generation > this.generation) this.replace(generation);
    if (requestId) this.pending.add(requestId);
    if (this.flight === generation) return false;
    this.flight = generation;
    this.refreshCalls++;
    return true;
  }

  complete(sourceGeneration: number, token: string, nextGeneration = sourceGeneration): boolean {
    if (!this.isCurrent(sourceGeneration) || this.flight !== sourceGeneration) return false;
    this.generation = nextGeneration;
    this.flight = null;
    this.status = 'authenticated';
    this.activeGeneration = nextGeneration;
    this.persistedToken = token;
    for (const id of this.pending) this.retried.add(id);
    this.pending.clear();
    return true;
  }

  fail(generation: number): boolean {
    if (!this.isCurrent(generation) || this.flight !== generation) return false;
    this.replace(generation + 1);
    return true;
  }

  invalidate(generation = this.generation + 1): void {
    this.replace(generation);
  }

  getFlightGeneration(): number | null { return this.flight; }

  getSummary() {
    return {
      status: this.status,
      activeGeneration: this.activeGeneration,
      refreshCalls: this.refreshCalls,
      retriedRequestIds: [...this.retried] as readonly string[],
      persistedToken: this.persistedToken,
    };
  }
}
