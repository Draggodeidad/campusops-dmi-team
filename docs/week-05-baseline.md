# Baseline y reparto de trabajo — issue #27

## Procedencia y comparación del kit

`week-05-cliente-cloud.zip` se examinó completo fuera del repositorio. SHA-256: `eac011b9296a6923739c35ab5e93f5f3685c303a024c584f27cbce6016f1c04f`. Contiene ocho archivos. `ACTIVITY_STUDENT_FACING.md`, `STARTER_AND_REPOSITORY.md` y `RUBRIC_PUBLIC.md` son los nombres mencionados por la actividad; dentro del ZIP se publican como `docs/assignments/week-05.md`, `week-05-repository.md` y `week-05-rubric.md`. Los tres se leyeron íntegros.

| Archivo del ZIP | Comparación con `main` base | Integración |
|---|---|---|
| `INSTALL.md` | Mismas instrucciones, referencias W04 sustituidas por W05 | Actualizado |
| `docs/assignments/week-05.md` | Nuevo | Copiado sin alterar |
| `docs/assignments/week-05-repository.md` | Nuevo | Copiado sin alterar |
| `docs/assignments/week-05-rubric.md` | Nuevo | Copiado sin alterar |
| `.github/workflows/week-05-cliente-cloud-feedback.yml` | Nuevo | Copiado sin alterar |
| `course-tests/public/week-05.test.ts` | Idéntico byte por byte | Conservado |
| `docs/CAMPUSOPS.md` | Idéntico byte por byte | Conservado |
| `docs/CAMPUSOPS_API.md` | Idéntico byte por byte | Conservado |

No hubo cambios de dependencias ni de stack. La fecha oficial en la actividad es **5 de octubre de 2026, 23:59, Ciudad de México**; el 4 de octubre queda sólo como meta preventiva mencionada en la issue.

## Estado base y checks previos

`main` se actualizó con `git fetch` y `git pull --ff-only` antes de crear la rama. `main` y `origin/main` coincidían en `b6b8426205de3240255d94108320a2afff6fc6dd` (`week-04-final`). Al empezar había cuatro archivos sin seguimiento: `actividad-semana-5.md`, `evidencia-semana-04.txt`, `reports/week-04/failure.json` y el ZIP. Ninguno se incorpora a esta rama. El entorno utilizó el lockfile existente mediante `npm ci`; no se editó `package.json` ni `package-lock.json`.

| Comando antes de integrar | Resultado observado |
|---|---|
| `npm ci` | Exit 0; 973 paquetes instalados; npm audit de instalación informó 49 vulnerabilidades high, sin alterar el lockfile. |
| `make feedback` | Exit 0; typecheck, lint, suites configuradas, arquitectura, escaneo, audit de producción y exportación Android aprobaron. |
| `npm run test:architecture` | Exit 0; 2 pruebas aprobadas. |
| `npm run check:architecture` | Exit 0; `violations: []`. |
| `npm run backend:self-test` | Exit 0; contratos locales del backend aprobados. |
| `npx jest --no-watchman --cacheDirectory .jest-cache --ci --runInBand course-tests/public/week-05.test.ts` | Exit 1; 5/5 casos fallan porque `parseRemoteResource` lanza `pending`. Diagnóstico esperado antes del trabajo del cliente. |

## Correspondencia con la rúbrica real

| Criterio | Máximo | Trabajo y comprobación pendiente |
|---|---:|---|
| AC-01 | 2.5 | Instalar desde SHA y pasar `make verify-week-05` con evidencias reproducibles. |
| AC-02 | 2.0 | Lista, detalle y creación por cliente; distinguir respuesta inválida, timeout y 500; `make public-test-week-05` y reportes. |
| AC-03 | 1.5 | Rechazar datos corruptos y capturar excepciones con transporte sustituible y casos de falla reproducidos. |
| AC-04 | 1.5 | `evidence/week-05/engineering.json` debe conectar decisión DTO/dominio/errores, alternativas, costo y prueba observada. |
| AC-05 | 0.5 | `evidence/week-05/individual.json` debe reunir tres aportes propios verificables. |

`course-contracts.json` exige `docs/api-contract.md`, `reports/week-05/contract-tests.json`, `reports/week-05/failure-matrix.json`, `evidence/week-05/engineering.json` y `evidence/week-05/individual.json`. Cada reporte usa `schemaVersion: 1`, `week: 5`, SHA, fecha ISO y checks con al menos un caso límite o de falla. `make verify-week-05` comprueba estructura, tipos, lint, audit, smoke y backend; `make public-test-week-05` añade archivos, esquemas y prueba pública; `make evidence-week-05` exige además el tag en `HEAD`. `make feedback` ejecuta controles acumulados y exportación Android. `npm test` no incluye la prueba W05 por defecto, aunque el evaluador público la añade explícitamente.

Después de integrar el kit, `make feedback` volvió a terminar con exit 0 y `make verify-week-05` terminó con exit 0. `make public-test-week-05` terminó con exit 2: faltan los cuatro JSON de reportes/evidencias W05 y la prueba pública del parser falla en sus cinco casos porque la función continúa pendiente. Las otras nueve suites del comando aprobaron (19 pruebas). El audit de producción usado por `feedback` y `verify` cumple su umbral configurado (`critical`), aunque informó 25 vulnerabilidades `high`; no se cambió el lockfile ni se usó `npm audit fix --force`, que propone un cambio incompatible de Expo. Estos resultados no acreditan AC-02 ni AC-03.

## Propiedad de módulos y brechas

| Módulo | Propietario del trabajo | Estado al cerrar esta issue |
|---|---|---|
| Kit, workflow, baseline, firmas iniciales y trazabilidad AC | Draggodeidad, asignado a #27 | Integrado y documentado en esta rama. |
| `docs/api-contract.md`, `parseRemoteResource`, DTO/mapper, puerto y adaptador remoto | osbaldoXxC, asignado a #28 | El contrato inicial de #27 fue ampliado después junto al cliente de osbaldoXxC. |
| Casos de uso, UI mínima de creación e inyección en `App.tsx` | osbaldoXxC, asignado a #29 | Implementado después de #27 por osbaldoXxC; no atribuir a #27. |
| Pruebas funcionales y `contract-tests.json` / `failure-matrix.json` | JulianDele, asignado a #30 | Implementado después de #27 por JulianDele; no atribuir a #27. |
| `engineering.json`, `individual.json`, commit exclusivo de evidencia y tag | Draggodeidad, asignado a #31, después de los aportes propios de los tres integrantes | Pendiente. Cada integrante aporta su propia entrada; no copiar identidades ni SHAs anteriores. |

El workflow oficial W05 ejecuta `make evidence-week-05` también en `push` y `pull_request`. Antes de crear `week-05-final` y los cinco entregables, ese job debe fallar; el archivo oficial se conserva íntegro y esta limitación queda visible. Los reportes automáticos `verify.json` y `public-tests.json` son diagnósticos, no sustituyen los dos reportes de contrato exigidos. No se declara lista la entrega ni se crea el tag mientras falten cliente, pruebas y evidencia individual.

## Estado posterior de integración

La tabla y resultados anteriores describen el baseline de #27, antes de integrar #28–#30. Después se incorporaron los commits `d87ccaa79ca92a35fbdc6ed8653a3044766161df` (cliente/UI, osbaldoXxC) y `4112f42227f18c1d637c905cb7763befeeeedfee` (validación/reportes, JulianDele). `npm test` incluye ahora las suites W05. El workflow W05 conserva sus tres comandos y se ajustó para obtener historial/tags y evaluar el SHA de la rama en PR; así `make evidence-week-05` puede comprobar el tag real. El estado final y SHA evaluado se registran en los reportes W05, no se infieren de los resultados de baseline.
