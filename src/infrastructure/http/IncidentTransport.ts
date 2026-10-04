export type TransportRequest = Readonly<{
  method: 'GET' | 'POST';
  path: string;
  headers?: Readonly<Record<string, string>>;
  body?: string;
  timeoutMs?: number;
}>;

export type TransportResponse = Readonly<{
  status: number;
  headers: Readonly<Record<string, string>>;
  bodyText: string;
}>;

export interface IncidentTransport {
  send(request: TransportRequest): Promise<TransportResponse>;
}
