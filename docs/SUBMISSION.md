# Entrega semanal reproducible

1. Trabaja en la rama principal registrada para el equipo.
2. Ejecuta `make feedback` y los tres comandos de la actividad semanal.
3. Confirma que los reportes referencien `HEAD` o su padre inmediato cuando el último commit contiene únicamente evidencia.
4. Integra los cambios antes de congelar la entrega; no entregues una rama local sin publicar.
5. Crea el tag anotado y publícalo:

```bash
git status --short
git tag -a week-01-final -m "DMI week 01 final"
git push origin HEAD
git push origin week-01-final
git rev-list -n 1 week-01-final
```

6. Entrega en el LMS la URL pública del repositorio, el nombre del tag y el SHA completo que muestra el último comando.

El evaluador fija ese ref a un SHA y trabaja sobre una copia temporal. Cambios posteriores no alteran la entrega congelada. GitHub Actions es retroalimentación visible, no la autoridad exclusiva de calificación.

No incluyas credenciales, tokens, keystores, datos personales reales, respuestas de quizzes ni material del evaluador docente.

## Retroalimentación continua después de merges

Week 01 y Week 02 conservan sus workflows activos. En ramas y PRs se comprueba
el commit del evento (incluido el merge de prueba de GitHub), con historial
completo. Antes del evaluador público, `tools/revalidate-prior-evidence.py`
ejecuta de nuevo los controles acumulados y registra observaciones sobre ese SHA.
Sólo después de aprobar todos los comandos actualiza los índices en el checkout
desechable del runner. No crea commits ni cambia archivos históricos en Git.

Los artefactos incluyen `generated-revalidation/original-*.json`, logs completos,
códigos de salida y observaciones. Las observaciones históricas conservan su
`evaluatedCommitSha`; las nuevas indican el SHA actual. La evidencia individual
no se modifica. Los JSON originales deben ser válidos y su SHA debe ser un
ancestro verificable; no basta con reemplazar `commitSha`.

Sobre el tag exacto de cada semana no se revalida ni modifica evidencia: se
aplican `make public-test-week-XX` y `make evidence-week-XX` directamente. El
evaluador oficial conserva la regla HEAD/padre exclusivo de evidencias.
La retroalimentación continua no repara ni reemplaza una entrega congelada.

Para reproducir esta ruta desde un checkout limpio con dependencias instaladas:

```bash
python3 tools/revalidate-prior-evidence.py --week 1
make verify-week-01
make public-test-week-01
python3 tools/revalidate-prior-evidence.py --week 2
make verify-week-02
make public-test-week-02
```

Ejecutar una vez por checkout desechable y conservar los artefactos. Para probar
la propia revalidación: `python3 -m unittest discover -s tools/tests -v`.

## Seguimiento acumulativo W05 y congelación W06

W05 también admite revalidación reproducible de `contract-tests.json`,
`failure-matrix.json` y engineering en el checkout desechable de CI. Usa
`python3 tools/revalidate-prior-evidence.py --week 5`: verifica primero esquema
e historia originales, conserva copias/observaciones y sólo actualiza índices
si todas las regresiones ejecutadas aprueban. La evidencia individual no se
reescribe. La prueba congelada sigue evaluándose en su tag original mediante
`python3 tools/verify-frozen-evidence.py --week 5`; ese comando exige tag
anotado y usa una copia temporal, sin mover refs ni modificar evidencia Git.
Sobre el tag exacto W05 se mantiene el evaluador oficial directo.

W06 conserva todos sus gates, añade readiness y comprueba el SHA del HEAD del
PR con historial/tags completos. El tag anotado `week-06-final` se crea sólo
tras checks locales y aportes completos; `make evidence-week-06` lo comprueba
antes de publicarlo. Su reporte posterior permanece local, sin otro commit
que altere la entrega congelada. El SHA final se toma de la referencia real,
no de una cifra escrita previamente en documentación.

## W06 después de integrar en main

Después de congelar `week-06-final`, main puede avanzar conservando ese tag.
La retroalimentación continua W06 usa la misma separación de W05:
`python3 tools/revalidate-prior-evidence.py --week 6` repite los controles reales
y conserva procedencia en el checkout desechable; el evaluador público
comprueba ese SHA actual; `python3 tools/verify-frozen-evidence.py --week 6`
comprueba la entrega original en una copia del tag. Sobre el evento del tag
exacto se ejecutan los evaluadores directos sin revalidación. El script rechaza
cualquier intento de revalidar el tag final. No se cambian etiquetas históricas
ni se omiten gates para hacer pasar main.

El caso de recuperación del merge prematuro de #40 se documenta en
`docs/week-06-main-recovery.md`. Integrar correcciones después no modifica el
SHA que ya fue enviado en Classroom.


## Retroalimentación W08 después del cierre semanal

W08 conserva sus JSON y tag históricos al avanzar a W09. En ramas/PR,
`python3 tools/revalidate-prior-evidence.py --week 8` comprueba primero el
esquema original y la ascendencia del SHA, guarda copias exactas y ejecuta
feedback, las 107 regresiones W08 y las invariantes de sesión. Sólo si todos
los comandos aprueban actualiza índices del checkout desechable, conservando
las observaciones anteriores con su evaluatedCommitSha. Individual no se modifica.

Después se ejecuta el evaluador público sobre ese SHA y se verifica la entrega
congelada en una copia aislada de week-08-final mediante
`python3 tools/verify-frozen-evidence.py --week 8`. Sobre el evento del tag
exacto se mantienen los comandos oficiales directos y se prohíbe revalidar.
No se mueve el tag, relajan reglas de SHA ni convierten fallos históricos en éxitos.
`python3 -m unittest discover -s tools/tests -v` también cubre W08: copias,
proveniencia, control fallido sin relabel y rechazo en el tag final.
