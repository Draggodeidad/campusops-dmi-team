export type TransportRequest = Readonly<{
  method: 'GET' | 'POST';
  path: string;
  headers?: Readonly<Record<string, string>>;
  body?: string;
  timeoutMs?: number;
  /** A queued write cannot follow a later login, even during token renewal. */
  session?: Readonly<{ actorId: string; generation: number }>;
}>;

export type TransportResponse = Readonly<{
  status: number;
  /** Normalized by the HTTP adapter. Never contains the raw Retry-After header. */
  retryAfterMs?: number;
  headers: Readonly<Record<string, string>>;
  bodyText: string;
}>;

export interface IncidentTransport {
  send(request: TransportRequest): Promise<TransportResponse>;
}
