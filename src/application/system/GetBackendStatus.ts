export type BackendStatus = 'available' | 'offline';

export interface BackendHealthPort {
  check(): Promise<void>;
}

export class GetBackendStatus {
  constructor(private readonly backendHealth: BackendHealthPort) {}

  async execute(): Promise<BackendStatus> {
    try {
      await this.backendHealth.check();
      return 'available';
    } catch {
      return 'offline';
    }
  }
}
