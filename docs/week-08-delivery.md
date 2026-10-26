# W08 — preparación de entrega y congelación (#52)

Fecha límite: **26-10-2026, 23:59 America/Mexico_City**.
Estado anterior al tag: **pending_final_tag**. La issue #52 permanece incompleta
hasta revisión humana, evidencia válida del SHA definitivo, tag y entrega.
Los resultados de esta reproducción se indexan en
`reports/week-08/issue-52/validation.json`; los históricos conservan sus SHAs.

## Diagnóstico de AC-03

En la inspección del 26-10-2026, después de `git fetch origin --tags`,
`git tag -l week-08-final` y `git ls-remote --tags origin week-08-final` no
devolvieron referencia. HEAD y origin/main eran
`749b171b1c57a6215810dca5da376b0f288bd732`.

El [run 40385165581](https://github.com/Draggodeidad/campusops-dmi-team/actions/runs/40385165581)
en ese SHA pasó instalación, export Android, W06, arquitectura, W08, AC-01 y
AC-02. AC-03 terminó en error: los tres JSON oficiales aprobaron su esquema y
relación de SHAs, pero `frozen_sha` falló con `unknown revision` para
`week-08-final`. Make devolvió 2 (evaluador 1). El workflow usa fetch-depth 0
y fetch-tags true. La causa observada es ausencia del tag, no descarga parcial,
tag apuntando a otro SHA ni defecto demostrado del evaluador.

Se mantienen intactos Makefile, evaluador, contrato académico y workflow.
`pending_final_tag` describe la preparación, no sustituye `fail` en la salida
oficial ni implica que AC-03 apruebe. No ejecutar `make evidence-week-08`
para acreditar entrega antes de crear el tag autorizado.

## Cinco criterios y archivos

| Criterio | Evidencia y límite |
|---|---|
| AC-01 | `make setup`, tipos/lint, feedback y verify; reproducir sobre el SHA definitivo después del merge. |
| AC-02 | Persistencia, sync, integración y público; SQLite real sobre disco y backend loopback. No equivalen a instalación Android del flujo integrado. |
| AC-03 | Rollback de esquema/filas/cola, reinicio y replay sin duplicación probados por las suites. Gate final pendiente del tag exacto y de evidence-week-08. |
| AC-04 | `engineering.json`: decisión, alternativas, costo/beneficio y verificaciones observadas. Corroboración humana pendiente. |
| AC-05 | Exactamente Draggodeidad, osbaldoXxC y JulianDele en `individual.json`; autoría Git comprobable y asistencia IA declarada. No acredita comprensión ni ejecución personal por pasar el esquema. |

Los cinco entregables son `docs/data-model.md`, `docs/sync-policy.md`,
`reports/week-08/migration-tests.json`, `evidence/week-08/engineering.json` y
`evidence/week-08/individual.json`. Los dos documentos deben describir la
implementación integrada; los dos JSON con commitSha deben identificar la
ejecución actual y el registro individual conserva sus fuentes personales.

#42–#46 estaban cerradas y #47–#51 abiertas al consultar GitHub. Los PR #54–#57
ya estaban integrados; el estado administrativo no demuestra corroboración.
Osbaldo tiene commits propios de las dos suites; sus tiempos locales originales
siguen sin logs corroborables. Julián aporta revisión documental del baseline,
no ejecución de pruebas ni certificación del estado integrado. Su explicación
previa al commit se conserva como fuente histórica con su contexto explícito.
Las reproducciones de Codex se identifican como asistencia técnica de IA y no
se añaden como trabajo personal de ninguno de los tres.

## Integración por PR y cadena de SHAs

1. Integrar mediante PR los cambios técnicos/documentales, tras revisión del
   owner. No fusionar automáticamente ni hacer commits/push directos a main.
2. Después del merge, obtener el SHA real **M** de origin/main y ejecutar los
   checks completos sobre un checkout limpio de M. No reutilizar el SHA de la
   rama: un merge/squash/rebase puede cambiarlo.
3. Si los reportes no corresponden a HEAD o su padre inmediato permitido,
   abrir otra rama desde M y un **PR exclusivo de reports/ y evidence/**.
   Registrar M en migration-tests.json y engineering.json con logs nuevos de M;
   conservar los resultados previos como históricos. Hacer un commit E sólo
   de esas carpetas y verificar los contratos y el público sobre E.
4. Si ese PR se integra por merge normal F con primer padre M y su diff desde
   M sólo modifica reports/evidence, el contrato acepta commitSha=M. También
   admite un commit de evidencias directo/squash cuyo padre sea M. Si main
   avanzó desde M o se añadió código/documentación, repetir sobre el nuevo
   SHA: no editar cifras sin ejecutar ni ampliar la regla del evaluador.

Antes de cada commit: ejecutar los cuatro comandos de identidad pedidos por el
owner y verificar nombre/correo autorizados; después inspeccionar autor y
committer del commit. No reescribir los commits históricos de Codex ni añadir
coautoría automática. El nombre del autor Git no acredita por sí solo trabajo
personal sin asistencia.

## Congelación manual por el owner

Usar un checkout limpio del main definitivo **F**, con Node 22.22.0, npm del
proyecto y `NODE_OPTIONS=--experimental-sqlite`. No reutilizar el checkout
principal con cambios locales ajenos. Comprobar en GitHub el último PR y su SHA.

```bash
git fetch origin --tags
git status --short
git rev-parse HEAD
git rev-parse origin/main
git show -s --format='%H %P %an <%ae> / %cn <%ce>' HEAD
git diff --name-only HEAD^ HEAD
git tag -l week-08-final
git ls-remote --tags origin week-08-final
```

Detenerse si el árbol no está limpio, HEAD no es origin/main, hay referencias
del tag preexistentes, falta revisión humana o los commitSha no cumplen la
regla HEAD/padre exclusivo de evidencias. Revisar los JSON con el evaluador
original, sin modificarlo; `make public-test-week-08` valida sus esquemas y SHA.
Repetir setup, W06/readiness, arquitectura, W08, feedback, verify y público en F
y conservar sus salidas. Si se necesitan nuevos cambios, volver al flujo PR.

Sólo después de la aprobación/autorización del owner:

```bash
git tag -a week-08-final HEAD -m "DMI week 08 final"
git cat-file -t refs/tags/week-08-final
git rev-parse 'week-08-final^{commit}'
git rev-parse HEAD
make evidence-week-08
```

El tipo debe ser `tag`; los dos SHA deben ser F. El evaluador exige tag=HEAD,
JSON válidos y relación de SHAs. Revisar en `reports/week-08/failure.json`
`status=pass` y `frozen_sha=pass`. Ese reporte posterior al tag queda **local**:
no añadir otro commit. No publicar si falla; conservar salida y diagnosticar.
Una corrección de archivos requiere PR y una nueva congelación autorizada;
no mover/borrar una referencia existente por cuenta propia.

Cuando la comprobación anterior apruebe:

```bash
git push origin refs/tags/week-08-final
git ls-remote --tags origin 'week-08-final*'
git rev-list -n 1 week-08-final
```

main ya se publicó al fusionar los PR; no hacer `git push origin HEAD` sobre
main. Verificar en GitHub la referencia anotada y su commit F, y el workflow
**Week 08 Academic Feedback** disparado por ese tag. Comprobar también que se
evaluó F y que todos los gates, incluido AC-03, aprobaron. Un run anterior sin
tag puede seguir rojo; no presentarlo como aprobado ni omitirlo.

## Classroom y revisión pendiente

Cada miembro entrega el mismo repositorio, etiqueta y SHA completo F, con su
aportación real y prueba/revisión. El equipo registrado es 9B-E02 según el
registro existente. Cada integrante debe confirmarlo y explicar su aporte.

```text
Equipo: 9B-E02
Repositorio: https://github.com/Draggodeidad/campusops-dmi-team
Etiqueta: week-08-final
SHA completo: copiar git rev-list -n 1 week-08-final (40 caracteres)
Mi aportación: descripción personal comprobable y ruta de prueba/revisión
```

Pendientes: revisión del owner de los PR; explicación/corroboración de los tres
integrantes y declaración de IA; logs personales de Osbaldo o nueva ejecución
humana identificada como tal; revisión actual de Julián; comprobación nativa
del flujo integrado si se pretende acreditarla; tag, gate final y Classroom.
El export Expo no es un APK. El quiz 8 es individual y separado; no registrar
sus respuestas en el repositorio. No declarar #52 cerrada ni entrega completa
mientras subsista un requisito obligatorio.
