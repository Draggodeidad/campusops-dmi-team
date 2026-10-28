import type { IncidentTransport, TransportRequest, TransportResponse } from './IncidentTransport';
import type { ResilienceClock } from '../../application/resilience/ResilienceClock';
import { parseRetryAfter } from './parseRetryAfter';
import { SystemResilienceClock } from './SystemResilienceClock';

export class FetchIncidentTransport implements IncidentTransport {
  constructor(
    private readonly baseUrl: string,
    private readonly defaultTimeoutMs: number = 5000,
    private readonly clock: Pick<ResilienceClock, 'now'> = new SystemResilienceClock(),
  ) {}

  async send(request: TransportRequest): Promise<TransportResponse> {
    const url = `${this.baseUrl.replace(/\/+$/, '')}/${request.path.replace(/^\/+/, '')}`;
    const timeoutMs = request.timeoutMs ?? this.defaultTimeoutMs;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2147483647) {
      throw new Error('Invalid request timeout');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, Math.ceil(timeoutMs));

    try {
      const init: RequestInit = {
        method: request.method,
        headers: {
          'Content-Type': 'application/json',
          ...request.headers,
        },
        signal: controller.signal,
        ...(request.body !== undefined ? { body: request.body } : {}),
      };

      const response = await fetch(url, init);

      const bodyText = await response.text();
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key.toLowerCase()] = value;
      });

      const retryAfterMs = parseRetryAfter(responseHeaders['retry-after'], this.clock.now());
      return {
        status: response.status,
        ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
        headers: responseHeaders,
        bodyText,
      };
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        const timeoutError = new Error(`Request timed out after ${timeoutMs}ms`);
        timeoutError.name = 'TimeoutError';
        throw timeoutError;
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
