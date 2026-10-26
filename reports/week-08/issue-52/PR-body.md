AC-03 falla porque `week-08-final` está ausente localmente y en origin después
de fetch. El run [40385165581](https://github.com/Draggodeidad/campusops-dmi-team/actions/runs/40385165581)
validó los JSON, AC-01 y AC-02, pero `frozen_sha` falló; Make devolvió 2.
Se mantiene `pending_final_tag` sin alterar workflow, evaluador, Makefile,
contrato académico ni pruebas.

Se corrige documentación que aún presentaba #43–#45 como trabajo futuro y se
añade el procedimiento manual de congelación. Los índices oficiales enlazan
nuevas ejecuciones sobre el commit técnico `8ed7bae94b91229f4399b3a85c13bf01054751e9`,
con fuente/documentos sin cambios locales. El commit posterior sólo contiene
reports/evidence y conserva ese SHA como padre directo. Los resultados
precommit y los índices anteriores se archivan con su procedencia.

Node 22.22.0, npm 10.9.4 y NODE_OPTIONS=--experimental-sqlite. Pasan make setup,
typecheck, lint, smoke 1/1, incidents 3/3, arquitectura 2/2 y checker, W06 31/31,
readiness 8/8, persistencia 30/30, sync 47/47, integración 24/24, agregado W08
3+30+47+24+3, make feedback (87/87 y export Android), verify-week-08 y público
(90/90 tras regenerar índices). También pasan contrato individual, auditoría de
procedencia y preservación de archivos protegidos. Logs/entorno/SHA/exits en
reports/week-08/issue-52/validation.json; todos los comandos terminan en exit 0.

individual.json no cambia: exactamente Draggodeidad, osbaldoXxC y JulianDele.
Se auditan 20 commits originales; se preservan la autoría y los pendientes
humanos. Las ejecuciones nuevas son asistencia técnica de Codex y no se
atribuyen como trabajo personal de estudiantes. Autor y committer de los
commits de esta tarea usan la identidad humana expresamente autorizada.

La revisión y el merge corresponden al owner. Después de integrar, comprobar
el SHA real de main: puede requerirse otro PR exclusivo de evidencias con
nuevas ejecuciones para conservar la regla HEAD/padre inmediato. No asumir
que el SHA de la rama sobrevivirá al merge ni etiquetar esta preparación.

Pendientes: corroboración y explicación de los tres integrantes; logs personales
de Osbaldo o nueva reproducción humana identificada; revisión actual de Julián;
tag autorizado, evidence-week-08 con frozen_sha=pass y Classroom. No se ejecutó
el gate final sin tag ni se crearon/movieron etiquetas. No se revalidó Android
nativo del flujo integrado: export Expo no es APK. Audit pasa el umbral critical
pero informa 8 high; no se cambian versiones ni umbrales para ocultarlos.

Relacionado con #52; **no cerrar automáticamente**. Entrega incompleta hasta
revisión humana y congelación real. Guía: docs/week-08-delivery.md e informe
reports/week-08/issue-52/final-report.md.
