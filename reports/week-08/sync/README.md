# Validación observada del motor W08 #44

SHA técnico comprobado: `654b0fb731acfcf7a77efb534c45c2e11b506b19`.
Commits técnicos: `2028d6d` (motor/tests) y `654b0fb` (composición/política/CI).
Node 22.22.0 y npm 10.9.4. Comandos, códigos, fechas y logs completos en
`validation.json`; este commit final sólo modifica reports/evidence.

Resultados observados:

- Setup, tipos, lint, smoke, incidencias y ambos controles de arquitectura: exit 0.
- W06: 6 suites/31 tests; readiness: ocho regresiones pasan.
- Motor: 22 tests; composición real: 2 tests; público W08 intacto: 3 tests.
  El agregado W08 pasa también baseline (3 tests) y probe del proveedor.
- `make feedback`: exit 0, 19 suites/87 tests y export Expo Android completados.
- `make verify-week-08`: exit 0.
- `make public-test-week-08`: exit 2. El toolchain y 20 suites/90 tests pasan;
  faltan `docs/data-model.md`, `reports/week-08/migration-tests.json`,
  `evidence/week-08/engineering.json` y `evidence/week-08/individual.json`.
  Se conserva fail; no se fabrican artefactos ajenos para pintar el gate de verde.
- La auditoría critical pasa; los avisos existentes de dependencias high/moderate
  y React act permanecen visibles. No se cambian versiones, se omiten checks ni
  se suprimen avisos. El export Expo no equivale a APK/dispositivo nativo.
- El control de conservación confirma intactos los tests públicos, código W06,
  lockfile e histórico del baseline. W02 recibe sólo campos de seguimiento W08,
  preservando sus SHA, resultados y decisiones originales.

`scopeStatus: pass` se refiere al motor #44; `status: fail` conserva el gate
completo W08 aún pendiente. `evidence/week-08/sync-engineering.json` es evidencia
auxiliar de esta implementación para #52, no el dossier final ni tres aportes.
La integración comprobada invoca `createGraph().syncEngine` y comparte funciones
con evaluación; UI offline, almacenamiento durable, migraciones, envío/confirmación
remota y resolución interactiva pertenecen a #43/#45/#47. No se afirma haberlos
implementado ni demostrado idempotencia de extremo a extremo.

Asistencia material: Codex en implementación, documentación, pruebas y ejecución
por solicitud del usuario. Revisión humana y evidencia individual pendientes.
No se crea etiqueta final ni se realiza entrega Classroom.
