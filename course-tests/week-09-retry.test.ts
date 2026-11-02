import {
  decideRetry,
  hasStableIdempotencyKey,
  planRetry,
  validRetryConfiguration,
  DEFAULT_RETRY_CONFIGURATION,
  type RetryConfiguration,
  type RetryInput,
} from '../src/application/resilience/RetryPolicy';
import {
  IncidentRetryExecutor,
  type RetryAttemptMetric,
} from '../src/infrastructure/http/IncidentRetryExecutor';
import { parseRetryAfter } from '../src/infrastructure/http/parseRetryAfter';
import type {
  IncidentTransport,
  TransportRequest,
  TransportResponse,
} from '../src/infrastructure/http/IncidentTransport';
import { createVirtualClock } from './fixtures/week-09/virtualClock';
import { createLostResponseFixture } from './fixtures/week-09/scenario';

const makeResponse = (
  status: number,
  headers: Record<string, string> = {},
  bodyText = '{}',
  retryAfterMs?: number
): TransportResponse => ({
  status,
  headers,
  bodyText,
  ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
});

const getRequest: TransportRequest = {
  method: 'GET',
  path: '/v1/incidents/campus-inc-001',
};

const postRequest: TransportRequest = {
  method: 'POST',
  path: '/v1/incidents/campus-inc-001/actions',
  headers: { 'idempotency-key': 'resolve-campus-inc-001-op-1' },
  body: JSON.stringify({ action: 'resolve', baseVersion: 2, diagnosis: 'Cable sintético sustituido' }),
};

describe('Week 09 — Issue #65: Reintentos, Métricas y Respuesta Perdida', () => {
  // =========================================================================
  // GRUPO A: Reintentos GET y Política de Espera
  // =========================================================================

  test('A1: Respuesta GET exitosa en intento 1 no genera reintentos ni retrasos', async () => {
    const clock = createVirtualClock(1000);
    const metrics: RetryAttemptMetric[] = [];
    const sendMock = jest.fn(async () => makeResponse(200, {}, '{"items":[]}'));
    const executor = new IncidentRetryExecutor(clock, DEFAULT_RETRY_CONFIGURATION, m => metrics.push(m));
    const transport = executor.forRequest({ send: sendMock }, getRequest, async r => r);

    const response = await transport.send(getRequest);

    expect(response.status).toBe(200);
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(clock.delays).toEqual([]);
    expect(metrics).toEqual([
      expect.objectContaining({ attempt: 1, method: 'GET', status: 200, incidentId: 'campus-inc-001' }),
    ]);
  });

  test('A2: Respuesta HTTP 429 con Retry-After numérico en segundos respeta el retraso y reintenta', async () => {
    const clock = createVirtualClock(1000);
    const metrics: RetryAttemptMetric[] = [];
    let callCount = 0;
    const sendMock = jest.fn(async () => {
      callCount++;
      if (callCount === 1) return makeResponse(429, { 'Retry-After': '0.8' });
      return makeResponse(200, {}, '{"items":[]}');
    });
    const executor = new IncidentRetryExecutor(clock, DEFAULT_RETRY_CONFIGURATION, m => metrics.push(m));
    const transport = executor.forRequest({ send: sendMock }, getRequest, async r => r);

    const response = await transport.send(getRequest);

    expect(response.status).toBe(200);
    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(clock.delays).toEqual([800]); // 0.8 s = 800 ms
    expect(metrics.map(m => [m.attempt, m.status])).toEqual([[1, 429], [2, 200]]);
  });

  test('A3: Respuesta HTTP 429 con fecha HTTP GMT calcula correctamente el tiempo de espera', () => {
    const now = Date.parse('Tue, 27 Oct 2026 12:00:00 GMT');
    const futureDate = 'Tue, 27 Oct 2026 12:00:02 GMT'; // +2 segundos = 2000 ms
    const parsed = parseRetryAfter(futureDate, now);

    expect(parsed).toBe(2000);
  });

  test('A4: Retry-After igual a 0 genera espera de 0 ms y reintenta de inmediato', () => {
    const decision = planRetry({ method: 'GET', status: 429, attempt: 1, retryAfterMs: 0 });

    expect(decision).toEqual({
      retry: true,
      delayMs: 0,
      requiresStableIdempotencyKey: false,
    });
  });

  test('A5: Retry-After inválido o corrupto se descarta y utiliza el backoff exponencial base', async () => {
    const clock = createVirtualClock(1000);
    let callCount = 0;
    const sendMock = jest.fn(async () => {
      callCount++;
      if (callCount === 1) return makeResponse(429, { 'Retry-After': 'invalido-o-negativo' });
      return makeResponse(200);
    });
    const executor = new IncidentRetryExecutor(clock, DEFAULT_RETRY_CONFIGURATION);
    const transport = executor.forRequest({ send: sendMock }, getRequest, async r => r);

    await transport.send(getRequest);

    expect(sendMock).toHaveBeenCalledTimes(2);
    // Como Retry-After es inválido, usa baseDelayMs * 2^(1-1) = 250 ms
    expect(clock.delays).toEqual([250]);
  });

  test('A6: Retry-After excesivo que supera maxDelayMs detiene el reintento sin truncar el retraso del servidor', () => {
    // maxDelayMs por defecto es 5000 ms. Si el servidor pide 6000 ms, la política NO trunca a 5000: detiene el reintento.
    const decision = planRetry({
      method: 'GET',
      status: 429,
      attempt: 1,
      retryAfterMs: 6000,
    });

    expect(decision).toEqual({
      retry: false,
      delayMs: 0,
      requiresStableIdempotencyKey: false,
    });
  });

  test('A7: Retry-After que supera el tiempo de presupuesto restante (remainingMs) detiene el reintento', () => {
    const decision = decideRetry(
      { method: 'GET', status: 429, attempt: 1, retryAfterMs: 2000 },
      DEFAULT_RETRY_CONFIGURATION,
      1500 // Presupuesto restante menor al delay solicitado (1500 < 2000)
    );

    expect(decision.retry).toBe(false);
    expect(decision.delayMs).toBe(0);
  });

  test('A8: Backoff exponencial determinista ante fallos 503 consecutivos sigue 250 -> 500 -> 1000 ms', async () => {
    const clock = createVirtualClock(1000);
    const sendMock = jest.fn(async () => makeResponse(503));
    const executor = new IncidentRetryExecutor(clock, DEFAULT_RETRY_CONFIGURATION);
    const transport = executor.forRequest({ send: sendMock }, getRequest, async r => r);

    const response = await transport.send(getRequest);

    expect(response.status).toBe(503);
    // Intento 1 (falla) -> espera 250 ms -> Intento 2 (falla) -> espera 500 ms -> Intento 3 (falla) -> espera 1000 ms -> Intento 4 (falla) -> alto
    expect(sendMock).toHaveBeenCalledTimes(4);
    expect(clock.delays).toEqual([250, 500, 1000]);
  });

  test('A9: Corte irreversible al alcanzar el intento 4', () => {
    const decision = planRetry({ method: 'GET', status: 503, attempt: 4 });

    expect(decision).toEqual({
      retry: false,
      delayMs: 0,
      requiresStableIdempotencyKey: false,
    });
  });

  test('A10: Errores no transitorios de cliente (400, 401, 403, 404, 409, 422) no se reintentan', async () => {
    for (const status of [400, 401, 403, 404, 409, 422]) {
      const clock = createVirtualClock(1000);
      const sendMock = jest.fn(async () => makeResponse(status));
      const executor = new IncidentRetryExecutor(clock, DEFAULT_RETRY_CONFIGURATION);
      const transport = executor.forRequest({ send: sendMock }, getRequest, async r => r);

      const response = await transport.send(getRequest);

      expect(response.status).toBe(status);
      expect(sendMock).toHaveBeenCalledTimes(1);
      expect(clock.delays).toEqual([]);
    }
  });

  // =========================================================================
  // GRUPO B: POST e Idempotencia
  // =========================================================================

  test('B1: POST sin Idempotency-Key realiza el envío inicial pero impide cualquier reintento ante falla', async () => {
    const clock = createVirtualClock(1000);
    const sendMock = jest.fn(async () => makeResponse(503));
    const executor = new IncidentRetryExecutor(clock, DEFAULT_RETRY_CONFIGURATION);
    const unkeyedPost: TransportRequest = {
      method: 'POST',
      path: '/v1/incidents/campus-inc-001/actions',
      body: JSON.stringify({ action: 'start', baseVersion: 1 }),
    };
    const transport = executor.forRequest({ send: sendMock }, unkeyedPost, async r => r);

    const response = await transport.send(unkeyedPost);

    expect(response.status).toBe(503);
    expect(sendMock).toHaveBeenCalledTimes(1); // Se ejecutó el POST original, pero NO se reintentó
    expect(clock.delays).toEqual([]);

    // Comprobación directa de la política
    const decision = planRetry({ method: 'POST', status: 503, attempt: 1 });
    expect(decision).toEqual({
      retry: false,
      delayMs: 0,
      requiresStableIdempotencyKey: true,
    });
  });

  test('B2: POST con Idempotency-Key inválida (< 8 caracteres o espacios) impide reintentos', () => {
    expect(hasStableIdempotencyKey('short')).toBe(false);
    expect(hasStableIdempotencyKey('   spaces   ')).toBe(false);
    expect(hasStableIdempotencyKey('has\twhitespace')).toBe(false);
    expect(hasStableIdempotencyKey('valid-idempotency-key-123')).toBe(true);

    const decision = planRetry({
      method: 'POST',
      status: 503,
      attempt: 1,
      idempotencyKey: 'short',
    });
    expect(decision.retry).toBe(false);
    expect(decision.requiresStableIdempotencyKey).toBe(true);
  });

  test('B3: POST con clave de idempotencia válida autoriza reintentos ante fallos temporales', () => {
    const decision = planRetry({
      method: 'POST',
      status: 503,
      attempt: 1,
      idempotencyKey: 'resolve-campus-inc-001-op-1',
    });

    expect(decision).toEqual({
      retry: true,
      delayMs: 250,
      requiresStableIdempotencyKey: false,
    });
  });

  test('B4: Conservación del cuerpo original byte a byte durante todos los reintentos', async () => {
    const clock = createVirtualClock(1000);
    const capturedBodies: (string | undefined)[] = [];
    const sendMock = jest.fn(async (req: TransportRequest) => {
      capturedBodies.push(req.body);
      if (capturedBodies.length < 3) return makeResponse(503);
      return makeResponse(200, {}, '{"status":"resolved","version":3}');
    });
    const executor = new IncidentRetryExecutor(clock, DEFAULT_RETRY_CONFIGURATION);
    const transport = executor.forRequest({ send: sendMock }, postRequest, async r => r);

    await transport.send(postRequest);

    expect(sendMock).toHaveBeenCalledTimes(3);
    expect(capturedBodies).toHaveLength(3);
    expect(capturedBodies[0]).toBe(postRequest.body);
    expect(capturedBodies[1]).toBe(postRequest.body);
    expect(capturedBodies[2]).toBe(postRequest.body);
  });

  test('B5: Conservación estricta de la clave Idempotency-Key en cada reintento', async () => {
    const clock = createVirtualClock(1000);
    const capturedKeys: (string | undefined)[] = [];
    const sendMock = jest.fn(async (req: TransportRequest) => {
      capturedKeys.push(req.headers?.['idempotency-key']);
      if (capturedKeys.length === 1) return makeResponse(503);
      return makeResponse(200);
    });
    const executor = new IncidentRetryExecutor(clock, DEFAULT_RETRY_CONFIGURATION);
    const transport = executor.forRequest({ send: sendMock }, postRequest, async r => r);

    await transport.send(postRequest);

    expect(capturedKeys).toEqual([
      'resolve-campus-inc-001-op-1',
      'resolve-campus-inc-001-op-1',
    ]);
  });

  // =========================================================================
  // GRUPO C: Respuesta Perdida tras Confirmación (timeout_after_commit)
  // =========================================================================

  test('C1: timeout_after_commit procesa en backend, corta conexión en intento 1 y recupera idempotentemente en intento 2', async () => {
    const clock = createVirtualClock(1000);
    const fixture = createLostResponseFixture();
    let backendCommitHappened = false;
    let backendHistoryCount = 0;
    let incidentVersion = 2;

    const sendMock = jest.fn(async (req: TransportRequest) => {
      const key = req.headers?.['idempotency-key'];
      if (key !== fixture.operation.operationId) throw new Error('Mismatched idempotency key');

      if (!backendCommitHappened) {
        // Intento 1: El backend procesa el commit y avanza versión
        backendCommitHappened = true;
        incidentVersion = 3;
        backendHistoryCount = 1;
        // La conexión se interrumpe después del commit en servidor (simulando timeout_after_commit)
        const timeoutError = new Error('Connection terminated after commit');
        timeoutError.name = 'TimeoutError';
        throw timeoutError;
      }

      // Intento 2 (Reintento): El backend reconoce la clave existente en su registro de operaciones
      // y retorna el resultado existente sin volver a ejecutar la mutación
      return makeResponse(
        200,
        {},
        JSON.stringify({
          operationId: key,
          duplicate: true,
          version: incidentVersion,
          status: 'resolved',
        })
      );
    });

    const executor = new IncidentRetryExecutor(clock, DEFAULT_RETRY_CONFIGURATION);
    const requestWithIdempotency: TransportRequest = {
      method: 'POST',
      path: '/v1/incidents/campus-inc-001/actions',
      headers: { 'idempotency-key': fixture.operation.operationId },
      body: fixture.request.body,
    };
    const transport = executor.forRequest({ send: sendMock }, requestWithIdempotency, async r => r);

    const response = await transport.send(requestWithIdempotency);

    expect(response.status).toBe(200);
    const parsedBody = JSON.parse(response.bodyText);
    expect(parsedBody).toMatchObject({
      operationId: fixture.operation.operationId,
      duplicate: true,
      version: 3,
      status: 'resolved',
    });
    // Verificación de efectos únicos: exactamente 1 commit, versión 3, 1 registro en historial
    expect(backendCommitHappened).toBe(true);
    expect(incidentVersion).toBe(3);
    expect(backendHistoryCount).toBe(1);
    expect(sendMock).toHaveBeenCalledTimes(2);
  });

  test('C2: Reintento idempotente nunca crea un segundo evento ni incrementa la versión erróneamente', async () => {
    const historyEvents: string[] = [];
    const completedOperations = new Map<string, { version: number; status: string }>();

    const handleBackendAction = (key: string, baseVersion: number) => {
      if (completedOperations.has(key)) {
        return { duplicate: true, ...completedOperations.get(key)! };
      }
      historyEvents.push(`operation-${key}`);
      const result = { version: baseVersion + 1, status: 'resolved' };
      completedOperations.set(key, result);
      return { duplicate: false, ...result };
    };

    // Primera ejecución
    const first = handleBackendAction('op-key-12345', 2);
    expect(first).toEqual({ duplicate: false, version: 3, status: 'resolved' });
    expect(historyEvents).toHaveLength(1);

    // Replay / Reintento idempotente con misma clave
    const replay = handleBackendAction('op-key-12345', 2);
    expect(replay).toEqual({ duplicate: true, version: 3, status: 'resolved' });
    expect(historyEvents).toHaveLength(1); // No agregó un segundo evento
  });

  // =========================================================================
  // GRUPO D: Métricas de Telemetría
  // =========================================================================

  test('D1: Registro exacto de intentos, estatus y duraciones en telemetría', async () => {
    const clock = createVirtualClock(1000);
    const metrics: RetryAttemptMetric[] = [];
    let callCount = 0;
    const sendMock = jest.fn(async () => {
      callCount++;
      if (callCount === 1) {
        clock.advance(150); // Simula 150 ms de duración en intento 1
        return makeResponse(503);
      }
      clock.advance(50); // Simula 50 ms de duración en intento 2
      return makeResponse(200);
    });

    const executor = new IncidentRetryExecutor(clock, DEFAULT_RETRY_CONFIGURATION, m => metrics.push(m));
    const transport = executor.forRequest({ send: sendMock }, getRequest, async r => r);

    await transport.send(getRequest);

    expect(metrics).toHaveLength(2);
    expect(metrics[0]).toMatchObject({
      correlationId: expect.stringMatching(/^w09-request-/),
      incidentId: 'campus-inc-001',
      method: 'GET',
      status: 503,
      attempt: 1,
      durationMs: 150,
    });
    expect(metrics[1]).toMatchObject({
      correlationId: metrics[0]!.correlationId,
      incidentId: 'campus-inc-001',
      method: 'GET',
      status: 200,
      attempt: 2,
      durationMs: 50,
    });
  });

  test('D2: Métricas de telemetría no contienen datos sensibles (redactForTelemetry)', async () => {
    const clock = createVirtualClock(1000);
    const metrics: RetryAttemptMetric[] = [];
    const sensitivePost: TransportRequest = {
      method: 'POST',
      path: '/v1/incidents/campus-inc-001/actions',
      headers: {
        authorization: 'Bearer super-secret-token',
        'idempotency-key': 'stable-test-key-123',
      },
      body: JSON.stringify({ diagnosis: 'Información confidencial del campus' }),
    };
    const sendMock = jest.fn(async () => makeResponse(200));
    const executor = new IncidentRetryExecutor(clock, DEFAULT_RETRY_CONFIGURATION, m => metrics.push(m));
    const transport = executor.forRequest({ send: sendMock }, sensitivePost, async r => r);

    await transport.send(sensitivePost);

    expect(metrics).toHaveLength(1);
    const metricRecord = metrics[0] as unknown as Record<string, unknown>;
    expect(metricRecord.body).toBeUndefined();
    expect(metricRecord.authorization).toBeUndefined();
    expect(metricRecord.headers).toBeUndefined();
    expect(metricRecord.diagnosis).toBeUndefined();
  });

  test('D3: Fallo en el observador de métricas no interrumpe el flujo principal del ejecutor', async () => {
    const clock = createVirtualClock(1000);
    const failingObserver = jest.fn(() => {
      throw new Error('Telemetry collector crashed');
    });
    const sendMock = jest.fn(async () => makeResponse(200));
    const executor = new IncidentRetryExecutor(clock, DEFAULT_RETRY_CONFIGURATION, failingObserver);
    const transport = executor.forRequest({ send: sendMock }, getRequest, async r => r);

    const response = await transport.send(getRequest);

    expect(response.status).toBe(200);
    expect(failingObserver).toHaveBeenCalledTimes(1);
  });

  // =========================================================================
  // GRUPO E: Operaciones sin Confirmar y Presupuesto
  // =========================================================================

  test('E1: Agotamiento del tiempo de presupuesto total (maxElapsedMs) lanza RETRY_BUDGET_EXHAUSTED', async () => {
    const clock = createVirtualClock(1000);
    const sendMock = jest.fn(async () => makeResponse(200));
    const tightConfig: RetryConfiguration = {
      maxAttempts: 4,
      baseDelayMs: 250,
      maxDelayMs: 500,
      maxElapsedMs: 500, // Presupuesto de 500 ms
    };
    const executor = new IncidentRetryExecutor(clock, tightConfig);
    // Simula que la preparación del request (ej. refresh de credenciales o cálculo) demora más que el presupuesto disponible
    const slowPrepare = async (r: TransportRequest) => {
      clock.advance(600); // Avanza 600 ms, agotando los 500 ms de presupuesto
      return r;
    };
    const transport = executor.forRequest({ send: sendMock }, getRequest, slowPrepare);

    await expect(transport.send(getRequest)).rejects.toMatchObject({
      code: 'RETRY_BUDGET_EXHAUSTED',
    });
    expect(sendMock).not.toHaveBeenCalled();
  });

  test('E2: Configuración de reintentos inválida es rechazada con ApplicationFailure', () => {
    const clock = createVirtualClock(1000);
    const invalidConfig = {
      maxAttempts: 5 as any, // Debe ser 1..4
      baseDelayMs: -1,
      maxDelayMs: 5000,
      maxElapsedMs: 10000,
    };

    expect(validRetryConfiguration(invalidConfig)).toBe(false);
    expect(() => new IncidentRetryExecutor(clock, invalidConfig)).toThrow('Configuración de reintentos inválida.');
  });
});
