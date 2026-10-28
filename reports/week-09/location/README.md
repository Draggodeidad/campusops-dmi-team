# #61 — resultados observados de ubicación

SHA técnico: `a4e3e62d33890dd82c51f1242d8040438ee4408f`. Fecha: 2026-10-27T22:51:20.705595+00:00.

`validation.json` conserva comandos, códigos, tiempos, escenarios y logs del SHA
comprobado en un worktree limpio. Se reutilizó node_modules; no se acredita una
instalación nueva. El tsconfig y archivos locales ajenos no formaron parte del
checkout validado. Node 22.22.0. Logs completos con prefijos de ruta local
sustituidos, espacios finales normalizados y hashes en log-provenance.json; se conservan advertencias de las
suites históricas, sin ocultar errores ni desactivar gates.

- 78 pruebas nuevas en 3 suites pasan; probe loopback con fetch y aborto real pasa.
- Baseline W09: 4 pruebas; W06: 31 y ocho controles de readiness; W08: 107 pasan.
- Tipos, lint, smoke (1), incidencias (3), arquitectura (2 y checker) pasan.
- make feedback: 87 pruebas, tipos/lint/secretos/auditoría crítica y export Android
  pasan. El export no es APK ni validación en dispositivo.
- make verify-week-09 pasa; no demuestra por sí solo funciones o entrega final.
- Público W09: ubicación pasa, tres pruebas planRetry fallan por el stub #62.
- make public-test-week-09 falla: 88 pruebas pasan, tres planRetry fallan y faltan
  los cuatro artefactos compartidos listados en validation.json. No se rellenan
  con placeholders ni se atribuye trabajo pendiente al owner.
- Photon real devuelve HTTP 200 tras 1005 ms, con timeout
  explícito 5000 ms y consulta ficticia fija. Resultado sin coincidencias:
  alternativa manual. No se publican consulta, etiquetas externas, coordenadas,
  cuerpos, claves ni cabeceras. El éxito de coordenadas se prueba con fixtures.

Las exploraciones previas al SHA técnico incluyeron timeout sin el proxy del
entorno; no se presentan como observaciones de esta versión. El comando externo
usa --use-env-proxy, sin exponer variables. La app conserva timeout inicial de
1000 ms. No hay retries automáticos ni cambios a escrituras/cola/sesión W08.

Ayuda material de IA: Codex asistió con código, pruebas y documentación. Revisión
humana, evidencia individual real y consolidación de equipo pendientes. No hay
tag ni entrega Classroom. La issue #61 permanece abierta.
