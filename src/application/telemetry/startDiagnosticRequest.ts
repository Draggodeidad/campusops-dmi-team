import { emitDiagnostic } from './emitDiagnostic';
import type { DiagnosticSink, DiagnosticStatus } from './emitDiagnostic';

let sequence = 0;

/** One sequence per runtime, shared by UI, sync and transport-only callers. */
export function nextCorrelationId(): string {
  return `w10-request-${++sequence}`;
}

export function startDiagnosticRequest(
  sink: DiagnosticSink | undefined,
  incidentId?: string,
  correlationId = nextCorrelationId(),
) {
  const startedAt = Date.now();
  return {
    correlationId,
    report(status: DiagnosticStatus): void {
      if (!sink) return;
      void emitDiagnostic({
        correlationId,
        ...(incidentId !== undefined ? { incidentId } : {}),
        status,
        attempt: 1,
        durationMs: Math.max(0, Date.now() - startedAt),
      }, sink);
    },
  };
}
