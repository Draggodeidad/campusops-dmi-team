# W08 — evidencia individual semanal

`evidence/week-08/individual.json` usa la estructura de las semanas anteriores:
`schemaVersion`, `week`, `teamId` y exactamente tres objetos en `members`.
Cada objeto conserva las mismas claves que W05: studentId, githubLogin,
commitShas, files, tests, reviews, prediction, command, observedResult,
explanation y aiAssistance.

El primer miembro contiene la aportación W08 del owner con sus commits,
archivos y resultados ya verificados. Los dos siguientes tienen cadenas
vacías y listas vacías, por solicitud expresa del usuario, para que sus
compañeros completen su propia evidencia. No contienen identidades, commits,
pruebas ni revisiones inventados y no se copian aportaciones anteriores.

El archivo es un borrador pendiente: los apartados vacíos impiden cumplir la
validación oficial. Cada compañero debe escribir sus identificadores
registrados, commits propios completos, archivos y pruebas/revisiones reales,
predicción, comando, resultado observado, explicación y asistencia de IA.
La revisión y explicación humana del owner también siguen pendientes.

`individual.draggodeidad.json` se conserva como fuente auxiliar de trazabilidad
por fase, SHA y log. Sólo se reutilizaron identificadores históricos; las
aportaciones corresponden a W08. Los resultados anteriores en validation.json,
provenance-inspection.log y public-w08.log son históricos y conservan su SHA.
La comprobación posterior de esta plantilla se registra por separado en
`consolidation-template/`; un resultado inválido se conserva como tal.

No se modifica el evaluador para aceptar apartados vacíos. La entrega global
sigue pendiente de completar miembros y artefactos de #52 y ejecutar los
controles de entrega. No se crea tag ni se realiza envío Classroom.
