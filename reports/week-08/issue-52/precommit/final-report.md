# Informe de preparación #52 — 26-10-2026

**Entrega incompleta; no lista para etiquetar.** La preparación local y las
validaciones están realizadas. Commit y push se detuvieron por la exigencia
del owner de autorizar expresamente nombre/correo. No hay PR publicado.

## AC-03: causa confirmada

Después de fetch, week-08-final no existe localmente ni en origin. El workflow
usa historial completo y descarga tags. El run 40385165581 sobre
749b171b1c57a6215810dca5da376b0f288bd732 pasó los esquemas oficiales, AC-01 y
AC-02; falló únicamente frozen_sha en AC-03 por referencia inexistente.
Make devolvió 2 y el evaluador 1. ci-ac03.log conserva la salida original;
diagnosis.json registra comandos, salidas y códigos de retorno nuevos.
No se modificó evaluador, workflow, Makefile ni contrato académico.
Estado de preparación: pending_final_tag; el fail oficial no se convierte en pass.

## Estado de los cinco criterios

| Criterio | Estado comprobado |
|---|---|
| AC-01 | Instalación/checks técnicos aprobados en el árbol preparado; falta commit limpio y reproducción del SHA definitivo tras integrar. |
| AC-02 | Persistencia, motor, integración y público aprobados. SQL Node real y backend loopback; no certificación Android del flujo integrado. |
| AC-03 | Rollback, integridad y replay aprobados en suites. Gate de congelación pendiente: tag ausente; no se ejecutó make evidence-week-08 localmente antes del tag. |
| AC-04 | Decisión, alternativas, tradeoff y verificaciones estructuralmente válidos; revisión humana pendiente. |
| AC-05 | Tres registros válidos y 20 commits fuente con autoría coherente/alcanzable. Comprensión, explicación y corroboración humanas pendientes. |

## Los cinco archivos oficiales

| Archivo | Revisión/cambio |
|---|---|
| docs/data-model.md | Esquema v2, transacciones, fotos y recuperación contrastados con adaptador y suites; se corrige una referencia a presentación de errores como trabajo futuro. |
| docs/sync-policy.md | Merge JSON, work indivisible, identidad/recibos y resolución contrastados con código y suites; se actualiza la descripción del agregado y #43–#45 ya integrados. |
| reports/week-08/migration-tests.json | Borrador actualizado con 20 comandos reales y escenarios de reinicio, migración/rollback, conflicto/merge/dedupe y replay. Incluye SHA base y hashes de docs sin commit. |
| evidence/week-08/engineering.json | Decisión/alternativas preservadas; nuevas observaciones vinculadas a logs y límites explícitos de borrador. |
| evidence/week-08/individual.json | Sin cambios. Exactamente Draggodeidad, osbaldoXxC y JulianDele; se conserva procedencia, asistencia de IA y pendientes humanos. |

Las copias previous-* conservan los índices anteriores sin reescribir sus
resultados. dependencies.json refleja #42–#46 cerradas, #47–#51 abiertas al
consultar; sus estados administrativos no acreditan revisión humana.
No hubo cambios de implementación ni arquitectura: ADR y Mermaid se conservan.
La nueva guía docs/week-08-delivery.md desarrolla el procedimiento manual completo.

## Validaciones observadas

Node v22.22.0, npm 10.9.4, NODE_OPTIONS=--experimental-sqlite, npm ci y lockfile
intacto. validation.json incluye ruta, fechas, duración, entorno, HEAD,
hashes de documentos sin commit, comando y exit de cada ejecución.
Todos los comandos siguientes terminaron con **exit 0**:

| Comando | Resultado |
|---|---|
| make setup | npm ci correcto |
| npm run typecheck | correcto |
| npm run lint | correcto |
| npm run test:smoke | 1/1 |
| npm run test:incidents | 3/3 |
| npm run test:architecture | 2/2 |
| npm run check:architecture | límites respetados |
| npm run test:week-06 | 31/31 |
| npm run check:week-06-readiness | 8/8 invariantes |
| npm run test:week-08:persistence | 30/30 |
| npm run test:week-08:sync | 47/47 |
| npm run test:week-08:integration | 24/24 |
| npm run test:week-08 | 3 + 30 + 47 + 24 + 3, y probe de proveedor |
| make feedback | 87/87, tipos/lint, arquitectura, secretos, audit y export Android |
| make verify-week-08 | aprobado, incluye backend self-test |
| make public-test-week-08 | 90/90 y esquemas; repetido tras consolidar índices, exit 0 |
| python3 reports/week-08/pr56-review/validate-individual.py | estructura de tres registros válida |
| python3 reports/week-08/pr56-review/audit.py | procedencia y fuentes conservadas |
| git diff --exit-code 749b171b1c57a6215810dca5da376b0f288bd732 -- src App.tsx course-tests .github/workflows Makefile tools/course_public_evaluator.py docs/EVIDENCE_CONTRACT.md docs/SUBMISSION.md docs/assignments package.json package-lock.json | archivos protegidos intactos |
| git diff --check | sin errores |

draft-contract-checks.json aplica las funciones originales del evaluador a los
tres JSON oficiales y comprueba sus estructuras; no sustituye congelación ni
corroboración humana. La repetición pública también valida esos índices.
El audit permitido por el proyecto pasó su umbral critical; informó **8 high**.
No se afirma ausencia de vulnerabilidades ni se cambiaron versiones/umbrales.

## Git, autoría y SHA

Rama: fix/w08-final-evidence-issue-52, en checkout aislado
/home/dragodeidad/.codex/worktrees/w08-issue-52/campusops-dmi-team.
La cuenta conectada por plugin y gh es Draggodeidad. La identidad efectiva
configurada es Draggodeidad <antonioimanol7@gmail.com>, con origen en .gitconfig;
su autorización expresa sigue pendiente. No se modificó configuración ni se
inventó otra identidad. **Cero commits nuevos**, cero push, cero tags creados,
movidos o publicados; no se reescribió historial ni se añadió coautoría.
Los cambios ajenos del checkout principal se conservaron.

HEAD y origin/main: **749b171b1c57a6215810dca5da376b0f288bd732**.
El índice anterior referenciaba **ee37a64408b05fd910b51e350e45c6c2bfc38f6b**,
padre inmediato del commit exclusivo de evidencias 749b171; era una relación
válida en el main inspeccionado. Los nuevos logs identifican HEAD 749b171 más
los hashes de tres documentos sin commit. **No existe todavía SHA técnico
nuevo versionado ni SHA final candidato de esta preparación**. No usar esos
logs como certificación de otro commit ni sólo reemplazar el campo commitSha.

Una vez autorizada identidad: commit técnico sólo de documentos, repetir checks
en ese SHA exacto, regenerar índices y commit exclusivo de reports/evidence;
publicar rama sin force y abrir el PR con el título pedido. PR-body.md contiene
la descripción concreta a actualizar con los SHAs reales. No fusionar ni usar
un cierre automático de #52. Después del merge, verificar main real y, si hace
falta, preparar un segundo PR sólo de evidencias con nuevas ejecuciones de su
base. Su merge debe conservar el SHA reportado como HEAD/padre inmediato y un
diff exclusivamente de reports/evidence.

## Pasos manuales finales y riesgos pendientes

1. Revisar/aprobar el último PR y corroborar explicaciones/IA de los tres miembros.
   Osbaldo necesita logs originales o una nueva reproducción humana identificada;
   Julián debe revisar/explicar su aporte documental y el estado actual.
2. En checkout limpio del main definitivo F, comprobar reportes HEAD/padre,
   árbol limpio y todos los checks. No presuponer el SHA del branch tras merge.
3. Sólo el owner, después de revisión/autorización y ausencia de tag existente:
   `git tag -a week-08-final HEAD -m "DMI week 08 final"`.
4. Comprobar tipo anotado y tag^{commit}=HEAD=F. Ejecutar
   `make evidence-week-08`; exigir status=pass y frozen_sha=pass. Conservar
   failure.json local sin otro commit. Si falla, conservar el fallo, no publicar
   y no mover refs sin autorización; cualquier corrección de archivos va por PR.
5. Cuando apruebe: `git push origin refs/tags/week-08-final`; verificar tag,
   commit F y workflow Week 08 Academic Feedback sobre el evento del tag.
6. Cada miembro entrega en Classroom repo, week-08-final, SHA F completo y aporte
   propio comprobable. Quiz 8 individual separado; no publicar respuestas.

No se ejecutó integración Android nativa nueva; los logs nativos históricos
siguen ligados a su SHA. Export Expo no es APK ni prueba de instalación.
Revisión humana, tag/gate final y Classroom siguen pendientes. La issue #52
permanece abierta y esta preparación no acredita su cierre.
