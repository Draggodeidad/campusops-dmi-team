import { useCallback, useEffect, useRef, useState } from 'react';

import type { DiagnosticSink } from '../application/telemetry/emitDiagnostic';
import { startDiagnosticRequest } from '../application/telemetry/startDiagnosticRequest';
import { settleRemoteRequest, startRemoteRequest } from '../application/ui-state/RemoteUiState';
import type { RemoteRequestEvent, RemoteRequestIntent, RemoteUiOutcome, RemoteUiState } from '../application/ui-state/RemoteUiState';

export function useRemoteRequest<T>(diagnosticSink?: DiagnosticSink) {
  const [state, setState] = useState<RemoteUiState<T> | null>(null);
  const current = useRef<RemoteUiState<T> | null>(null);
  const controller = useRef<AbortController | null>(null);
  const diagnostic = useRef<ReturnType<typeof startDiagnosticRequest> | null>(null);

  const publish = useCallback((next: RemoteUiState<T> | null) => {
    current.current = next;
    setState(next);
  }, []);

  const settle = useCallback((event: RemoteRequestEvent<T>) => {
    const previous = current.current;
    if (!previous) return false;
    const next = settleRemoteRequest(previous, event);
    if (next === previous) return false;
    publish(next);
    if (next.state !== 'loading') diagnostic.current?.report(next.state);
    return true;
  }, [publish]);

  const cancel = useCallback(() => {
    const intent = current.current?.intent;
    if (intent && settle({ type: 'cancel', intent })) controller.current?.abort();
  }, [settle]);

  const clear = useCallback(() => {
    publish(null);
    diagnostic.current = null;
    controller.current?.abort();
    controller.current = null;
  }, [publish]);

  const begin = useCallback((selectionId: string | null, correlationId?: string) => {
    diagnostic.current = startDiagnosticRequest(diagnosticSink, selectionId ?? undefined, correlationId);
    const intent: RemoteRequestIntent = { requestId: diagnostic.current.correlationId, selectionId };
    publish(startRemoteRequest(intent));
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    return { intent, signal: request.signal };
  }, [diagnosticSink, publish]);

  const resolve = useCallback((intent: RemoteRequestIntent, outcome: RemoteUiOutcome<T>) =>
    settle({ type: 'resolve', intent, outcome }), [settle]);
  const isCurrent = useCallback((intent: RemoteRequestIntent) => current.current?.intent === intent, []);

  useEffect(() => () => {
    current.current = null;
    diagnostic.current = null;
    controller.current?.abort();
  }, []);

  return { state, begin, resolve, cancel, clear, isCurrent };
}
