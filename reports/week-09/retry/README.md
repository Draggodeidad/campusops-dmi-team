# #62 — validación observada de retry e idempotencia

SHA técnico: `1200535f9a0d957d7cf17fb8b71b1a7d4c3b64c6`.
`validation.json` indexa comandos reales, códigos de salida, duración y logs.
Las verificaciones se ejecutaron con Node 22.22.0 sobre ese SHA sin cambios
fuente; `loopback-observation.json` confirma `sourceTreeDirty: false`.
El commit posterior sólo agrega/modifica reports/evidence. El log setup-bootstrap
corresponde a instalación limpia anterior al commit, sin atribuirle resultados
de comportamiento ni el SHA técnico futuro.

- `test:week-09:retry`: 79/79; políticas, relojes, POST/GET, sesión, recibos,
  disco/backend y fetch loopback. `check:week-09-retry`: también ejecutado directo.
- Loopback nativo: GET 429 espera al menos los 1000 ms de Retry-After. Resolución
  y cierre pierden su primera respuesta después del commit; cada una conserva
  clave/cuerpo, obtiene un recibo duplicate y sólo produce un evento. Tiempos e
  intentos observados están en loopback-observation.json y native-probe.log.
- W06: 31/31 y ocho regresiones readiness. W08: 107/107 y probe SQLite.
- Baseline: 4/4; incidencias: 2/2; arquitectura: 2/2 y cero violaciones.
- `make feedback`: pasa tipos, lint, 87 pruebas, sanitización de secretos,
  arquitectura, auditoría con umbral critical y export Android Expo. La auditoría
  informa siete vulnerabilidades high del árbol conservado; no se cambian paquetes.
- `make verify-week-09`: exit 0. No acredita por sí mismo la entrega completa.
- Público W09 directo: 3 pasan y 1 falla por `selectIncidentLocation` todavía
  pendiente en main (#61). Las tres pruebas de retry públicas pasan intactas.
- Gate público: exit 2, por ese stub y cuatro archivos oficiales aún ausentes:
  fault-injection.json, retry-metrics.json, engineering.json e individual.json de
  W09. El runner acumulado informa 90 passed / 1 failed. Las salidas/evaluadores
  originales quedan copiados; no se ocultan fallos ni se crean placeholders.

La rama parte de main/#60 y es independiente de la implementación #61 que aún
estaba en otra rama. La suite owner deja libre la corroboración propia de #65.
`evidence/week-09/retry-engineering.json` enlaza requisito/decisión/comprobación;
los anexos W02 son aditivos y conservan sus resultados históricos.

No se ejecutó evidence-week-09, creó tag ni entregó Classroom. El bundle Expo
no es un APK ni una prueba Android nativa. El backend no implementa notificaciones;
estas comprobaciones no acreditan su entrega. Revisión humana y registro
individual auténtico del owner quedan pendientes; no se atribuye trabajo ajeno.
Ayuda material de IA: Codex asistió código, pruebas, documentación y ejecución;
se validó mediante los comandos observados, sin sustituir revisión humana.

La comprobación inicial del diff staged detectó espacios finales emitidos por
Jest. Se conservó la salida exacta de esos logs en `.log.gz` y se quitaron
únicamente espacios/tabs/CR finales de sus versiones legibles. Hashes y
transformación están en log-provenance.json; la salida original del check
fallido está comprimida. No se cambia ningún resultado ni control.
