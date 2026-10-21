# Observaciones reales del baseline W08 #42

Código comprobado: `9f56862e269221ff96a5789b77d32162c8d57d24`.
Base recibida: `a57c8de8878f3a5a946244f2fecab81a869e78ba`.
Node 22.22.0 / npm 10.9.4. Fecha y hora UTC de ejecución en `validation.json`.
El commit que incorpora estos reportes modifica exclusivamente `reports/`.
No se ha creado etiqueta ni se afirma entrega final W08 o revisión humana.

`validation.json` indexa comandos, códigos reales y logs completos. El estado
agregado es **fail** porque se ejecutaron también gates W08 todavía pendientes;
los fallos se conservan sin omitir ni transformar resultados.

Resultados:

- Setup, TypeScript, lint, smoke, incidencias, tests/límites de arquitectura y
  backend aprobaron. No cambió package-lock ni se instalaron módulos nativos.
- W06: seis suites/31 tests y ocho invariantes readiness aprobaron. Los avisos
  de React `act(...)` siguen visibles en los logs; no se suprimieron ni se
  modificó código W06 para este baseline.
- Baseline: tres tests aprobaron. El runner `test:week-08:module` se comprobó
  contra esa misma suite existente, no contra suites futuras inventadas.
- El probe SQLite aprobó reapertura entre procesos, rollback de esquema,
  datos y user_version y migración con conservación de contenido. Estado:
  v1/columnas id,content/una fila; tras falla exactamente igual; recuperación
  a v2/columnas id,content,migrated/una fila con contenido idéntico. Es una
  comprobación del motor Node y metadatos Expo, NO del adaptador Android.
- `make feedback` aprobó: 19 suites/87 tests acumulados, escaneo, gate de
  dependencias críticas y export Expo Android. Auditoría de producción (`--omit=dev`) informó 32 hallazgos
  (5 moderate, 27 high, cero critical) con el umbral existente, sin cambiarlo.
  Setup informó 56 hallazgos incluyendo dependencias de desarrollo.
  Export no equivale a APK.
- `make verify-week-08` aprobó sus diez checks. No comprueba persistencia real
  ni la existencia de los cinco entregables: ese verde no cierra el hito.
- `test:week-08:public` falló: tres tests, por los stubs existentes resolveSync
  y deduplicateOperations, responsabilidad de #44. El comando agregado
  `test:week-08` conserva el mismo error después de aprobar preparación/probe.
- `make public-test-week-08` falló (make exit 2): faltan los cinco entregables
  oficiales y falla la suite pública W08. Los tests acumulados siguen verdes.
  Los diagnósticos originales están en `../public-tests.json` y `../verify.json`.
- `preserve-history.log` corresponde a un `git diff --exit-code` exitoso sobre
  vocabulario, stubs, tests públicos, lockfile, workflows previos y todos los
  reportes/evidencias históricos. `tags-observed.txt` registra refs sin moverlas.

Kit: `zip-inventory.json` registra las 20 entradas completas y su comparación
contra la base. `kit-inspection.log` reproduce la inspección con el script
versionado, antes de extraer fuera del repo. Los trece archivos son texto;
se revisó todo su contenido y se verificaron las copias duplicadas. Decisiones
de copia y contratos: `docs/week-08-baseline.md`.

Proveedor: `provider-source.json` y `expo-sqlite-pack.json` conservan metadatos,
integridad, inventario completo (228 archivos) y los once binarios del paquete
expo-sqlite 57.0.4, inspeccionados fuera del repo, sin ejecutarlos. El código
fuente de SQLiteDatabase confirma rollback y transacciones exclusivas; no se
ha instalado este paquete en la app. #43 debe instalar la versión compatible
y validar el adaptador real; #47 debe probar sus migraciones.

Pendientes explícitos: #43 persistencia/archivos/migración de app; #44 motor;
#45 integración offline/sesión/idempotencia; #46/#49/#51 aportaciones propias;
#47/#48 pruebas adicionales; #50 revisión documental; #52 consolidación y
verificación final. Los informes auxiliares no sustituyen migration-tests.json,
engineering.json ni individual.json. No se fabricó evidencia de compañeros.

Asistencia material de Codex en inspección, implementación de preparación,
documentación y ejecución, solicitada por el owner. La validación humana
permanece pendiente y cada integrante conserva responsabilidad por su aporte.
