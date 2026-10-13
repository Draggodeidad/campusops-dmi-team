# Resultados reales del baseline #36

`before.json` y logs before evalúan main 791e222a6c057acf3ca534d233bcf79771c554c9; `after.json` y logs after evalúan el commit técnico c74e479. La versión completa está en after.json. Ambos usaron Node 22.22.0. El ZIP se extrajo en un directorio temporal fuera del repositorio; zip-inventory.json registra hash y comparación anterior. No se incluyen secretos reales ni evidencias de compañeros.

Antes: tipos/lint, 13 suites acumuladas (56 tests), arquitectura y backend aprobaron. W06 pública falló en sus dos pruebas por coordinateRefresh pendiente.

Después: make setup, tipos/lint, smoke, incidencias, arquitectura, backend, 13 suites/56 tests anteriores, selección de W06, escaneo y export Android aprobaron. test:week-06 falla en 2/2 pruebas por coordinateRefresh pendiente (#37). make feedback termina con código 2 al fallar W06; no alcanza scan/audit/export: se ejecutaron separadamente y están indexados.

`npm run audit:ci` falla con código 1: 33 vulnerabilidades (5 moderate, 27 high, 1 critical). La crítica es shell-quote 1.10.0, presente en el lockfile anterior sin modificaciones; advisory GHSA-pqg4-j6r4-53mv. Pendiente de remediación antes de entregar por el responsable de integración #39; requiere un cambio separado y validación de dependencias, sin bajar umbral ni alterar stack. No es un fallo causado por el ZIP o por sesión.

make verify-week-06 devuelve 2 por audit (las demás comprobaciones pasan). make public-test-week-06 devuelve 2 por audit, coordinateRefresh y ausencia de cinco entregables finales de #37/#38/#39. Los diagnósticos completos son ../verify.json y ../public-tests.json. El workflow oficial también espera tag/evidencias: no se omite esa etapa para hacer verde esta rama.

No se ejecutó evidence-week-06 ni se creó tag final. No se declara W06 completa. Este commit de reportes sólo añade reports/, por lo que los diagnósticos se refieren a su padre técnico inmediato. El baseline documenta asistencia de Codex y resultados observados, no aportaciones individuales o una nota académica.
