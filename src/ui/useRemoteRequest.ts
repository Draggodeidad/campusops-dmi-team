import { useCallback, useEffect, useRef, useState } from 'react';

import { settleRemoteRequest, startRemoteRequest } from '../application/ui-state/RemoteUiState';
import type { RemoteRequestEvent, RemoteRequestIntent, RemoteUiOutcome, RemoteUiState } from '../application/ui-state/RemoteUiState';

export function useRemoteRequest<T>(nextRequestId: () => string) {
  const [state, setState] = useState<RemoteUiState<T> | null>(null);
  const current = useRef<RemoteUiState<T> | null>(null);
  const controller = useRef<AbortController | null>(null);

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
    return true;
  }, [publish]);

  const cancel = useCallback(() => {
    const intent = current.current?.intent;
    if (intent && settle({ type: 'cancel', intent })) controller.current?.abort();
  }, [settle]);

  const clear = useCallback(() => {
    publish(null);
    controller.current?.abort();
    controller.current = null;
  }, [publish]);

  const begin = useCallback((selectionId: string | null) => {
    const intent: RemoteRequestIntent = { requestId: nextRequestId(), selectionId };
    publish(startRemoteRequest(intent));
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    return { intent, signal: request.signal };
  }, [nextRequestId, publish]);

  const resolve = useCallback((intent: RemoteRequestIntent, outcome: RemoteUiOutcome<T>) =>
    settle({ type: 'resolve', intent, outcome }), [settle]);
  const isCurrent = useCallback((intent: RemoteRequestIntent) => current.current?.intent === intent, []);

  useEffect(() => () => {
    current.current = null;
    controller.current?.abort();
  }, []);

  return { state, begin, resolve, cancel, clear, isCurrent };
}
