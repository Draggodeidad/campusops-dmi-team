# W08 — evidencia nueva del main fusionado (#52)

SHA real de main evaluado: **fb11b69f3617466712bbd67d0ef49f0592d3a357**. PR #58 fusionado mediante merge commit; padres 749b171b1c57a6215810dca5da376b0f288bd732 y fef910fb306d9321052c792117172ff3696be249.

El SHA histórico d7d28522da8c3e13bd189a9539fafde077cd214b sigue siendo ancestro, pero no HEAD/padre inmediato: el evaluador original rechazó esa relación tras el merge. post-merge-sha.json conserva el diagnóstico. Los índices oficiales ahora referencian el main realmente reejecutado.

## Controles observados

Node 22.22.0, npm 10.9.4, NODE_OPTIONS=--experimental-sqlite. Fuente/documentos sin modificaciones locales durante la captura; sólo reports/evidence para registrar observaciones. Las ejecuciones son asistencia técnica de Codex a petición del owner, no ejecuciones personales atribuidas a estudiantes.

| Comando | Exit | Pruebas passed/total |
|---|---:|---|
| `make setup` | 0 | [] |
| `npm run typecheck` | 0 | [] |
| `npm run lint` | 0 | [] |
| `npm run test:smoke` | 0 | [['1', '1']] |
| `npm run test:incidents` | 0 | [['3', '3']] |
| `npm run test:architecture` | 0 | [['2', '2']] |
| `npm run check:architecture` | 0 | [] |
| `npm run test:week-06` | 0 | [['31', '31']] |
| `npm run check:week-06-readiness` | 0 | [] |
| `npm run test:week-08:persistence` | 0 | [['30', '30']] |
| `npm run test:week-08:sync` | 0 | [['47', '47']] |
| `npm run test:week-08:integration` | 0 | [['24', '24']] |
| `npm run test:week-08` | 0 | [['3', '3'], ['30', '30'], ['47', '47'], ['24', '24'], ['3', '3']] |
| `make feedback` | 0 | [['87', '87']] |
| `make verify-week-08` | 0 | [['1', '1']] |
| `python3 reports/week-08/pr56-review/validate-individual.py` | 0 | [] |
| `python3 reports/week-08/pr56-review/audit.py` | 0 | [] |
| `git diff --exit-code fb11b69f3617466712bbd67d0ef49f0592d3a357 -- src App.tsx course-tests .github/workflows Makefile tools/course_public_evaluator.py docs/EVIDENCE_CONTRACT.md docs/SUBMISSION.md docs/assignments package.json package-lock.json` | 0 | [] |
| `git diff --check` | 0 | [] |
| `make public-test-week-08` | 0 | [['90', '90']] |

Los 20 controles finales aprobaron, incluido público 90/90 después de regenerar los índices. Los esquemas pasan con el validador original. No se ejecutó make evidence-week-08 localmente sin tag ni se convirtió pending_final_tag en pass.

## Integridad y procedencia

individual.json permanece idéntico a main, con Draggodeidad, osbaldoXxC y JulianDele. No se trasladan aportes ni logs originales de Osbaldo al owner. Las reproducciones nuevas se identifican como asistencia de IA bajo responsabilidad del owner. **AC-04 y AC-05 siguen pendientes de corroboración humana**; estructura y Git no acreditan comprensión o ejecución personal.

before-post-merge-capture.tar.gz y post-merge-archive.json preservan byte por byte los 49 artefactos anteriores de issue-52; sus resultados conservan los SHAs originales y no se presentan como actuales. Los archivos históricos fuera de esta carpeta y los commits anteriores se conservan. Las copias .log sólo normalizan espacios finales de stdout; .log.gz conserva los bytes exactos con hashes.

## Auditoría y propuesta sin aplicar

npm audit --omit=dev --json devolvió exit 1: ocho high, cero critical. El gate oficial audit:ci conserva su umbral critical y pasó. Expo es directa; las otras siete entradas son transitivas, principalmente herramientas Expo, y sobreviven a omitir dev. No se afirma alcance efectivo de cada dependencia en el bundle móvil.

audit-production.json, audit-analysis.json y audit-proposal.md documentan versiones/rangos y un PR separado propuesto para brace-expansion 1.1.21/5.0.12, compression 1.8.2 y source-map-js 1.2.2. La compatibilidad requiere regresiones; no se aplicó ningún cambio. node-forge sigue sin parche publicado y Expo CLI requiere Zod 3; no imponer Zod 4 ni degradar Expo 57 a 54.

## Commit de evidencias y cierre pendiente

Esta rama sólo modifica reports/ y evidence/, incluidos migration-tests.json y engineering.json. El commit de evidencias debe conservar fb11b69f3617466712bbd67d0ef49f0592d3a357 como primer padre. Verificar identidad autorizada Draggodeidad <antonioimanol7@gmail.com> antes de commit y revisar autor/committer después, sin coautoría automática.

El owner debe revisar/fusionar este nuevo PR con Create a merge commit. Después, comprobar que el nuevo main F tiene fb11b69f3617466712bbd67d0ef49f0592d3a357 como primer padre, diff exclusivamente de evidencias y lista íntegra de rutas inferior a 3000 caracteres. Si main avanzó, revalidar sobre la nueva base en lugar de sustituir SHAs sin ejecutar. No fusionar desde esta tarea.

La creación y publicación del tag anotado week-08-final están autorizadas al agente sólo después de verificar F, árbol limpio, ausencia local/remota del tag y relación válida de evidencias. Ejecutar make evidence-week-08 después de crear el tag; exigir status=pass y frozen_sha=pass antes de publicar. Ante fallo, conservarlo y no mover referencias. El reporte posterior queda local, sin otro commit.

Verificar Actions del evento del tag y el mismo F. Sólo con tag remoto y frozen_sha=pass generar /home/dragodeidad/Documents/DMI/entrega-week-08.txt fuera del checkout congelado, con las tres líneas exactas solicitadas y el SHA obtenido de git rev-parse week-08-final^{commit}. No generar ese archivo ni declarar #52 completa antes de satisfacer la condición.

Estado actual: pending_final_tag; nuevo PR pendiente de revisión/fusión humana; AC-04/AC-05 pendientes. No se revalidó Android nativo integrado; export Expo y SQL Node en disco no acreditan APK instalado.
