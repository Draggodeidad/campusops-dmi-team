# W09 — baseline, kit oficial y contratos compartidos (#60)

Revisión: **27-10-2026**, America/Mexico_City. Base de comparación:
`main = origin/main = 3fbdee0b7118b2a77437e8c8bbfff352dbeaa36d`.
Rama: `feat/week-09-baseline-issue-60`.

## Fuente y alcance

Fuente normativa: `week-09-integracion-resiliente.zip`, SHA-256
`d49efb163816635a8c6c27766e0d89b9bde2d3e0f3ae5e98b81c79c3dd262119`.
Se localizó en el checkout original, se extrajo fuera del repositorio en
`/tmp/campusops-w09-a0nltnvb` y se comparó cada archivo con el SHA base antes
de copiar. Contiene **8 entradas, todas archivos UTF-8; cero binarios,
carpetas explícitas, código de aplicación, scripts o configuraciones adicionales**.
Se leyeron íntegros actividad, rúbrica, entrega, INSTALL, workflow, prueba y
ambos contratos CampusOps. El inventario y la comparación previa se conservan
en `reports/week-09/baseline/`; la herramienta permite repetir la inspección.
El correo se conoce por #60; no se afirma una lectura directa del buzón.

El ZIP confirma disponibilidad **27-10-2026 08:00 a 02-11-2026 23:59**, Ciudad
de México. Actividad: **8 puntos**, AC-01 2.5, AC-02 2, AC-03 1.5, AC-04 1.5,
AC-05 0.5. Los 2 puntos de #60 son asignación interna del baseline, no puntos
adicionales de la rúbrica. El quiz individual 9 es separado (3 preguntas,
2 puntos); no se incorpora contenido del quiz.

#60 publica acuerdos para #61–#69. No implementa proveedor externo, caché,
selección, UI, executor de reintentos, reportes finales ni tag. Los dos stubs
públicos siguen pendientes y sus cuatro pruebas deben fallar hasta #61/#62.
La revisión humana y evidencia individual del responsable siguen pendientes;
no se declara la semana lista para entrega ni se cierra automáticamente #60.

## Comparación e integración controlada

| Archivo del ZIP | Comparación contra main y acción |
|---|---|
| `docs/assignments/week-09.md` | Nuevo; copia canónica íntegra. |
| `docs/assignments/week-09-rubric.md` | Nuevo; copia canónica íntegra. |
| `docs/assignments/week-09-repository.md` | Nuevo; copia canónica íntegra. |
| `docs/CAMPUSOPS.md` | Idéntico byte a byte; conservar. |
| `docs/CAMPUSOPS_API.md` | Idéntico byte a byte; conservar. |
| `course-tests/public/week-09.test.ts` | Idéntico byte a byte; conservar sin editar. |
| `INSTALL.md` | Diferente: anteponer W09 íntegro y conservar W08/W06/W05. |
| `.github/workflows/week-09-integracion-resiliente-feedback.yml` | Nuevo; conservar todos los gates oficiales, fijar Node 22.22.0 e historial/tags completos y SHA del PR como en W08. Añadir baseline, regresiones W06/W08 y arquitectura. |

Los nombres `ACTIVITY_STUDENT_FACING.md`, `RUBRIC_PUBLIC.md` y
`STARTER_AND_REPOSITORY.md` citados por la actividad no están en el ZIP ni en
main. Sus equivalentes oficiales completos están en `docs/assignments/`.
`docs/EVIDENCE_CONTRACT.md`, Makefile, backend y evaluador ya existen; el ZIP
no los reemplaza. No se crea un segundo starter ni se copia encima del trabajo.

El workflow conserva `make evidence-week-09` obligatorio. En ramas sin
entregables/tag fallará; no hay bypass ni tag artificial. Con `steps` normales,
un fallo anterior impide ejecutar pasos posteriores; la carga de artefactos
con `if: always()` sí se conserva. El feedback no equivale a revisión humana.

## Contratos publicados para #61 y #64

Acuerdos del equipo, compatibles con el ZIP; éste exige comportamiento pero
no impone estos nombres de puertos o valores de configuración.

- `src/application/location/LocationProvider.ts`: `lookup(query: string): Promise<unknown>`.
  El adaptador entrega datos externos sin afirmar que son válidos. Captura
  timeout, 429 y desconexión esperados como `LocationUnavailable`:
  `{ available: false, failure: { kind, retryAfterMs? } }`. No transporta errores,
  consultas, cuerpos HTTP ni encabezados sensibles. `retryAfterMs` sólo existe
  para `rate_limited`, si es finito y no negativo. Fallos HTTP restantes se
  clasifican `unavailable`; JSON/tipos corruptos como `invalid_response`.
- La validación **única** de Application distingue `incomplete`,
  `invalid_coordinates` e `invalid_response`. Acepta label textual no vacío y
  latitud/longitud numéricas finitas en [-90,90]/[-180,180], incluidos ceros.
  `selectIncidentLocation(provider, manualLabel): IncidentLocation` debe llamar
  esa lógica real en #61; cualquier fallo devuelve sólo fuente y etiqueta
  manual no vacía, sin coordenadas. `LocationLookupResult` permite conservar
  el motivo seguro junto con la ubicación para UI. Un rechazo inesperado del
  puerto también debe convertirse en alternativa manual controlada.
- `src/application/location/LocationCache.ts`: `get(normalizedQuery)` devuelve
  entrada o null; `put(normalizedQuery, entry)` guarda sólo resultado proveedor
  validado. `ValidatedProviderLocation` exige source provider y ambas coordenadas;
  el tipo no sustituye validación runtime. La entrada tiene `storedAtMs` y
  `expiresAtMs` (epoch ms), sin actor, texto libre adicional, sesión ni PII.
- Normalización única antes de get/put/lookup:
  `query.normalize('NFC').trim().replace(/\s+/gu, ' ').toLowerCase()`.
  Rechazar consulta vacía. `LocationConfiguration` acordada: TTL inicial
  **300000 ms**, timeout inicial **1000 ms**, ambos inyectables. TTL 0 desactiva
  caché; timeout > 0 y ambos finitos. Sólo hit con entrada nuevamente validada,
  `storedAtMs <= now < expiresAtMs`, tiempos finitos y no futuros. En vencimiento,
  reloj regresivo o datos corruptos se trata como miss. No servir stale ni
  cachear errores/fallback. Fallo de caché permite seguir con proveedor/manual.
- #61 elegirá proveedor y restricciones (cuotas, licencia, identificación,
  retención/atribución y ausencia de pagos/secretos), documentará si cachea en
  memoria y conservará una ejecución externa real sintética sanitizada. Este
  baseline no selecciona proveedor ni acredita integración con Internet.
  Se usan únicamente consultas ficticias, sin ubicación real o PII, sin GPS ni
  permisos nuevos. El doble local no acredita la ejecución externa requerida.

Implementaciones reservadas a `src/infrastructure/location/`; casos de uso y
validación en `src/application/location/`. UI sólo consume Application; la
composición futura de proveedor/caché/reloj se hará en `App.tsx`. **Hoy esos
puertos no se componen ni sustituyen el flujo textual/W08 existente.**

## Contratos publicados para #62 y #65

`src/application/resilience/RetryPolicy.ts` publica RetryInput/RetryDecision,
RetryPolicy, RetryConfiguration y StablePostRequest. Se conserva **sin cambios**
la firma pública existente de `planRetry`:

```ts
(input: Readonly<{
  method: 'GET' | 'POST'; status: number | 'timeout'; attempt: number;
  retryAfterMs?: number; idempotencyKey?: string;
}>) => Readonly<{
  retry: boolean; delayMs: number; requiresStableIdempotencyKey: boolean;
}>
```

`attempt` es el envío que acaba de fallar, empieza en 1; desde 4 no se vuelve
a enviar. #62 implementará una política en Application y evaluación la
reutilizará; no habrá algoritmo separado para tests. El status público no se
amplía con offline: la capa de orquestación conserva ese motivo distinguible
y permite manual/conserva pendiente sin convertirlo en un status inventado.

Acuerdo de configuración del equipo para el futuro executor: maxAttempts 4
(sólo se puede reducir), baseDelayMs 250, maxDelayMs 5000, maxElapsedMs 10000.
Valores finitos, límites positivos y coherentes, delays no negativos. Backoff
progresivo por defecto 250/500/1000 para intentos 1/2/3; sin jitter en las
pruebas. Un Retry-After válido (incluido 0 y el caso público 800 ms) se respeta.
Un Retry-After que exceda maxDelayMs o el presupuesto restante **detiene el
reintento**: nunca se recorta para reenviar antes de lo permitido. Valores
inválidos caen a backoff finito. Parsear segundos o fecha HTTP en Infrastructure
con reloj inyectado; publicar sólo milisegundos seguros hacia Application.
Timeout/429 y transitorios 500/502/503/504 son candidatos; otros 4xx requieren
fallo/revisión/sesión W06. Configuración/attempt inválidos detienen; no hay bucle
indefinido. Estos valores son decisiones compartidas, no números impuestos por
el ZIP salvo el corte desde intento 4 y los ejemplos de la prueba pública.

`src/application/resilience/ResilienceClock.ts`: `now(): number` y
`sleep(delayMs): Promise<void>`, inyectable para esperas y vigencia; el caché
puede consumir sólo `now`. La implementación de timers pertenece a
Infrastructure en #62; `createVirtualClock` es exclusivamente fixture de tests.

En POST, `StablePostRequest` congela conceptualmente path, operationId y el
body serializado **una vez**. La cabecera Idempotency-Key se deriva de operationId;
no se regeneran ID, cuerpo, actor ni baseVersion entre intentos. Los tipos
readonly no sustituyen controles runtime. W08 conserva PendingIncidentOperation,
sesión/generación y la obligación de confirmar el recibo exacto antes de
acknowledge; timeout no confirma ni descarta cola. Un 409 pide revisión; una
reformulación explícita es otra operación y conserva la original archivada.
Evitar multiplicar reintentos entre el bucle W08, sesión W06 y el executor W09;
#62 deberá demostrar un presupuesto total y conservar los controles anteriores.
No se añaden reintentos automáticos desde #60.

## Fixtures comunes y uso por el equipo

`course-tests/fixtures/week-09/scenario.ts` y `virtualClock.ts` exportan factories
con datos nuevos por consumidor, proveedor controlado y reloj sin esperas reales.
No se importan desde src ni App.tsx.

| Escenario | Fixture / reproducción futura |
|---|---|
| success | Consulta `Edificio de prueba A`; label igual, lat 0/lng 0. |
| incomplete | `{ label: 'Zona ficticia' }`, misma respuesta del backend. |
| invalid_coordinates | latitude 999/longitude null, misma respuesta del backend. |
| slow | Datos válidos tras 1200 ms virtuales; backend X-Course-Scenario slow espera 1200 ms reales. |
| timeout | Resultado seguro timeout; para comprobar abort real, backend slow y timeout 250 ms. |
| rate_limited | Fallo distinguible, retryAfterMs 1000; backend 429 / Retry-After: 1. |
| offline | Resultado seguro offline; sustituir transporte para rechazo de conexión. No existe variante HTTP offline. |

La fixture slow por sí sola no aborta: #61/#64 deben probar el timeout real del
adaptador. El doble no contiene implementación de validación, caché ni retry.

`createLostResponseFixture()` publica `campus-inc-001`, resolución de
technician-1, operationId/clave `resolve-campus-inc-001-op-1`, diagnóstico
sintético y body según la serialización W08. Partir de backend **nuevo**:
start(baseVersion 1) → resolve(baseVersion 2) → close(baseVersion 3, coordinator-1).
Enviar resolve con timeout_after_commit y timeout 250 ms; repetir exactamente
el mismo request con escenario success y verificar estado resolved, versión 3,
un evento resolve y duplicate true. Close es una alternativa con clave
`close-campus-inc-001-op-1`, no una repetición de resolve. No mezclar con la
secuencia de backend:self-test (éste usa otro proceso y reasigna primero).
#65 comprobará efectos/cola/métricas reales; #60 sólo comprueba el harness.

## Comandos confirmados

Node **22.22.0**, npm, Git, GNU Make, Python 3; respetar package-lock y stack.

```sh
nvm use
make setup
npm run test:week-09:baseline
npm run test:week-09:public
npm run backend:self-test
npm run test:week-06
npm run test:week-08
make feedback
make verify-week-09
make public-test-week-09
```

Se añaden tres scripts de equipo: baseline (contratos/harness), public (sólo
las 4 pruebas oficiales intactas) y `test:week-09:module -- <ruta-existente>`
(runner para suites nuevas). No se anuncia suite todavía inexistente como pasada.
#64 reservará `course-tests/week-09-location.test.tsx`; #65
`course-tests/week-09-retry.test.ts` y `course-tests/week-09-lost-response.test.ts`.
Ejemplo futuro: `npm run test:week-09:module -- course-tests/week-09-retry.test.ts`.
Una ruta ausente debe fallar. No se añade un agregado W09 que aparente completar
las implementaciones pendientes.

`make run-backend` sirve el doble en loopback; no se expone a Internet.
`make verify-week-09` es estructural + typecheck/lint/audit/smoke/backend: **no
prueba las funciones W09 ni los cinco entregables**. `make public-test-week-09`
sí comprueba los cinco archivos y añade la suite pública W09 a la selección
histórica de `npm test`. `npm test` a secas no cubre W08/W09. `make feedback`
comprueba además arquitectura, secretos, auditoría crítica y bundle Expo
Android; bundle no es APK ni prueba nativa.

`make evidence-week-09` sólo corresponde después del futuro tag local
`week-09-final`. No se ejecuta ni se crea el tag desde #60. Los resultados
observados, SHA y códigos reales están en `reports/week-09/baseline/validation.json`.
Los fallos públicos/entrega se conservan explícitos, sin ocultarlos.

Para repetir inventario sin copiar ni ejecutar contenido:

```sh
python3 tools/inspect-week-09-kit.py /ruta/week-09-integracion-resiliente.zip \
  --destination /tmp/campusops-w09-nueva-inspeccion \
  --ref 3fbdee0b7118b2a77437e8c8bbfff352dbeaa36d
```

## Cinco artefactos oficiales y formato confirmado

| Ruta | Responsable y contenido pendiente |
|---|---|
| `docs/resilience-policy.md` | #61/#62/#69: proveedor/ejecución externa, caché/manual, retry/fallo y justificación. |
| `reports/week-09/fault-injection.json` | #64/#65/#69: escenarios observados y respuesta perdida tras guardar. |
| `reports/week-09/retry-metrics.json` | #65/#69: intentos/tiempos observados, corte y ausencia de duplicados. |
| `evidence/week-09/engineering.json` | #69: decisión, dos alternativas distintas, beneficio/costo y requisito/prueba/resultado. |
| `evidence/week-09/individual.json` | #63/#66/#68, consolidación #69: exactamente tres aportes propios verificables. |

SchemaVersion 1, week **9**. Reportes: commitSha completo, generatedAt ISO 8601,
checks no vacíos con id/status/scenarioType/command/evidence; status sólo
pass/fail/not_applicable, scenarioType nominal/boundary/failure. Al menos una
frontera o falla por reporte; sin campos particulares adicionales impuestos
por el ZIP: el contenido semántico anterior sí es obligatorio. Engineering:
commitSha, decision, alternatives (>=2), tradeoff, requirementIds sólo AC-01..05
y verification con command/result/evidence. Individual: teamId y 3 members,
cada uno con studentId, commitShas, files, tests, reviews, prediction, command,
observedResult, explanation y al menos señal propia de test o revisión.
Usar identidad de roster autorizada en el archivo oficial, sin inventarla.

El kit no autoriza un formato alternativo de evidencia individual: un borrador
privado puede servir para preparar el propio registro, pero no satisface el
entregable ni el esquema. #60 no crea placeholders ni rellena evidencia de otros.
Declarar IA material y cómo se validó; revisión humana y aportes se registran
sólo cuando existan.

Orden futuro #69: commit técnico → obtener SHA → ejecutar controles/completar
reportes → commit exclusivo reports/evidence → tag local → evidence → publicar
versión/tag → URL, tag y SHA completo a Classroom por la persona responsable.
commitSha es HEAD o padre inmediato exclusivo de evidencias; cambios de código
posteriores exigen revalidar. Las evidencias W02–W08 conservan procedencia;
este baseline tiene su índice propio y no reescribe resultados históricos.

## Trazabilidad de requisitos y trabajo pendiente

| Requisito / AC | Decisión / contrato | Issue y comprobación requerida |
|---|---|---|
| ZIP, instalación, workflow y reproducción / AC-01 | Inventario completo, Node/lock, gates oficiales | #60 baseline/inspección; #69 setup/feedback/verify desde SHA final. |
| Proveedor externo y restricciones / AC-02 | Puerto unknown, adaptador aislado | #61 ejecución real ficticia sanitizada; #69 recopila. |
| Caché hit/miss/vigencia / AC-02 | Entrada validada, TTL/reloj/configuración | #61/#64 suite de comportamiento y límites. |
| Manual y éxito 0/0, null/tipos/incompleto/inválido / AC-02/03 | Validador único, IncidentLocation y motivos seguros | #61/#64 test público intacto + UI real. |
| Timeout, 429/Retry-After, offline / AC-02/03 | Fallas distinguibles y fallback | #61/#62/#64/#65 doble y timeout real. |
| Backoff, finitud, configuración, corte desde 4 / AC-02/03 | RetryPolicy + ResilienceClock | #62/#65 pruebas deterministas e intentos observados. |
| POST con identidad y respuesta perdida / AC-02/03 | StablePostRequest + confirmación W08 | #62/#65 backend local, misma clave/cuerpo, un efecto y cola conservada. |
| Sanitización y acumulación W06/W08 / AC-01/03 | Sin queries/body/tokens en métricas, puertos sin imports externos | #61/#62/#64/#65 regresiones reales; #67 revisión; #69 consolida. |
| Reintentar/alternativa/fallar, alternativas y trade-off / AC-04 | ADR y contratos; política real futura | #61/#62/#67/#69 engineering relacionado con pruebas/resultados. |
| Tres aportes y ayuda IA / AC-05 | Autoría propia y evidencia real | #63/#66/#68; #67 checklist; #69 consolida sin inventar faltantes. |

#60 desbloquea contratos para #61–#69 al integrarse. #64 depende además de #61,
#65 de #62; publicar contratos no acredita implementaciones ni entrega.
Discrepancia de planificación detectada: #62 decía aplicar tope a Retry-After;
se precisa detener si excede presupuesto, evitando reenviar prematuramente.
Las cinco rutas y la fecha coinciden con lo planificado. La actualización de
#60 registra adquisición del ZIP y referencias; los estados de implementaciones
restantes siguen pendientes.

Ayuda material de IA: Codex asistió lectura/comparación del kit, contratos,
fixtures, documentación y ejecución de comandos a petición del usuario.
Validación automática observada en el índice; revisión humana pendiente.
