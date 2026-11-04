export type RemoteRequestIntent = Readonly<{
  requestId: string;
  selectionId: string | null;
}>;

export type RemoteUiOutcome<T> = Readonly<
  | { state: 'success'; value: T }
  | { state: 'empty' }
  | { state: 'error'; error: string }
  | { state: 'offline'; value: T }
  | { state: 'pending'; value: T }
  | { state: 'conflict'; value: T }
>;

export type RemoteUiState<T> = Readonly<{ intent: RemoteRequestIntent }> & (
  | Readonly<{ state: 'loading' }>
  | Readonly<{ state: 'cancelled' }>
  | RemoteUiOutcome<T>
);

export type RemoteRequestEvent<T> = Readonly<{ intent: RemoteRequestIntent }> & Readonly<
  | { type: 'resolve'; outcome: RemoteUiOutcome<T> }
  | { type: 'cancel' }
>;

export const remoteUiActions = {
  loading: 'cancel',
  success: 'continue',
  empty: 'reload',
  error: 'retry',
  cancelled: 'retry',
  offline: 'retry',
  pending: 'sync',
  conflict: 'review',
} as const satisfies Record<RemoteUiState<unknown>['state'], string>;

export function startRemoteRequest(intent: RemoteRequestIntent): RemoteUiState<never> {
  return { state: 'loading', intent };
}

/** Only the current wait can settle, even if the underlying work cannot be aborted. */
export function settleRemoteRequest<T>(
  current: RemoteUiState<T>,
  event: RemoteRequestEvent<T>,
): RemoteUiState<T> {
  if (
    current.state !== 'loading' ||
    current.intent.requestId !== event.intent.requestId ||
    current.intent.selectionId !== event.intent.selectionId
  ) {
    return current;
  }

  return event.type === 'cancel'
    ? { state: 'cancelled', intent: current.intent }
    : { ...event.outcome, intent: current.intent };
}
