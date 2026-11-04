import { redactForTelemetry } from './redactForTelemetry';

const outcomes = [
  'success', 'empty', 'error', 'timeout', 'offline', 'cancelled', 'pending', 'conflict', 'terminal',
] as const;

export type DiagnosticStatus = number | (typeof outcomes)[number];

export type DiagnosticEvent = Readonly<{
  correlationId: string;
  incidentId?: string;
  status: DiagnosticStatus;
  attempt: number;
  durationMs: number;
}>;

export type DiagnosticSink = (event: DiagnosticEvent) => void | Promise<void>;

/** Projects safe fields at the emission boundary, including when callers pass extra context. */
export async function emitDiagnostic(event: DiagnosticEvent, sink: DiagnosticSink): Promise<void> {
  const { correlationId, incidentId, status, attempt, durationMs } = event;
  const validStatus = typeof status === 'number'
    ? Number.isInteger(status) && status >= 100 && status <= 599
    : outcomes.some(outcome => outcome === status);
  if (
    typeof correlationId !== 'string' || !/^w10-request-[1-9][0-9]{0,14}$/.test(correlationId) ||
    !validStatus ||
    !Number.isSafeInteger(attempt) || attempt < 1 ||
    !Number.isFinite(durationMs) || durationMs < 0
  ) {
    return;
  }

  const safeIncidentId = typeof incidentId === 'string' && /^campus-inc-[0-9]{1,15}$/.test(incidentId);
  const safe = redactForTelemetry({
    correlationId,
    ...(safeIncidentId ? { incidentId } : {}),
    status,
    attempt,
    durationMs,
  }) as DiagnosticEvent;
  try {
    await sink(safe);
  } catch {
    // Diagnostics must not change the outcome of a request.
  }
}
