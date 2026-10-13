# W06 — Recuperación de main después de la entrega

El usuario informó el 13/10/2026 que entregó en Classroom el enlace al commit
`5e79d9ffc38f7fa6a86403a3607f7b6ca3152425`. Ese SHA es el merge del PR #40 y
contiene como segundo padre `372064458bfed08f29e72fcc6319b48fabd8d9c5`;
no incorpora los dos commits finales de correcciones y evidencia.

Las correcciones sí se publicaron posteriormente en la rama original:

- `1730b6f0f5291db74c221d20f0eb0d11a949afc4`: código, regresiones y configuración.
- `4ae9afa32d14d5dcfc8aa9ec2ab0db0baa2df7a6`: commit exclusivo de reports/evidence.

El tag anotado `week-06-final` apunta a `4ae9afa32d14d5dcfc8aa9ec2ab0db0baa2df7a6`.
Se comprobó la referencia remota y que los seis workflows disparados en ese
tag aprobaron, incluido [W06](https://github.com/Draggodeidad/campusops-dmi-team/actions/runs/38354222255).
No es correcto afirmar que esas correcciones se perdieron o que el tag apunta
al merge anterior. El enlace entregado sí identifica una versión diferente.

## Recuperación de integración

La rama `codex/week-06-main-recovery` parte de `origin/main` y fusiona la
historia publicada de `week-06-final`, conservando el merge del usuario y los
commits originales. No usa reset, cherry-picks que sustituyan autoría ni force
push. El código productivo y las pruebas de la app coinciden con el tag validado.

Se amplía a W06 la revalidación continua ya utilizada para W01/W02/W05:
se comprueban los esquemas y la ancestralidad originales, se guardan copias,
se ejecutan feedback, las ocho invariantes, las seis suites W06 y backend;
sólo después de aprobar todo se añaden observaciones del SHA actual en el
checkout desechable del runner. La evidencia individual no se reescribe.

Sobre `refs/tags/week-06-final` se mantiene el evaluador directo, sin
revalidación. Para ramas/PR/main se valida además la evidencia congelada en
una copia temporal del tag original. De este modo se comprueban tanto la
integración actual como la entrega congelada, sin exigir que todo commit
futuro de main sea el SHA del tag ni mover una etiqueta para forzar el verde.
Los tests conservan W05 y añaden el rechazo de revalidación sobre el tag W06.

Validación de esta recuperación: `reports/week-06/main-recovery/`. Es evidencia
posterior a la entrega informada por el usuario, con su SHA y fecha reales.
No se presenta como trabajo que ya estaba dentro de `5e79d9f…` ni se cambian
los SHA o resultados históricos como atajo.

## Referencias para aclaración de entrega

- Referencia informada como entregada: https://github.com/Draggodeidad/campusops-dmi-team/commit/5e79d9ffc38f7fa6a86403a3607f7b6ca3152425
- Repositorio: https://github.com/Draggodeidad/campusops-dmi-team
- Tag corregido ya publicado: `week-06-final`.
- SHA corregido ya validado: `4ae9afa32d14d5dcfc8aa9ec2ab0db0baa2df7a6`.

Actualizar main no modifica el contenido del commit enviado. Si el docente
fija ese enlace para evaluar, la referencia corregida requiere su aclaración
o aceptación. Esta tarea no envía mensajes al docente ni modifica Classroom;
no inventa una extensión de plazo, calificación ni aceptación posterior.
