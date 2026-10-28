# W09 — ubicación, reintentos e idempotencia

## Ubicación (#61)

## Alcance y proveedor

CampusOps conserva React Native/Expo/TypeScript y los flujos W06/W08. #61 añade
geocodificación por búsqueda textual explícita, caché y alternativa manual.
No añade GPS, permisos, navegación, seguimiento ni mapas offline. La política de
reintentos de incidencias y respuesta perdida se integra mediante #62, descrita
más adelante en este documento. El proveedor externo conserva su flujo propio.
La implementación no acredita entrega semanal, revisión humana ni aportes individuales.

Se elige **Photon**, servidor público `https://photon.komoot.io`, sin cuentas,
pagos ni claves. Su API `/api/?q=…&limit=1` devuelve GeoJSON. Se ofrece un
candidato para aceptar explícitamente, no una ubicación elegida automáticamente.
Infrastructure transforma `[longitude, latitude]` y componentes textuales;
Application valida etiqueta y coordenadas sin coerción ni valores inventados.

Fuentes oficiales consultadas el 27-10-2026:

- [Photon y condiciones del servidor público](https://github.com/komoot/photon):
  uso moderado, posible throttling/bloqueo, sin garantía de disponibilidad ni
  estabilidad. No publica una cuota numérica garantizada. Photon es Apache-2.0;
  no se incorpora su código ni se instala un servidor propio.
- [Contrato API](https://github.com/komoot/photon/blob/master/docs/api-v1.md).
- [Datos OpenStreetMap, atribución y ODbL](https://www.openstreetmap.org/copyright).
  La pantalla muestra Photon, © OpenStreetMap contributors, ODbL y su enlace.

Alternativas consideradas: Open-Meteo no necesita clave para uso educativo,
pero se centra en localidades/códigos postales; Nominatim público exige
identificación de aplicación, máximo agregado de una petición por segundo y
capacidad de cambiar servicio. Photon se adapta a búsqueda de lugares sin
sumar infraestructura de servidor. El costo es depender de un servicio público
sin SLA y aceptar que un campus ficticio normalmente no tenga coincidencias.

## Contratos, validación y caché

Se conservan los puertos #60: `LocationProvider.lookup(query): Promise<unknown>`,
`LocationCache.get/put`, `LocationConfiguration` y `ResilienceClock.now`.
`LookupIncidentLocation.execute({ query, manualLabel })` devuelve
`LocationLookupResult`; `cacheHit?: boolean` añade procedencia sin cambiar
`IncidentLocation` ni la firma pública de `selectIncidentLocation`.
Evaluación y UI usan la misma validación de Application. La referencia manual
es obligatoria y no vacía incluso al buscar. Consulta o configuración inválida
producen errores públicos de validación, sin red ni texto técnico sensible.

- Normalización única en Application:
  `query.normalize('NFC').trim().replace(/\s+/gu, ' ').toLowerCase()`.
- Valores iniciales inyectables: TTL **300000 ms**, timeout **1000 ms**.
  TTL finito >= 0; timeout finito > 0; TTL cero evita tanto get como put.
- Caché volátil LRU, máximo **50 entradas**; copias defensivas al leer y guardar.
  No se escribe en SQLite, archivos, SecureStore o telemetría. Cerrar el proceso
  elimina la caché. Sólo guarda resultados proveedor validados y tiempos epoch.
- Hit únicamente con resultado nuevamente validado, fuente provider, tiempos
  finitos y `storedAtMs <= now < expiresAtMs`. Vencimiento, reloj regresivo,
  corrupción o errores de caché producen miss; nunca se sirve stale. Errores,
  resultados manuales y etiquetas manuales no se cachean.
- Datos numéricos finitos, latitud [-90,90], longitud [-180,180], ceros incluidos;
  tipos incorrectos, campos ausentes o etiqueta vacía no autorizan coordenadas.

El caso de uso recibe proveedor/caché/reloj. `App.tsx` compone implementaciones
y permite sustituirlas en `createGraph`. El proveedor externo usa un
`FetchIncidentTransport` independiente: nunca recibe sesión, bearer token ni
identidad de actor. La UI no conoce adaptadores ni almacenamiento.

## Fallas y experiencia manual

Cada botón de búsqueda genera a lo sumo una petición; no hay autocomplete,
polling ni retries automáticos. Consultas simultáneas en el mismo adaptador
no generan peticiones adicionales. El transporte aborta por timeout y limpia
su temporizador, incluso si falla al leer el cuerpo.

| Situación | Resultado seguro y acción |
|---|---|
| Éxito válido | source provider; candidato requiere aceptación explícita. |
| Sin coincidencias/HTTP distinto de 200 | unavailable; continuar manualmente. |
| Timeout | timeout; continuar manualmente sin esperar al proveedor. |
| Desconexión/rechazo de transporte | offline; continuar manualmente. |
| 429 | rate_limited; Retry-After válido se publica en ms y bloquea nuevas peticiones hasta vencer. |
| JSON/GeoJSON incorrecto | invalid_response; continuar manualmente. |
| Campos ausentes | incomplete; continuar manualmente. |
| Coordenadas inválidas | invalid_coordinates; continuar manualmente. |
| Rechazo inesperado del puerto | unavailable, sin propagar la excepción original. |

Retry-After acepta segundos no negativos o fecha HTTP futura, incluido cero;
valores inválidos/no finitos no se publican. No se recorta una espera válida.
Sin Retry-After válido no se inventa un plazo; sólo una nueva acción explícita
puede volver a consultar. El presupuesto de operaciones de incidencias se describe en la sección #62;
la búsqueda externa conserva su cooldown y alternativa manual.

La búsqueda tiene su propio campo. El edificio/zona/referencia manual nunca se
envía al proveedor implícitamente. Se permite registrar mientras se busca o
tras cualquier falla. Editar la referencia, cambiar consulta o pulsar “Usar
ubicación manual” invalida la selección; cancelar, enviar, desmontar o cambiar
de sesión invalida respuestas tardías. Los errores no borran el formulario.

Se envía la etiqueta elegida como `locationLabel`, compatible con el backend
textual actual. Source/coordenadas son metadatos de selección durante el
formulario; no se afirma que el backend o SQLite los persistan.

## Privacidad, pruebas y ejecución externa

Usar exclusivamente consultas y referencias ficticias. No introducir PII,
ubicaciones reales ni coordenadas del dispositivo. El campo de búsqueda advierte
esta restricción; la app no puede demostrar que un texto arbitrario sea sintético.
La memoria temporal no ofrece clasificación automática de PII. No hay logs de
consulta, cuerpos, coordenadas, etiquetas del proveedor, errores originales o
cabeceras. Una búsqueda explícita transmite su consulta a Photon; no se afirma
controlar la retención del servidor externo.

```sh
nvm use
npm run test:week-09:location
npm run check:architecture
# Opt-in: red pública; excluido del runner determinista y de los gates automáticos.
npm run check:week-09-location-provider
# Presupuesto explícito para un entorno con latencia de proxy/Internet mayor:
npm run check:week-09-location-provider -- --timeout-ms=5000
```

El runner usa el TypeScript instalado para cargar en memoria los adaptadores
reales; no genera otra implementación. `--local` ejecuta fetch/aborto real sobre
HTTP loopback, incluyendo 429, cooldown y conexión rechazada. Las suites Jest
cubren contratos, caché, pantalla y composición con backend y disco W08 reales.
La suite reservada a #64 permanece libre.

El comando externo usa el proxy del entorno con Node 22.22.0 (`--use-env-proxy`),
consulta una fixture fija ficticia y desactiva caché. Su salida incluye sólo SHA,
fecha, proveedor, endpoint sin consulta, fixtureId, timeout, duración, código HTTP
y resultado sanitizado. No se vuelca el cuerpo ni una posible coincidencia real.
HTTP 200 sin coincidencias demuestra una ejecución del adaptador externo y
fallback; no demuestra éxito geográfico. El éxito con coordenadas se prueba con
fixtures sintéticas. Si no se obtiene respuesta externa válida, el comando falla
y la evidencia queda pendiente; una respuesta del doble nunca la sustituye.

Los resultados reproducidos del SHA técnico se conservan en
`reports/week-09/location/validation.json`, con logs y observación externa.
Las primeras exploraciones de red no se atribuyen al SHA final. Los fallos de
`planRetry` o entregables W09 pendientes se registran separadamente.

Ayuda material de IA: Codex asistió en implementación, pruebas y documentación.
La validación automática y la llamada externa quedan trazadas a comandos reales;
la revisión humana y evidencia individual del owner se registrarán cuando existan.
No se crea tag, se entrega en Classroom ni se cierra automáticamente #61.

## Reintentos e idempotencia (#62)

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
El reloj real completa el plazo cuando un timer despierta anticipadamente,
con hasta cuatro callbacks; un scheduler incoherente termina en falla controlada.
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

Proveedor externo/caché/ubicación manual se integran desde #61, descritos al
inicio de este documento. Los logs de retry no sustituyen su evidencia de
llamada externa. El fallback manual de ubicación debe seguir disponible ante
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
El owner confirmó su visto bueno humano de #61/#62 en el chat; #63 conserva
ese alcance y su registro propio. La integración y corrección posteriores fueron
autorizadas por el usuario y se validan automáticamente. Aportes de compañeros
y consolidación final W09 siguen pendientes.
Ayuda material de IA: Codex asistió implementación, pruebas, documentación y
comprobaciones automáticas; no acredita aportes o revisión de ningún integrante.
No se crea tag ni se entrega en Classroom desde esta issue.
