import { request as httpRequest } from 'node:http';
import type { IncidentTransport, TransportRequest, TransportResponse } from '../../../src/infrastructure/http/IncidentTransport';

/** Real loopback HTTP, including an actual socket timeout on the published backend scenario. */
export class SyncNetwork implements IncidentTransport {
  offline = false;
  loseNextCommit = false;
  disconnectAfterTimeout = false;
  rejectWrite: number | null = null;
  corruptReceipt = false;
  readonly writes: TransportRequest[] = [];
  afterRead: (() => Promise<void>) | undefined;
  constructor(private readonly baseUrl: string) {}

  async send(request: TransportRequest): Promise<TransportResponse> {
    if (request.path.endsWith('/actions')) this.writes.push(request);
    if (this.offline) throw new Error('Synthetic disconnected network');
    if (this.rejectWrite && request.path.endsWith('/actions')) return { status: this.rejectWrite, headers: {}, bodyText: '{}' };
    const lost = this.loseNextCommit && request.path.endsWith('/actions');
    if (lost) this.loseNextCommit = false;
    const response = await new Promise<TransportResponse>((resolve, reject) => {
      const outgoing = httpRequest(new URL(request.path, this.baseUrl), { method: request.method,
        headers: { ...request.headers, 'content-type': 'application/json', ...(lost ? { 'x-course-scenario': 'timeout_after_commit' } : {}) },
      }, incoming => {
        const chunks: Buffer[] = [];
        incoming.on('data', (chunk: Buffer) => chunks.push(chunk));
        incoming.on('end', () => resolve({ status: incoming.statusCode ?? 0, headers: {}, bodyText: Buffer.concat(chunks).toString('utf8') }));
      });
      outgoing.on('error', reject);
      if (lost) outgoing.setTimeout(100, () => {
        if (this.disconnectAfterTimeout) this.offline = true;
        const error = new Error('Synthetic lost commit response'); error.name = 'TimeoutError'; outgoing.destroy(error);
      });
      if (request.body) outgoing.write(request.body);
      outgoing.end();
    });
    if (request.method === 'GET' && request.path.startsWith('/v1/incidents/') && this.afterRead) await this.afterRead();
    if (this.corruptReceipt && request.path.endsWith('/actions') && response.status < 300) {
      const body = JSON.parse(response.bodyText) as Record<string, unknown>;
      return { ...response, bodyText: JSON.stringify({ ...body, operationId: 'synthetic-wrong-confirmation' }) };
    }
    return response;
  }
}
