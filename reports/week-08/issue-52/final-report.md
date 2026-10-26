# Informe de preparación #52 — 26-10-2026

**Entrega incompleta; no lista para etiquetar.** Preparación técnica para PR
y revisión del owner. La identidad Git fue autorizada expresamente en este chat.
El commit técnico es 8ed7bae94b91229f4399b3a85c13bf01054751e9; el siguiente
commit de entrega sólo contiene reports/ y evidence/. No fusionar ni etiquetar
automáticamente. La URL y el SHA del PR se consultan en GitHub.

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
| AC-01 | Instalación/checks aprobados sobre el commit técnico con fuente limpia; repetir/comprobar el SHA definitivo después del merge. |
| AC-02 | Persistencia, motor, integración y público aprobados. SQL Node real y backend loopback; no certificación Android del flujo integrado. |
| AC-03 | Rollback, integridad y replay aprobados en suites. Gate de congelación pendiente: tag ausente; no se ejecutó make evidence-week-08 localmente antes del tag. |
| AC-04 | Decisión, alternativas, tradeoff y verificaciones estructuralmente válidos; revisión humana pendiente. |
| AC-05 | Tres registros válidos y 20 commits fuente con autoría coherente/alcanzable. Comprensión, explicación y corroboración humanas pendientes. |

## Los cinco archivos oficiales

| Archivo | Revisión/cambio |
|---|---|
| docs/data-model.md | Esquema v2, transacciones, fotos y recuperación contrastados con adaptador y suites; se corrige una referencia a presentación de errores como trabajo futuro. |
| docs/sync-policy.md | Merge JSON, work indivisible, identidad/recibos y resolución contrastados con código y suites; se actualiza la descripción del agregado y #43–#45 ya integrados. |
| reports/week-08/migration-tests.json | Actualizado con 20 comandos reales del SHA técnico y escenarios de reinicio, migración/rollback, conflicto/merge/dedupe y replay; fuente/documentos sin cambios locales durante la ejecución. |
| evidence/week-08/engineering.json | Decisión/alternativas preservadas; verificaciones vinculadas a la ejecución nueva del SHA técnico, con límites humanos y de congelación explícitos. |
| evidence/week-08/individual.json | Sin cambios. Exactamente Draggodeidad, osbaldoXxC y JulianDele; se conserva procedencia, asistencia de IA y pendientes humanos. |

Las copias previous-* conservan los índices anteriores sin reescribir sus
resultados. dependencies.json refleja #42–#46 cerradas, #47–#51 abiertas al
consultar; sus estados administrativos no acreditan revisión humana.
No hubo cambios de implementación ni arquitectura: ADR y Mermaid se conservan.
La nueva guía docs/week-08-delivery.md desarrolla el procedimiento manual completo.

## Validaciones observadas

Node v22.22.0, npm 10.9.4, NODE_OPTIONS=--experimental-sqlite, npm ci y lockfile
intacto. validation.json incluye ruta, fechas, duración, entorno, HEAD,
estado limpio de fuente/documentos, comando y exit de cada ejecución.
La reproducción precommit anterior permanece en precommit/ con sus hashes;
no se presenta como validación del SHA técnico.
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

contract-checks.json aplica las funciones originales del evaluador a los
tres JSON oficiales y comprueba sus estructuras; no sustituye congelación ni
corroboración humana. El público valida los índices consolidados en ese SHA.
El audit permitido por el proyecto pasó su umbral critical; informó **8 high**.
No se afirma ausencia de vulnerabilidades ni se cambiaron versiones/umbrales.

## Git, autoría y SHA

Rama: fix/w08-final-evidence-issue-52, en checkout aislado
/home/dragodeidad/.codex/worktrees/w08-issue-52/campusops-dmi-team.
La cuenta conectada por plugin y gh es Draggodeidad. La identidad efectiva,
comprobada antes de cada commit y autorizada expresamente por el owner, es
Draggodeidad <antonioimanol7@gmail.com>. Se inspeccionan autor y committer de
todos los commits de esta tarea; ninguno debe ser Codex ni añadir coautoría automática. La
asistencia material de IA queda declarada y no se atribuyen nuevas ejecuciones
personales a estudiantes. Se conservan historial, tags y trabajo local ajeno.

Base origin/main inspeccionada: **749b171b1c57a6215810dca5da376b0f288bd732**.
SHA técnico realmente evaluado: **8ed7bae94b91229f4399b3a85c13bf01054751e9**.
Los reportes y engineering registran ese SHA. El commit posterior exclusivo de
reports/evidence lo conserva como padre directo; su propio SHA se obtiene de
Git, evitando una autorreferencia imposible en los archivos comprometidos.
Todavía no existe SHA definitivo de main tras revisión y merge de este PR.

El índice anterior referenciaba ee37a64408b05fd910b51e350e45c6c2bfc38f6b,
padre inmediato de 749b171, una relación válida en el main inspeccionado.
Las copias previous-* conservan esos resultados históricos. Los logs actuales
son ejecuciones nuevas sobre 8ed7bae en este checkout, sin documentos ni código
sin commit; sólo se modifican reportes/evidencias para registrar resultados.

Publicar la rama sin force y abrir el PR con el título pedido; no fusionarlo ni
cerrar #52 automáticamente. Después del merge, comprobar el SHA real de main:
si el reportado ya no es HEAD/padre inmediato permitido, repetir checks en ese
main y abrir otro PR exclusivo de evidencias. El merge debe conservar el SHA
reportado como HEAD/padre y un diff exclusivamente de reports/evidence. No
cambiar cifras sin ejecutar ni alterar el validador para aceptar otra relación.

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

El check adicional git diff --cached --check detectó espacios finales de la
salida de Jest (exit 2). Se conservan los bytes originales en .log.gz y sus
hashes en log-formatting.json; las copias legibles sólo quitan espacios/tab
al final de línea. No se cambia ninguna aserción, resultado ni control.
La comprobación de formato se repite tras preparar estas copias.

El evaluador original limita la salida de git a 3000 caracteres. La primera
lista de rutas del commit de evidencias tenía 3330 bytes y se truncó una ruta,
rechazando la relación de SHAs aunque todas las rutas eran reports/evidence.
sha-path-diagnosis.json conserva el fallo. before-final-capture.tar.gz y su
manifest preservan byte por byte las capturas iniciales; el directorio precommit
se encuentra dentro de ese archivo, además de permanecer en el historial Git.
Se repite la validación sobre el commit que archiva esos registros y se genera
un último commit exclusivo de evidencia con una lista de rutas menor.
No se modifica ni debilita el evaluador, el workflow o la regla HEAD/padre.
