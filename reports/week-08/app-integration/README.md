# #45 — integración real de cola, sesión y sync

SHA técnico comprobado: `99dd0dea54c60a1ac13ee074fb70a8ae751f7147`. Node `v22.22.0`.
`validation.json` registra comandos, exit code, duración y log originales.
El código de salida del runner fue 1: **no se declara entrega W08 completa**.

- `npm run test:week-08:integration`: 24 pruebas (15 de flujo/UI + 9 de gateway).
- `npm run test:week-08:module -- course-tests/week-08-integration.test.tsx`: 15 pruebas.
- `npm run test:week-08`: baseline, SQLite/proveedor, 19 pruebas owner #43,
  24 del motor/composición #44, las 24 nuevas y 3 públicas pasan.
- W06: 31 pruebas y 8 regresiones independientes pasan; no se elimina ninguna
  aserción anterior. Sus fixtures sólo reciben la nueva dependencia SQL real.
- Tipos/lint, smoke/incidencias, arquitectura, `make feedback` (87 pruebas y
  export Android) y `make verify-week-08` pasan.
- `make public-test-week-08`: exit 2. Toolchain y 90 pruebas pasan, pero falta
  la evidencia canónica de #52: migration-tests.json, engineering.json e
  individual.json. No se crean placeholders ni aportaciones humanas ficticias.

La integración abre SQLite real en archivos aislados usando la factory de
#42/#43 y el adaptador SQL de producción. Se cierra y crea otro recurso/grafo;
la foto se recupera después de borrar el origen temporal. El backend es el
simulador oficial en otro proceso, por HTTP loopback; timeout_after_commit
usa su variante publicada y aborta el socket, sin fingir un recibo exitoso.
Los SDKs Expo se sustituyen por driver/archivos Node en estas pruebas; no se
sustituyen almacenamiento, sesión, casos de uso, mapper ni motor por fakes.

Reasignación: el técnico recibe 403 y conserva los tres originales. El flujo
UI de coordinación lee el remoto autorizado, informa `work`, revalida versión
y registra keep_remote sin acknowledge. La reformulación secuencial de nota
y foto crea identidades nuevas, conserva originales superseded y no supone
tres escrituras válidas con base 1. Los replays mantienen cuerpo/actor/clave.
También se prueba fallo transaccional, retiro fallido, recibo adulterado,
cambio de cuenta y recibo antiguo frente a un remoto más reciente.

No había dispositivo/emulador Android conectado. Los resultados nativos
previos de #43 permanecen asociados a sus propios SHA; esta ejecución no
acredita una nueva validación nativa #45. La auditoría conserva sus hallazgos
high/moderate y pasa el umbral critical configurado, sin cambiar el stack.
Las advertencias act de suites históricas permanecen visibles en sus logs;
la suite nueva usa act y no las oculta con mocks de consola.

Asistencia material: Codex implementó código, pruebas, documentos y ejecutó
comandos a petición del usuario. Revisión/explicación humana y recopilación
#52 pendientes; no se fabrica roster, matrícula o revisión. No se crea tag
ni se envía Classroom. Evidencia auxiliar de la decisión técnica:
`evidence/week-08/integration-engineering.json`.
