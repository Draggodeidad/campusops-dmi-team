import { ApplicationFailure } from '../../application/errors/ApplicationFailure';
import { decideRetry, DEFAULT_RETRY_CONFIGURATION, validRetryConfiguration } from '../../application/resilience/RetryPolicy';
import type { RetryConfiguration } from '../../application/resilience/RetryPolicy';
import type { ResilienceClock } from '../../application/resilience/ResilienceClock';
import { redactForTelemetry } from '../../application/telemetry/redactForTelemetry';
import type { IncidentTransport, TransportRequest, TransportResponse } from './IncidentTransport';
import { parseRetryAfter } from './parseRetryAfter';

export type RetryAttemptMetric = Readonly<{
  correlationId: string;
  incidentId?: string;
  method: 'GET' | 'POST';
  status: number | 'timeout' | 'offline' | 'terminal';
  attempt: number;
  durationMs: number;
}>;
export type RetryObserver = (metric: RetryAttemptMetric) => void;

/** One budget per logical incident request, including the W06 authorization replay. */
export class IncidentRetryExecutor {
  private sequence = 0;
  private readonly configuration: RetryConfiguration;
  constructor(private readonly clock: ResilienceClock, configuration: RetryConfiguration = DEFAULT_RETRY_CONFIGURATION,
    private readonly observe: RetryObserver = () => {}) {
    if (!validRetryConfiguration(configuration)) throw new ApplicationFailure('INVALID_RETRY_CONFIGURATION', 'Configuración de reintentos inválida.');
    this.configuration = { ...configuration };
  }

  forRequest(transport: IncidentTransport, original: TransportRequest,
    prepare: (request: TransportRequest) => Promise<TransportRequest>): IncidentTransport {
    original = { ...original, ...(original.headers ? { headers: { ...original.headers } } : {}),
      ...(original.session ? { session: { ...original.session } } : {}) };
    // Explicit allowlist; session, health, third parties and arbitrary POSTs are single sends.
    if (!/^\/?v1\/incidents(?:\/[^/?]+(?:\/actions)?)?$/.test(original.path)) return transport;
    const config = this.configuration;
    const clock = this.clock;
    const correlationId = `w09-request-${++this.sequence}`;
    const incidentId = /\/(campus-inc-\d{3})(?:\/actions)?$/.exec(original.path)?.[1];
    const key = Object.entries(original.headers ?? {}).find(([name]) => name.toLowerCase() === 'idempotency-key')?.[1];
    const observe = this.observe;
    const startedAt = clock.now();
    let previousTime = startedAt;
    let attempt = 0;
    const remaining = (): number => {
      const now = clock.now();
      if (!Number.isFinite(startedAt) || !Number.isFinite(now) || now < previousTime) return 0;
      previousTime = now;
      return Math.max(0, config.maxElapsedMs - (now - startedAt));
    };
    return { async send(request) {
      for (;;) {
        const budget = remaining();
        if (attempt >= config.maxAttempts || budget <= 0) {
          throw new ApplicationFailure('RETRY_BUDGET_EXHAUSTED', 'Se alcanzó el límite de reintentos; conserva el cambio y reintenta manualmente.');
        }
        const prepared = await prepare(request);
        const afterPreparation = remaining();
        if (afterPreparation <= 0) throw new ApplicationFailure('RETRY_BUDGET_EXHAUSTED', 'Se agotó el tiempo antes del envío.');
        attempt++;
        const sentAt = clock.now();
        let response: TransportResponse | undefined;
        let failure: unknown;
        let status: RetryAttemptMetric['status'];
        try {
          response = await transport.send({ ...prepared,
            // Identity and serialized content are captured before any wait or renewal.
            method: original.method, path: original.path,
            ...(original.body !== undefined ? { body: original.body } : {}),
            timeoutMs: Math.min(original.timeoutMs ?? 5000, afterPreparation),
          });
          status = response.status;
        } catch (error: unknown) {
          failure = error;
          status = error instanceof ApplicationFailure ? 'terminal'
            : error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name) ? 'timeout' : 'offline';
        }
        const left = remaining();
        const durationMs = Number.isFinite(previousTime - sentAt) && previousTime >= sentAt ? previousTime - sentAt : 0;
        // Allowlist first, existing W04 redactor second. No paths, body, key, actor or raw errors.
        const metric = redactForTelemetry({ correlationId, ...(incidentId ? { incidentId } : {}),
          method: original.method, status, attempt, durationMs }) as RetryAttemptMetric;
        try { observe(metric); } catch { /* Telemetry cannot change an operation's outcome. */ }
        const header = response && Object.entries(response.headers).find(([name]) => name.toLowerCase() === 'retry-after')?.[1];
        const retryAfterMs = header !== undefined ? parseRetryAfter(header, clock.now()) : response?.retryAfterMs;
        const decision = status === 'offline' || status === 'terminal' ? undefined
          : decideRetry({ method: original.method, status, attempt,
            ...(retryAfterMs !== undefined ? { retryAfterMs } : {}), ...(key !== undefined ? { idempotencyKey: key } : {}),
          }, config, left);
        if (!decision?.retry) {
          if (response) return response;
          throw failure;
        }
        const waitStarted = clock.now();
        try { await clock.sleep(decision.delayMs); }
        catch { throw new ApplicationFailure('RETRY_BUDGET_EXHAUSTED', 'No fue posible esperar de forma segura; conserva el cambio.'); }
        // A broken/early clock must never cause an early Retry-After replay or a spin loop.
        if (!Number.isFinite(clock.now()) || clock.now() - waitStarted < decision.delayMs) {
          throw new ApplicationFailure('RETRY_BUDGET_EXHAUSTED', 'El reloj no confirmó la espera; conserva el cambio.');
        }
      }
    } };
  }
}
