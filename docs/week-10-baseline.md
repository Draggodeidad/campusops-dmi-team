# W10 — Baseline, kit y contratos compartidos (#81)

Fuente de la actividad: `week-10-estados-observabilidad.zip`. SHA-256
`d2d0c44197668e2ab500ae217860f52fd089ef63337c0ff6eef4a0a3c8962464`.
El archivo se extrajo fuera del repositorio, pasó `unzip -t` y se comparó
contra `main` en `bad5de745895f197e23f4e5f19b8c18e068e82dc`.

## Inventario y decisión de integración

| Entrada del ZIP | Comparación e integración |
| --- | --- |
| `.github/workflows/week-10-estados-observabilidad-feedback.yml` | Nuevo. Conserva los comandos del kit, fija Node 22.22.0 según la guía y obtiene historial/tags para validar ascendencia. En cada evento ejecuta la verificación, arquitectura y las pruebas del baseline. En el tag final ejecuta además los evaluadores de comportamiento con entregables y de evidencia congelada. |
| `INSTALL.md` | Reemplazarlo habría eliminado las instrucciones históricas. Se antepone la sección W10 y se conserva el contenido anterior. |
| `course-tests/public/week-10.test.ts` | Idéntico byte por byte. Se conserva la prueba oficial. |
| `docs/CAMPUSOPS.md` | Idéntico byte por byte. |
| `docs/CAMPUSOPS_API.md` | Idéntico byte por byte. |
| `docs/assignments/week-10.md` | Nuevo. Actividad oficial, copiada íntegra. |
| `docs/assignments/week-10-repository.md` | Nuevo. Guía de repositorio y entrega, copiada íntegra. |
| `docs/assignments/week-10-rubric.md` | Nuevo. Rúbrica oficial, copiada íntegra. |

La actividad abre el **3 de noviembre de 2026 a las 08:00** y cierra el
**9 de noviembre de 2026 a las 23:59**, hora de Ciudad de México. El cierre
coincide con el anuncio registrado en la issue. Las referencias genéricas
`ACTIVITY_STUDENT_FACING.md`, `RUBRIC_PUBLIC.md` y
`STARTER_AND_REPOSITORY.md` corresponden a los tres documentos en
`docs/assignments/`. El ZIP trae un workflow y una prueba pública. Make,
el evaluador, el contrato JSON y los scripts existentes se reutilizan.

## Estado e identidad para #82, #85 y #88

Importar `RemoteUiState<T>`, `startRemoteRequest`, `settleRemoteRequest`
y `remoteUiActions` de `src/application/ui-state/RemoteUiState.ts`.
La pantalla abre una intención nueva con `{ requestId, selectionId }` en cada
consulta o reintento. `selectionId` identifica la incidencia o vale `null`
para lista. Un `requestId` nuevo también distingue dos consultas de la misma
incidencia. Cada evento conserva la identidad capturada al iniciar la
solicitud. Sólo un evento con ambos identificadores activos puede resolver
`loading`. La primera resolución o cancelación lo cierra. El siguiente
intento empieza desde `startRemoteRequest`.

| Estado | Entrada o transición | Acción accesible y resultado esperado en pantalla |
| --- | --- | --- |
| `loading` | Iniciar, cambiar selección o reintentar | **Cancelar** sale de la espera inmediatamente. |
| `success` | Respuesta activa con datos | **Continuar** abre la incidencia en lista o permite volver al listado desde detalle. |
| `empty` | Lista activa sin incidencias | **Actualizar lista** abre una nueva solicitud. |
| `error` | Falla activa con código o mensaje controlado | **Reintentar** abre una nueva solicitud. |
| `cancelled` | Cancelación de la espera activa | **Reintentar** usa otro ID. El éxito o error tardío deja el estado igual. |
| `offline` | Desconexión con copia local autorizada | **Reintentar conexión** abre otra solicitud y conserva disponible la copia local. |
| `pending` | Cambio local guardado, por confirmar | **Sincronizar pendientes** intenta confirmar la misma operación durable. |
| `conflict` | Cambio local incompatible con la versión remota | **Revisar conflicto** abre el flujo explícito de resolución conservando la intención. |

Los resultados `offline`, `pending` y `conflict` llevan datos locales con
el tipo elegido por el consumidor. UI conserva los permisos por perfil y el
ámbito de sesión W06. Para cancelar, primero se invalida la espera mediante
el evento `cancel`. #82 podrá propagar aborto donde el transporte lo admita.
Cancelar la espera de una escritura conserva la operación y su identidad W08
hasta tener confirmación. El estado local tampoco confirma efectos remotos.

`reduceRemoteResponses` conserva las entradas y salidas públicas del starter.
El adaptador usa la misma política de Application, con selección `null` porque
la firma pública sólo conoce `activeRequestId`. Una respuesta sin valor ni
error no resuelve la espera. La primera resolución válida gana. Si contiene
ambos, el error tiene precedencia. La integración con navegación, accesibilidad
nativa, consulta y atención corresponde a #82 y sus pruebas a #85.

## Diagnóstico para #83 y #86

Importar `DiagnosticEvent`, `DiagnosticSink` y `emitDiagnostic(event, sink)`
de `src/application/telemetry/emitDiagnostic.ts`.

- `correlationId` sigue `w10-request-<secuencia positiva>`, con hasta 15
  dígitos. El consumidor genera la secuencia técnica, conserva el ID dentro
  de una solicitud lógica y usa otro ID para una nueva intención.
- `incidentId` es opcional. Se acepta `campus-inc-` seguido de 1 a 15 dígitos
  sintéticos, incluidos los IDs con ceros iniciales del backend didáctico.
- `status` es un código HTTP entero 100–599 o uno de `success`, `empty`,
  `error`, `timeout`, `offline`, `cancelled`, `pending`, `conflict` y
  `terminal`. `attempt` es un entero seguro desde 1. `durationMs` es un
  número finito no negativo.
- El emisor construye un objeto nuevo con la allowlist y pasa ese objeto por
  `redactForTelemetry` antes del sink. Un campo obligatorio inválido descarta
  el evento. Un ID de incidencia inválido se omite. La ruta, cuerpo, tokens,
  errores crudos, ubicación, texto libre y contexto anidado quedan fuera.
- El sink se inyecta y puede ser síncrono o asíncrono. Sus fallos se aíslan.
  El flujo de usuario puede invocar el emisor sin esperar su finalización.
  #83 integra la generación y propagación del ID y los puntos de emisión.
  El ejecutor de retry W09 conserva su ruta de métricas actual.

## Fixtures y comandos

`course-tests/fixtures/week-10.ts` exporta `stateOutcomes` con lista vacía,
error recuperable, copia offline y cola pendiente o en conflicto.
`intentA`, `intentB`, `responsesBThenA` y `cancelB` reproducen cambio de
selección, respuestas invertidas y cancelación. `sensitiveDiagnostic` y
`expectedDiagnostic` permiten comparar un payload sensible anidado con los
únicos campos entregados al sink. Los valores son sintéticos.

| Comando | Alcance |
| --- | --- |
| `make setup` | Instalación reproducible con Node 22.22.0 y npm. |
| `make feedback` | Tipos, lint, pruebas acumuladas base, arquitectura, escaneo, auditoría crítica y exportación Expo Android. |
| `npm run test:week-10:baseline` | Ejecuta por ruta exacta la prueba pública W10 y las regresiones de los contratos #81. |
| `npm run test:week-10:module -- <ruta>` | Ejecuta suites por ruta exacta. #85 usa `course-tests/week-10-ui-state.test.ts` y `course-tests/week-10-navigation.test.tsx`. #86 usa `course-tests/week-10-observability.test.ts`. |
| `make verify-week-10` | AC-01 con estructura, tipos, lint, auditoría crítica, smoke y backend. |
| `make public-test-week-10` | Prueba pública y comprobación de los cinco entregables. El gate completo requiere los archivos de las issues posteriores. |
| `make evidence-week-10` | Comprueba estructura, evidencia y que `HEAD` corresponda a `week-10-final`. Se ejecuta después de fijar el tag en el cierre. |

El ZIP carece de un comando específico para validar Mermaid. El diagrama
oficial y el contraste de sus transiciones con la UI integrada son de #88.
Las observaciones de esta fase se registran en
`reports/week-10/baseline/validation.json`.

## Entrega oficial y responsabilidades

| Entregable | Contenido y trabajo pendiente |
| --- | --- |
| `docs/ui-state-machine.mmd` | Diagrama de transiciones y acciones de UI (#88). |
| `reports/week-10/ui-tests.json` | Estados, navegación, accesibilidad y respuestas obsoletas (#85). |
| `reports/week-10/log-sanitization.json` | Señal diagnóstica y exclusión de datos sensibles (#86). |
| `evidence/week-10/engineering.json` | Decisión sobre estado y señal técnica, dos alternativas, trade-off y verificación (#90). |
| `evidence/week-10/individual.json` | Tres aportes verificables en un archivo del equipo (#84, #87, #89 y consolidación #90). |

Según la [guía W10](assignments/week-10-repository.md) y el
[contrato de evidencia](EVIDENCE_CONTRACT.md), los JSON usan
`schemaVersion: 1` y `week: 10`. Los reportes requieren `commitSha`,
`generatedAt` ISO 8601 y `checks` con `id`, `status`, `scenarioType`,
`command` y `evidence`, incluido un caso `boundary` o `failure`.
Engineering vincula `AC-01` a `AC-05` y documenta `verification`
con `command`, `result` y `evidence`. Individual requiere `teamId`,
tres `members` y, para cada persona, `studentId`, `commitShas`, `files`,
`tests`, `reviews`, `prediction`, `command`, `observedResult` y
`explanation`.

Los JSON con `commitSha` apuntan al SHA evaluado. En la entrega se admite
también el padre inmediato del tag si el commit final sólo modifica
`reports/` y `evidence/`. El cierre semanal usa el tag anotado
`week-10-final`, verifica evidencia después de fijarlo y entrega URL,
tag y SHA completo en Classroom. Los cinco criterios oficiales suman 8
puntos, con máximos de 2.5, 2, 1.5, 1.5 y 0.5 respectivamente. La evidencia
de baseline corresponde a los contratos de #81. Las pantallas, emisión
integrada, revisión humana y evidencia final se completan por separado.

Se usó Codex para comparar el kit, proponer e implementar contratos,
redactar documentación y ejecutar las comprobaciones registradas.
La revisión humana corresponde al PR.
