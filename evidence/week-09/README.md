# W09 — registro individual en preparación (#63)

`individual.json` usa la ruta y los campos oficiales de W09. Contiene únicamente
el registro de Draggodeidad. Los dos registros ajenos siguen pendientes de #66 y
#68: no se copian sus matrículas, commits, pruebas, revisiones o explicaciones.
Los identificadores del owner se reutilizan de las evidencias oficiales previas
del repositorio; su procedencia y consistencia están documentadas en identitySource.
No se afirma haber consultado un roster externo nuevo.

La aprobación humana de #61 y #62 ya fue expresada por el owner en el chat.
`humanValidation` conserva la declaración, alcance, heads de PR y fecha de
registro. No inventa una revisión adicional en GitHub, aprobación de este texto
nuevo ni ejecución manual de las pruebas por la persona. Los pendientes de
revisión en los reportes de implementación describen su snapshot histórico;
esta declaración posterior registra el visto bueno recibido.

Los resultados de #60/#61/#62 se vinculan a sus SHA técnicos, commits exclusivos
de evidencia, índices y logs publicados. Los 11 commits referenciados son propios.
El registro conserva tanto pruebas aprobadas como fallos públicos históricos de
las ramas separadas; no declara una validación conjunta de ubicación/retry.
El uso material de IA y la ejecución automatizada están declarados explícitamente.

## Pendiente de los compañeros y de la consolidación

Cada compañero agrega únicamente su miembro real al array `members`, con los
campos exigidos en docs/EVIDENCE_CONTRACT.md, conservando el registro del owner.
No se agregan miembros vacíos o contribuciones de otras semanas. La identidad de
roster se escribe sólo en el archivo autorizado, no en comentarios de PR/issue.
Tras incorporar cada aportación real, se actualiza su entrada de pendingContributors;
la consolidación #69 comprobará exactamente tres miembros distintos y completos.

Mientras exista un solo miembro, **el esquema oficial del equipo no pasa**.
`status: pending_team_evidence` y dos pendientes expresan el estado solicitado;
no sustituyen ni relajan la regla de tres integrantes. #69 conserva además los
reportes compartidos, la decisión global y la validación final pendientes.
No se modifica ningún workflow o evaluador para aceptar un archivo parcial.

## Comprobaciones reproducibles

```sh
# Comprueba identidad histórica, autoría Git, archivos y resultados ya publicados.
python3 reports/week-09/owner/verify-record.py --scope owner
# Delega al validador oficial intacto; falla mientras falten dos miembros.
python3 reports/week-09/owner/verify-record.py --scope team
```

Es necesario disponer de los objetos Git de los PR #70/#71/#72 (`git fetch origin`
si faltan). Las referencias históricas incluyen URLs con SHA para consultar sus
logs aunque esos archivos no estén en esta rama de evidencia basada en main.
La auditoría sólo verifica referencias: no presenta suites anteriores como
repetidas ahora. Resultados y códigos reales: reports/week-09/owner/validation.json.

No se ejecuta evidence-week-09, crea tag, hace merge ni entrega Classroom desde #63.
