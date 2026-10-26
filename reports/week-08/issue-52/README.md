# Issue #52 — preparación técnica para revisión

Rama fix/w08-final-evidence-issue-52 desde origin/main
749b171b1c57a6215810dca5da376b0f288bd732. El owner autorizó expresamente
Draggodeidad <antonioimanol7@gmail.com> para autor y committer. No se cambia
configuración, se reescribe historial ni se añade coautoría automática.

Commit técnico evaluado: **8ed7bae94b91229f4399b3a85c13bf01054751e9**.
validation.json y cada log identifican ese HEAD, fuente/documentos sin cambios
locales, Node 22.22.0, npm 10.9.4, NODE_OPTIONS, checkout, tiempos y exits reales.
Sólo se registran cambios en reports/evidence. Los 20 comandos pasan, incluido
el público después de regenerar los índices observados. El commit posterior
sólo debe incluir reports/ y evidence/ y conservar el técnico como padre.

Estado: **incomplete**, **pending_final_tag**, **humanReview=pending**.
No se declara #52 terminada ni AC-03 aprobado. ci-ac03.log conserva el fail
original por tag ausente (Make exit 2, evaluador 1); diagnosis.json registra
nueva inspección de referencias y la autorización de identidad. Workflow,
Makefile, evaluador, tests y contrato académico permanecen intactos.

capture-validation.py es el script utilizado para los 20 comandos. Recibe
repositorio y directorio de salida. regenerate-observed.py verifica SHA actual,
fuente limpia, comandos requeridos y exits reales antes de actualizar los dos
índices canónicos. No actualiza evidencia individual ni crea referencias Git.
previous-* son copias históricas de los índices anteriores; precommit/ conserva
la ejecución anterior a autorizar la identidad y comprometer los documentos,
con hashes de cambios locales. Sus resultados no se reutilizan como actuales.

individual.json permanece idéntico. attribution.json registra su hash y verifica
20 commits originales de exactamente tres miembros; estructura y Git no
acreditan comprensión, revisión humana ni ejecución personal. Los logs nuevos
se identifican como reproducción técnica de Codex, no aportaciones personales.

final-report.md contiene criterios, cinco entregables, comandos/resultados,
SHAs, límites, revisión pendiente y pasos manuales. PR-body.md prepara la
descripción del PR. docs/week-08-delivery.md explica el posible segundo PR
exclusivo de evidencias tras el merge, tag autorizado, verificación congelada,
publicación y Classroom. No fusionar el PR ni crear tags automáticamente.

No hay nueva prueba nativa Android del flujo integrado. SQL real en disco,
UI/grafo y backend loopback no equivalen a APK instalado. Los históricos nativos
conservan su SHA. Pendientes: revisión del owner, corroboración/explicación e IA
de los tres miembros, logs personales de Osbaldo o nueva reproducción humana,
tag final válido y Classroom. El audit respeta critical y reporta 8 high.

El check adicional git diff --cached --check detectó espacios finales de la
salida de Jest (exit 2). Se conservan los bytes originales en .log.gz y sus
hashes en log-formatting.json; las copias legibles sólo quitan espacios/tab
al final de línea. No se cambia ninguna aserción, resultado ni control.
La comprobación de formato se repite tras preparar estas copias.
