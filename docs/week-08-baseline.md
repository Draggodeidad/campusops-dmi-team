# W08 — baseline, kit y contratos compartidos (#42)

> Este documento registra el estado histórico de #42. Evolución posterior #44:
> el motor ya está en `src/application/sync/`, evaluación lo reexporta y
> `createGraph().syncEngine` lo expone. `npm run test:week-08:sync` ejecuta
> comportamiento y composición; el agregado W08 también lo incluye. La política
> vigente y los límites están en [sync-policy.md](sync-policy.md), y los nuevos
> resultados en `reports/week-08/sync/`. Las referencias a stubs/fallos abajo
> describen el SHA original del baseline, cuyos reportes se conservan intactos.
> El adaptador durable y el flujo offline de #43/#45 siguen pendientes.

Fecha de revisión: **21-10-2026**, America/Mexico_City. Rama:
`feat/week-08-baseline-persistencia-sync`. Base: `main` y `origin/main`,
`a57c8de8878f3a5a946244f2fecab81a869e78ba`.

## Fuente y alcance

Fuente normativa inspeccionada: `week-08-persistencia-sincronizacion.zip`,
SHA-256 `421692f125e4a164d714bf4d5113c06fc2bdb5b30bc3a08ca5e50fbf634de205`.
Se localizaron copias idénticas en Downloads/testw08 y en el checkout original.
Se inventarió antes de extraer en `/tmp/campusops-w08-kit-kt8047ng`, fuera del
repositorio. Hay **20 entradas: 13 archivos UTF-8 y 7 directorios; cero
binarios**. Se leyeron completos actividad, rúbrica, repositorio, INSTALL,
workflow, prueba y contratos CampusOps. Las copias duplicadas dentro del
ZIP se contrastaron byte a byte con sus equivalentes; el inventario registra
TODAS las entradas, tamaños y hashes, incluidas carpetas ocultas.

El correo del 20-10 se conoce por el texto de #42 facilitado por el owner;
no se afirma una lectura directa del buzón. El ZIP confirma exactamente:
disponible del **20-10-2026 08:00 al 26-10-2026 23:59**, Ciudad de México.
No se encontró discrepancia de fecha. La actividad vale 8 puntos; los **2 pts
de baseline son estimación/asignación interna de #42**, no un nuevo criterio
de la rúbrica. Quiz 8: individual, separado, tres preguntas/tres puntos.

Este cambio prepara #43–#52. No implementa el adaptador durable (#43), el
motor (#44), ni el flujo offline/sync (#45). W09 y W12 quedan fuera de alcance.
Los stubs de `resolveSync` y `deduplicateOperations` siguen pendientes y sus
tests públicos deben fallar hasta #44. Un baseline probado no acredita W08
completa, APK ni persistencia nativa.

## Integración del material

| Contenido del ZIP | Comparación con main / acción |
|---|---|
| `ACTIVITY_STUDENT_FACING.md`, `docs/assignments/week-08.md` | Duplicados idénticos entre sí; se incorpora sólo la ruta canónica `docs/assignments/week-08.md`. |
| `RUBRIC_PUBLIC.md`, `docs/assignments/week-08-rubric.md` | Se incorpora la copia canónica íntegra. |
| `STARTER_AND_REPOSITORY.md`, `docs/assignments/week-08-repository.md` | Se incorpora la copia canónica íntegra. |
| `CAMPUSOPS.md`, `docs/CAMPUSOPS.md` | Iguales al documento existente; no se duplica en raíz. |
| `CAMPUSOPS_API.md`, `docs/CAMPUSOPS_API.md` | Iguales al contrato existente; no se duplica en raíz. |
| `course-tests/public/week-08.test.ts` | Idéntico al existente; se conserva sin editar. |
| `INSTALL.md` | Se antepone W08 íntegra, conservando W06/W05 debajo. |
| `.github/workflows/week-08-persistencia-sincronizacion-feedback.yml` | Se incorpora con historial/tags completos, SHA del PR y Node 22.22.0, conforme guía; se añaden regresiones W06, límites y probe del baseline. Todos los gates oficiales permanecen obligatorios. |

El workflow oficial ejecuta `evidence-week-08` aun en ramas sin etiqueta.
Se conserva ese gate: en esta fase faltan implementación, evidencias y tag;
su fallo es diagnóstico real. No hay `continue-on-error`, omisión de tests o
éxitos forzados. Los workflows y evidencias históricos permanecen intactos.

## Estado del código al partir

`App.tsx/createGraph` compone sesión W06, SecureStore, transporte autenticado,
repositorio HTTP y casos de uso. El fake y el backend siguen en memoria.
`Incident` conserva versión opcional para fixtures históricas; el mapper HTTP
no retiene `assignedTechnicianId`. `PerformIncidentAction` sólo ejecuta online;
no hay workspace inyectado en la app. #43/#45 deberán conservar base y
asignación antes de resolver reasignaciones. El único movimiento actual es de
**tipo**: `SyncRecord` vive en Domain y el contrato de evaluación lo reexporta,
sin cambiar firma, evitando Application → course-evaluation.

## Proveedor confirmado para implementar en #43

Se selecciona **expo-sqlite, rango `~57.0.1` recomendado por Expo 57**,
como proveedor mínimo Android. La instalación bloqueada actual contiene Expo
57.0.16. Se inspeccionó fuera del repo el paquete publicado expo-sqlite 57.0.4
(satisface ese rango), sus metadatos y `src/SQLiteDatabase.ts`: apertura/cierre
y `withExclusiveTransactionAsync` con BEGIN, COMMIT, ROLLBACK y cierre en
finally. La [documentación oficial de Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/)
confirma persistencia entre reinicios, transacciones y parámetros enlazados.
No se añade una dependencia nativa antes de #43; allí se instalará con
`npx expo install expo-sqlite` y se comprobará de nuevo el rango del lockfile.

Usar transacción exclusiva y su objeto `txn` para impedir que escrituras
concurrentes ajenas entren en una migración. Los errores deben rechazar y
revertir; no se aceptan cambios parciales de esquema, snapshot o cola.
`withExclusiveTransactionAsync` no está soportado en web: Android es la
referencia obligatoria, sin afirmar compatibilidad web en esta fase.

`npm run check:week-08-provider` ejecuta SQLite real de Node 22 sobre un archivo
temporal: procesos separados para escribir, leer, migrar con falla y recuperar.
Compara esquema, contenido y user_version antes/después, y reabre tras rollback
y éxito. **Es un probe del motor, no una prueba del SDK Expo ni del adaptador
CampusOps**. La certificación sobre dispositivo/emulador y las migraciones de
la app pertenecen a #43/#47. El paquete inspeccionado incluye AAR/JAR/SO/WASM:
se inventariaron sin ejecutarlos; véase `provider-source.json`.

## Contratos definitivos de preparación

Son acuerdos de equipo validados contra el ZIP, que **no impone estos puertos
ni esquema SQL**. Rutas reales publicadas:

- `src/application/persistence/PendingOperationStore.ts`.
- `src/application/persistence/LocalWorkspace.ts`.
- `src/application/persistence/LocalIncidentSnapshot.ts`.
- `src/domain/sync/SyncRecord.ts`, reexportado por `src/course-evaluation/contracts.ts`.
- `PendingIncidentOperation` e `IncidentWork` se reutilizan sin cambios desde `src/campusops/contracts.ts`.

```ts
interface PendingOperationStore {
  enqueue(operation: PendingIncidentOperation): Promise<void>;
  listPending(): Promise<readonly PendingIncidentOperation[]>;
  acknowledge(operationId: string): Promise<void>;
}
interface LocalWorkspace {
  open(): Promise<void>;
  close(): Promise<void>;
  migrate(targetVersion: number): Promise<void>;
  readonly pending: PendingOperationStore;
  getSnapshot(incidentId: string): Promise<LocalIncidentSnapshot | null>;
  saveSnapshot(snapshot: LocalIncidentSnapshot): Promise<void>;
  commitChange(snapshot: LocalIncidentSnapshot, operation: PendingIncidentOperation): Promise<void>;
}
```

`open`/`close` deben ser idempotentes; las operaciones sobre un workspace
cerrado rechazan. `migrate` acepta versión soportada, conserva la misma versión
como no-op y rechaza downgrades/versiones desconocidas sin mutar el recurso.
`saveSnapshot` guarda caché sin generar cola. `commitChange` valida IDs coherentes
entre `base`, `local` y `operation.incidentId`, y confirma snapshot y operación
en una sola transacción. Una falla en cualquier paso no cambia ninguno.

`enqueue` conserva orden de inserción durable e identidad, no genera IDs.
Repetir ID con contenido JSON equivalente es no-op; repetirlo con contenido
distinto rechaza sin modificar estado. Sólo admitir JSON serializable, sin
tokens, NaN, Infinity, undefined ni referencias cíclicas. La validación y los
mensajes controlados corresponden al adaptador/casos de uso de #43/#45.
`acknowledge` de un ID ausente es no-op. Su caller debe comprobar respuesta
exitosa y correspondencia de operación/efecto antes de invocarlo: timeout,
409, 403 y conflicto conservan la cola. El almacén no certifica una respuesta
de red por recibir un string; #45 prueba esa precondición.

### Snapshot y esquema mínimo acordado (por implementar)

Esquema inicial **v1**, evolución de prueba **v2**, controlado con
`PRAGMA user_version`. #43 documentará SQL y migración reales en
`docs/data-model.md`, conservando compatibilidad con estas formas:

| Dato | Contenido y relación |
|---|---|
| Snapshot por incidencia | `base` y `local`, ambos `SyncRecord` con mismo `id`; base guarda versión y asignación antes del cambio, local conserva intención. `fields.work` agrupa asignado y estado para el contrato público. |
| Cola | `operationId` único, `incidentId`, `baseVersion`, `actorId`, `action`, `payload` originales; secuencia durable para orden. Referencia a snapshot existente. |
| Notas | En snapshot: `noteId`, `operationId`, `actorId`, `text`; operación `comment` separada. |
| Fotografías sintéticas | En snapshot: `evidenceId`, `operationId`, `actorId`, `localUri`, `mediaType`, `byteLength`; operación `add_evidence` separada. URI de archivo durable propiedad de la app, jamás sólo caché. |
| Sesión | Permanece en SecureStore W06; ningún token en snapshots, archivos de fixture o cola. |

El adaptador puede almacenar notas/metadatos en JSON del snapshot y cola en
tabla separada, usando columnas/índices sólo para identidad y relaciones.
La imagen vive fuera de la DB; se prepara su copia durable antes de publicar
la referencia mediante transacción y se limpia un archivo huérfano si falla.
No se presume atomicidad conjunta SQL/sistema de archivos. No borrar archivos
referenciados por otra operación ni presentar referencias como cargas exitosas.

Las fixtures de inicio, nota y foto comparten base 1 para pruebas de conservación;
no son tres escrituras consecutivas al servidor ya autorizadas. #45 debe tratar
versiones posteriores y rebases explícitos sin reutilizar una clave con cuerpo
distinto. El backend controla autorización final con sesión W06; cambiar de
cuenta no autoriza enviar la operación del actor previo.

### Sync público conservado

```ts
resolveSync(base: SyncRecord, local: SyncRecord, remote: SyncRecord): Readonly<
  { kind: 'merged'; fields: Readonly<Record<string, unknown>> } |
  { kind: 'conflict'; fields: readonly string[] }
>;
deduplicateOperations<T extends Readonly<{ operationId: string }>>(
  operations: readonly T[]
): readonly T[];
```

#44 implementa una sola lógica reutilizada por app y evaluación: comparación
por contenido JSON (orden de claves de objetos irrelevante, arrays ordenados),
combinación de cambios independientes/iguales, conflictos distintos en el mismo
campo ordenados por nombre y ninguna mutación. Dedupe conserva el primer objeto
y orden de identidades. No equivale a idempotencia remota. `work` en conflicto
conserva intención local y asignación remota; la resolución se informa y decide
explícitamente, sin last-write-wins silencioso. No implementar `planRetry` W09.

## Fixtures, factory y comandos publicados

`createWeek08Scenario(photoUri)` en `course-tests/fixtures/week-08/scenario.ts`
devuelve objetos nuevos: base technician-1/assigned v1, local in_progress,
remoto technician-2/assigned v2, inicio estable `w08-start-001`, nota y foto con
sus operaciones propias. `SYNTHETIC_PHOTO` es SVG original sintético.

`createTemporaryWorkspace(createWorkspace)` en `temporaryWorkspace.ts` crea un
directorio aislado, `workspace.sqlite` y archivo de imagen durable; devuelve:
`options`, `photoUri`, `photoPath`, `directory`, `reopen()`, `failNext(point)` y
`cleanup()`. El callback recibe `{databasePath, attachmentDirectory, injectFailure}`.
#43 conecta el adaptador real; no hay implementación de LocalWorkspace escondida
en esta factory. `reopen` cierra la instancia anterior y abre una **nueva sobre
el mismo archivo**, y cleanup cierra recursos antes de borrar sólo su directorio.

Puntos de falla, consumidos una sola vez: `enqueue.afterWrite`,
`change.afterSnapshot`, `acknowledge.afterDelete`, `migration.afterSchema`,
`migration.afterCopy`. #43 llama `injectFailure` **dentro** de la transacción,
después del paso nombrado y antes del commit. #47 inspecciona luego datos/versión
reabriendo el recurso. La suite del baseline prueba el lifecycle del harness
con un archivo real y sus hooks; no acredita la cola de la app.

Usar Node **22.22.0** (`nvm use`) y `make setup`:

| Comando | Qué comprueba / estado de preparación |
|---|---|
| `npm run test:week-08:baseline` | Fixtures, aislamiento, reapertura y cleanup del harness; tres tests. |
| `npm run check:week-08-provider` | Capacidad SQLite sobre disco y metadatos de compatibilidad Expo; no SDK Android. |
| `npm run test:week-08:public` | Sólo los tres tests públicos W08; falla mientras #44 sea stub. |
| `npm run test:week-08` | Baseline + proveedor + público; propaga el primer error. |
| `npm run test:week-08:module -- course-tests/week-08-baseline.test.ts` | Runner aislado comprobado. #47/#48/#45 lo usarán con sus suites persistence/sync/integration cuando existan. No se publican suites inexistentes como aprobadas. |
| `npm run typecheck`, `npm run lint` | Contratos estrictos y estilo de todo el árbol. |
| `npm run test:smoke`, `npm run test:incidents`, `npm run test:architecture`, `npm run check:architecture` | Regresiones mínimas y límites. |
| `npm run test:week-06`, `npm run check:week-06-readiness` | Sesión, perfiles, concurrencia y ocho invariantes W06. |
| `make feedback` | Tipos, lint, tests acumulados, arquitectura, secretos, auditoría crítica y export Expo Android. No ejecuta W08 público por defecto. |
| `make verify-week-08` | Estructura, tipos/lint/audit, smoke y backend; no exige entrega completa. |
| `make public-test-week-08` | Toolchain, prueba pública W08 y los cinco artefactos. Debe revelar stubs y faltantes. |

`npm test` tiene una selección acumulada explícita sin W08. No interpretar su
verde como validación W08. El runner aislado usa `--runTestsByPath`; no se usa
`test:all` porque ejecutaría stubs de hitos futuros. Las suites futuras se
llamarán `course-tests/week-08-persistence.test.ts` (#47),
`course-tests/week-08-sync.test.ts` (#48) y
`course-tests/week-08-integration.test.tsx` (#45).

Resultados reales, códigos, logs, SHA técnico y duración:
`reports/week-08/baseline/validation.json`. El índice distingue pruebas que
pasan de gates W08 pendientes. No se escriben resultados anticipados aquí.

## Matriz de requisitos, issues y pruebas

| Requisito del correo / actividad | Estado tras #42 | Issue | Comprobación final requerida |
|---|---|---|---|
| Preparar kit/modelo (1) | Kit leído, contratos/fixtures publicados; adaptador pendiente | #42, #43 | Inventario completo, baseline suite, modelo real y límites. |
| Conservar cola, autor, notas/foto al reiniciar (1–2) | Harness de disco preparado; app pendiente | #43, #45, #47 | persistence + integration: nueva instancia/proceso, mismo contenido/archivo/ID. |
| Migración íntegra y falla (3) | Probe SQL preparado; migración app pendiente | #43, #47 | Esquema anterior no vacío, éxito, falla dentro de transacción, rollback y reapertura. |
| Reasignación conflictiva (4) | Fixture exacta; motor/app pendientes | #44, #45, #48 | Conflicto `['work']`, conservar ambas intenciones y autorización W06. |
| Combinar/deduplicar (5) | Firmas conservadas; stubs pendientes | #44, #48 | Público aislado y sync: contenido JSON, orden e inmutabilidad. |
| Sync e idempotencia completas (6) | Contrato de confirmación; flujo pendiente | #45 | Grafo real, timeout_after_commit, replay con misma clave/cuerpo, un efecto y retiro sólo confirmado. |
| AC-01 reproducción — 2.5/8 | Herramientas y comandos publicados | #42, #52 | Setup, feedback y verify/public desde SHA final. |
| AC-02 integridad — 2/8 | Implementación pendiente | #43–#45, #47–#48 | Flujos completos anteriores, no sólo funciones puras. |
| AC-03 falla — 1.5/8 | Probe de capacidad; app pendiente | #43, #45, #47 | Sin corrupción/duplicación; estados antes/falla/recuperación. |
| AC-04 decisión — 1.5/8 | Decisión de preparación documentada | #43–#45, #52 | Engineering final vincula alternativas, costo, prueba y resultado. |
| AC-05 aporte — 0.5/8 | Ninguna evidencia ajena creada | #46, #49–#51, #52 | Tres aportes propios verificables y explicación humana. |

## Artefactos y formato confirmados

Los cinco entregables oficiales siguen pendientes de sus issues:
`docs/data-model.md` (#43), `docs/sync-policy.md` (#44),
`reports/week-08/migration-tests.json`, `evidence/week-08/engineering.json` e
`evidence/week-08/individual.json` (#52). Los informes del baseline son
auxiliares: no sustituyen migraciones ni las tres aportaciones.

Los JSON usan `schemaVersion: 1`, `week: 8`. Reportes: `commitSha`,
`generatedAt` ISO 8601 y `checks` no vacío; cada check lleva `id`, `status`
(`pass|fail|not_applicable`), `scenarioType` (`nominal|boundary|failure`),
`command`, `evidence`, con al menos un caso boundary/failure.
Engineering: decisión sustantiva, dos alternativas diferentes, tradeoff,
AC-01..05 y `verification[{command,result,evidence}]`.
Individual: un archivo con `teamId` y exactamente tres `members`, cada uno con
`studentId`, `commitShas`, `files`, `tests`, `reviews`, `prediction`, `command`,
`observedResult`, `explanation`. No inventar roster, commits o revisiones.
Para comprobar formato final con las herramientas existentes se usa
`make public-test-week-08`; no hay un validador oficial separado para borradores.
Archivos auxiliares no están prohibidos, pero tampoco reemplazan individual.json.

Orden de entrega confirmado: commit técnico → ejecutar checks y completar
evidencia con su SHA → commit exclusivo reports/evidence → tag anotado
`week-08-final` → `make evidence-week-08` → publicar rama/tag y enviar URL/tag/SHA
en Classroom. SHA de reportes: HEAD o padre inmediato si el último commit sólo
contiene reports/evidence. **Este baseline no crea tag, no entrega en Classroom
y no cierra #43–#52.** Revisión humana y evidencia individual quedan pendientes.

Asistencia material: Codex para inspección, contratos, fixtures, scripts,
documentación y ejecución. La revisión humana no se atribuye ni se simula.


## Actualización posterior del contrato — #43

El estado anterior describe el SHA del baseline, no el estado actual de #43.
El adaptador y esquema reales se documentan en `docs/data-model.md`.
Comando owner publicado: `npm run test:week-08:persistence`
(`course-tests/week-08-workspace-owner.test.ts`, mismo adaptador SQL con driver
SQLite Node real sobre disco). No ocupa el nombre de la suite independiente
`week-08-persistence.test.ts` de #47. Factory Node publicada en
`course-tests/fixtures/week-08/nodeWorkspace.ts`; acepta las opciones y hooks
definitivos de #42. Factory nativa: `createExpoWorkspace(options)` con paths
Android y los mismos puntos de falla. `npm run test:week-08:native` comprueba
Expo SQLite/FileSystem en un APK debug aislado del mismo proyecto, con dos
procesos. Los resultados reales de #43 se indexan por separado en
`reports/week-08/persistence/validation.json`. El agregado `test:week-08`
ahora incluye la suite owner antes de los tests públicos; no elimina sus
fallos de #44 ni acredita integración #45 o revisión humana.


## Composición conjunta de #43 y #44

El grafo actual expone tanto `localWorkspace` durable como `syncEngine`
compartido. El agregado W08 y su workflow conservan ambas suites. Los estados
anteriores de este documento y sus reportes pertenecen a sus SHA observados;
la validación conjunta posterior se registra en
`reports/week-08/persistence-integration/validation.json`. La integración de
pantallas, autorización y envío/confirmación sigue en #45; no se acredita
entrega semanal completa ni revisión humana.


## Integración posterior #45

`IncidentWorkspace`, el gateway verificado y el panel local ya consumen los
contratos del baseline en el grafo real. Se amplía LocalWorkspace únicamente
con listSnapshots; metadatos opcionales no cambian el esquema v2. El inicio
habitual usa persistencia antes de red y notas/foto se conservan con identidad.
Política y límites actuales: docs/data-model.md y docs/sync-policy.md.
Runner publicado: `npm run test:week-08:integration` y ruta real
`npm run test:week-08:module -- course-tests/week-08-integration.test.tsx`.
La suite se incorpora al agregado y workflow existentes sin duplicarlos.
Las observaciones anteriores conservan sus SHA; las de #45 se indexan en
reports/week-08/app-integration/validation.json. La revisión humana y #52
siguen pendientes. No se crea tag ni se envía Classroom.
