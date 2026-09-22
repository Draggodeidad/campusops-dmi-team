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
