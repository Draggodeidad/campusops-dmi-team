# W09 — reintentos e idempotencia (#62)

## Política activa

La firma pública `planRetry(input)` se conserva: evaluación reexporta la función
real de Application, también invocada por el ejecutor HTTP. `attempt` es el envío
que acaba de fallar y empieza en **1**. Desde **4** no se reintenta. Configuración
acordada en #60, inyectable en `createGraph({ retryConfiguration, retryClock,
retryObserver })`:

| Parámetro | Inicial | Validación |
|---|---:|---|
| maxAttempts | 4 | Entero de 1 a 4; sólo permite reducir el máximo. |
| baseDelayMs | 250 | Finito, >= 0, <= maxDelayMs. |
| maxDelayMs | 5000 | Finito, > 0, <= maxElapsedMs. |
| maxElapsedMs | 10000 | Finito, > 0, <= 2147483647, límite nativo de timers. |

Backoff: `min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1))`; inicialmente
**250/500/1000 ms**, sin jitter. Configuración inválida devuelve no-retry en la
política; construir un ejecutor inválido falla antes de enviar. Intentos no
enteros, <= 0, NaN o infinitos no autorizan reintentos.

| Situación | Acción |
|---|---|
| Timeout, HTTP 429, 500, 502, 503, 504 | Candidato a retry si caben intentos/tiempo y POST tiene clave estable. |
| Retry-After válido | Respetar la espera exacta, incluido cero; si excede maxDelayMs o no deja tiempo para enviar dentro del presupuesto, detener. Nunca recortar una indicación válida. |
| Retry-After ausente/inválido | Backoff progresivo y finito. |
| Desconexión/rechazo de transporte | Conservar pendiente, informar falta de confirmación y permitir un ciclo manual posterior. No se inventa un status público offline. |
| 401 | Sólo renovación/replay W06, compartiendo presupuesto de envíos; no es transitorio W09. |
| 403, 409, otros HTTP, datos/recibos inválidos | Detener y presentar autorización/conflicto/falla; no repetir por error de contrato. |
| POST sin clave estable | `retry: false`, `delayMs: 0`, `requiresStableIdempotencyKey: true`. |

Una clave estable tiene al menos ocho caracteres, coincide con su forma
trimmed y no incluye espacios ni controles, compatible con el backend didáctico.
Una clave no demuestra por sí sola que un servidor arbitrario sea idempotente:
la aplicación habilita retry sólo para las rutas conocidas de incidencias.

## HTTP, reloj y presupuesto compartido

`SessionTransportDecorator` recibe opcionalmente `IncidentRetryExecutor`,
construido por `App.tsx`. El ejecutor sólo actúa en `/v1/incidents`, su detalle y
acciones. Sesión/login/refresh, salud y servicios externos quedan en su flujo
propio. Un gateway o repositorio construido con un transporte crudo continúa
haciendo una llamada; el comportamiento integrado se comprueba desde createGraph.

`FetchIncidentTransport` mantiene el timeout hasta terminar de leer el cuerpo,
limpia siempre su timer y rechaza tiempos inválidos o que desborden el timer.
Publica `TransportResponse.retryAfterMs?` normalizado con reloj inyectable.
`parseRetryAfter` acepta segundos decimales no negativos o una fecha HTTP IMF
GMT no pasada. No publica texto inválido/no finito. El ejecutor también normaliza
cabeceras de transportes sustitutos, sin depender de mayúsculas/minúsculas.
La política de Application sólo recibe milisegundos, nunca cabeceras HTTP.

Cada solicitud lógica tiene **un** presupuesto compartido de hasta cuatro
peticiones de incidencia, incluido el replay 401. El tiempo incluye las esperas,
las peticiones y la renovación de sesión. Cada timeout queda limitado por el
presupuesto restante. El refresh conserva su política W06 propia y no recibe
reintentos W09. La lectura previa de sync y su POST son solicitudes diferentes,
cada una con presupuesto propio: hasta ocho envíos de incidencias por operación
y ciclo si ambas agotan su límite; una lectura fallida impide el POST.

Se comprueba identidad/generación y expiración antes de cada envío, también
tras dormir; un cambio de cuenta impide continuar. El reloj real está en
Infrastructure; los tests inyectan `ResilienceClock`. Reloj no finito, regresivo,
espera que termine antes de tiempo o presupuesto agotado detienen el flujo.
No hay timer global, observador de conectividad ni bucle en segundo plano.

## Identidad, confirmación y cola W08

La solicitud y sus cabeceras/contexto se copian antes de cualquier espera.
El cuerpo se serializa una vez; se conserva path, actor/generación, operationId,
clave y baseVersion en cada intento. Sólo la autorización puede renovarse dentro
de la misma sesión. `HttpIncidentRepository` conserva la clave creada o recibida
para toda su llamada; una nueva invocación sin clave explícita es otra operación.
La cola W08 conserva el ID durable incluso al reiniciar.

`IncidentWorkspace` elimina su bucle de dos envíos: delega una vez en el gateway,
con HTTP/sesión/retry compuestos. Mantiene exactamente su secuencia: leer remoto,
merge/conflicto, replay del cuerpo original, validar recibo, persistir confirmación
y sólo entonces acknowledge. Sin recibo válido se conserva la intención, incluso
cuando el backend ya hizo commit. reviewed/superseded tampoco son confirmación.
El gateway verifica ID/actor/acción/versión/efecto, incluidos estado/diagnóstico de
resolución y estado de cierre. El repositorio online también comprueba clave,
versión, historial/efecto de acciones y contenido de creación; HTTP 200/201
por sí solo no equivale a confirmación. Un 409 requiere revisión/reformulación explícita.

La prueba `timeout_after_commit` del baseline arranca la atención, resuelve y
cierra; el primer envío de cada resolución/cierre vence a 250 ms tras guardar,
el segundo obtiene el recibo duplicado con la misma clave y contenido. El backend
aplica un solo cambio/historial. Las pruebas durables además reproducen inicio,
nota/evidencia, límite agotado, cuarto intento perdido y reapertura. No se agregan
notificaciones: el backend didáctico no implementa ese efecto y no se atribuye
una comprobación de entrega de notificaciones a estas pruebas.

## Experiencia manual y privacidad

Al agotar reintentos se informa falla o ausencia de confirmación; el workspace
mantiene el estado retry y permite «Sincronizar con mi sesión». Un ciclo nuevo
requiere acción explícita y conserva el ID/cuerpo original. No reformular por
un timeout: pudo ejecutarse. Los conflictos conservan la revisión W08.

Proveedor externo/caché/ubicación manual corresponden a #61 y se documentan al
integrar esa issue; #62 parte de #60 y no acredita esa implementación ni una
llamada a Internet. El fallback manual de ubicación debe seguir disponible ante
fallos del proveedor. Esta rama tampoco añade GPS ni captura/carga de fotos.

Cada envío registra únicamente attempt, durationMs, status, method y correlación
sintética; incidentId sólo se incluye si corresponde al patrón sintético
`campus-inc-000`. La correlación se genera localmente, nunca se toma de una
cabecera o texto arbitrario. El allowlist pasa además por `redactForTelemetry`
W04. No se registra cuerpo, clave de operación, actor, token, ruta/query, error
original, ubicación, comentarios o historial. El observador no puede convertir
una confirmación en error; sus excepciones se aíslan. En tests se inyecta un
observador; la composición normal escribe sólo esas métricas sanitizadas.

## Comprobación y límites de evidencia

```sh
nvm use
npm run test:week-09:retry
npm run check:week-09-retry
npm run backend:self-test
npm run test:week-06
npm run check:week-06-readiness
npm run test:week-08
npm run test:architecture
npm run check:architecture
npm run test:week-09:public
```

La suite owner es independiente de #65, usa los contratos/fixtures publicados
en #60 y deja libre su suite de corroboración. El runner loopback transpila los
archivos reales de producción con el TypeScript instalado, usa fetch/aborto,
reloj y timers nativos y emite métricas/observaciones con SHA. No implementa otra
política. Las pruebas Jest usan reloj virtual y SQLite/archivos/backend reales.

Resultados reproducidos y limitaciones: `reports/week-09/retry/validation.json`.
Revisión humana, evidencia individual y consolidación final W09 siguen pendientes.
Ayuda material de IA: Codex asistió implementación, pruebas, documentación y
comprobaciones automáticas; no acredita aportes o revisión de ningún integrante.
No se crea tag ni se entrega en Classroom desde esta issue.
