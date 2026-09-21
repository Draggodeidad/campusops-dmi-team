# Integración de Week 03 — Issue #19

La integración conserva los commits y autores de #16, #17 y #18. No incorpora
funcionalidades posteriores ni cambia la arquitectura de la aplicación.

## Revisión de aportaciones

- #16: PR #20, commits `5775d080c7dea79c2df50fe7008abca25b8befcd` y
  `506b83d2c7165d77ba0a6a79fb58265e02084556`, Draggodeidad. Pipeline, escáner,
  pruebas de CI y baseline oficial. La integración de #19 es trabajo adicional.
- #17: PR #21, osbaldoXxC, integrado en la rama de #20. La fixture del commit
  `815f153575756b0b73d841f6aab44d7540944b31` activa `public_secret_name`;
  `b038cfbc0a6c5e65e42e3253561c80aa840d2ccb` la retira sin cambiar el detector.
  El run fallido `35477270399` confirma el diagnóstico y salida 2 de Make.
  El run verde citado originalmente (`35477226598`) evalúa `dfd3d892…` y
  ocurrió antes del run fallido. Se conserva como antecedente; para el orden
  temporal fallo → éxito se utiliza el run posterior `35477319355` del commit
  `c06e18d5939a19dc6f5caf049cce5f4811f7df82`.
- #18: JulianDele incorporó directamente
  `4b5cb401d1a37d7723435d3fe313a866c2d9ca7e` en la rama de #20. El modelo
  describe activos, fronteras, prioridades, controles actuales y futuros y
  riesgo residual. No aparece un PR independiente de este integrante.

## Correcciones de integración

Los runs `35667050514` y `35667050414` muestran fallos exclusivamente en el
vínculo SHA de los JSON de Weeks 01 y 02. Se añade revalidación observable de
regresión, descrita en `docs/SUBMISSION.md`, sin modificar el evaluador oficial,
los tags previos ni las evidencias históricas versionadas. Los workflows
comprueban también el merge provisional de cada PR y conservan su diagnóstico.

Se normalizan `alternatives` y `tradeoff` de Week 03 al formato oficial y se
corrige la atribución del registro de JulianDele: su identificación procede de
Week 02 y su SHA corresponde a su propio commit, no a los commits de osbaldoXxC.
Las evidencias consolidadas distinguen declaraciones previas de los autores y
observaciones de integración. La asistencia de IA no sustituye una defensa ni
una validación personal no realizada.

## Condiciones pendientes antes del tag

El ruleset de `main` exige una aprobación de PR y permite merge commits. El PR
#20 no tenía aprobaciones al revisar la integración. No se omite esa regla.
La issue #18 también exige un PR propio y explicación de priorización del
integrante; su aporte directo es verificable, pero no acredita ese PR ausente.

Después de satisfacer las revisiones y fusionar el PR aprobado:

1. Crear un checkout limpio del SHA integrado y ejecutar `npm ci`, `make feedback`,
   `make verify-week-03` y `make public-test-week-03` con Node 22.22.0.
2. Registrar observaciones reales y SHA integrado en security/engineering;
   crear un commit que sólo cambie `reports/` y `evidence/`. Si el merge cambió
   el SHA, no reutilizar un reporte de la rama como si comprobara ese merge.
3. Confirmar todos los checks del commit y descargar el artefacto de Week 03.
4. Crear `week-03-final` sobre ese commit de evidencias y ejecutar
   `make evidence-week-03`; publicar el tag sólo si pasa.
5. Revisar el run del tag y su artefacto; entregar URL, tag y SHA completo.

Repositorio: https://github.com/Draggodeidad/campusops-dmi-team

Mientras estas condiciones no se cumplan, #19 permanece abierta y la entrega
no se declara lista ni se crea el tag.
