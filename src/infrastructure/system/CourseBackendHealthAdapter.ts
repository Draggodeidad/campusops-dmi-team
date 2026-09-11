import { getBackendHealth } from '../../api/courseBackend';
import type { BackendHealthPort } from '../../application/system/GetBackendStatus';

export class CourseBackendHealthAdapter implements BackendHealthPort {
  async check(): Promise<void> {
    await getBackendHealth();
  }
}
