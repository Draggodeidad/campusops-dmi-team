# W08 — registro individual del owner

`evidence/week-08/individual.draggodeidad.json` conserva el sobre
schemaVersion=1/week=8/teamId/members y todos los campos del miembro exigidos
por docs/EVIDENCE_CONTRACT.md. Es un **auxiliar con un miembro**, pendiente de
revisión humana y consolidación #52. El obligatorio individual.json requiere
exactamente tres miembros reales; no se crea un consolidado incompleto ni se
rellena con aportaciones de semanas anteriores.

Los identificadores se reutilizan únicamente desde la evidencia consolidada
previa de la misma identidad/equipo; el archivo registra su procedencia. No se
repiten aquí identificadores ni se añaden a la issue. Los 17 commits W08, las
rutas técnicas y las observaciones se comprueban contra Git y logs existentes.
Se separan baseline, persistencia, sync e integración por SHA. Las aserciones
nativas de #43 no se presentan como una prueba nativa de #45.

No se vuelven a ejecutar suites para generar aportes: se citan las ejecuciones
publicadas con su comando, resultado y fuente. prediction describe la próxima
reproducción humana, no una predicción retrospectiva atribuida al estudiante.
reviews queda vacío; explanation es un borrador técnico asistido. La IA y la
validación humana pendiente constan expresamente en el miembro.

La auditoría local de campos/procedencia no es un nuevo validador oficial.
El evaluador existente rechaza este auxiliar como consolidado porque contiene
un solo miembro; no se cambia su cardinalidad ni se simulan otros registros.
La validación oficial final sigue siendo make public-test-week-08. Comando,
salida y estado observado de esta ejecución están en validation.json y
public-w08.log. Su fallo por artefactos de #52 debe seguir visible.

Para consolidar: agregar exactamente este objeto members[0] a individual.json
junto con los otros dos miembros W08 reales, mantener teamId y no transformar
humanValidation en aprobado sin una revisión efectiva. Los índices históricos
mantienen sus SHA y estados originales. No se crea tag ni entrega Classroom.
