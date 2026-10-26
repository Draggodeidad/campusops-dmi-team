Después del merge commit de #58, main es `fb11b69f3617466712bbd67d0ef49f0592d3a357`. El SHA
histórico d7d2852 sigue siendo ancestro, pero dejó de ser HEAD/padre inmediato:
el evaluador original rechaza correctamente esa relación. Este PR exclusivo
de evidencias registra nuevas ejecuciones sobre el main real e identifica sus
resultados sin reutilizar logs de otro SHA.

Node 22.22.0, npm 10.9.4 y NODE_OPTIONS=--experimental-sqlite. Los 20 controles
terminaron con exit 0: setup, tipos/lint, smoke/incidencias, arquitectura,
W06 31/31 y readiness 8/8, persistencia 30/30, sync 47/47, integración 24/24,
agregado W08 107 pruebas más probe, feedback 87/87 y export Android,
verify-week-08, público 90/90, contrato individual y procedencia. validation.json,
final-report.md y los dos índices oficiales identifican el SHA realmente evaluado.

Sólo cambia reports/ y evidence/. Código, documentos, tests, workflow,
evaluador, dependencias y umbrales permanecen intactos. individual.json sigue
idéntico con Draggodeidad, osbaldoXxC y JulianDele. Los 49 artefactos anteriores
se preservan byte por byte en archivo con manifest. Los logs nuevos son
reproducciones de IA bajo responsabilidad del owner, no ejecuciones personales
inventadas ni traslado de los aportes originales de Osbaldo. AC-04 y AC-05
siguen pendientes de corroboración humana.

Audit mantiene 8 high y 0 critical (audit --omit=dev exit 1; gate critical exit 0).
Expo es directa y las otras siete entradas son transitivas, no exclusivamente
dev. audit-proposal.md propone un PR independiente con actualizaciones
compatibles de brace-expansion/compression/source-map-js, sin aplicarlas.
No se impone Zod 4 al CLI que requiere Zod 3 ni se degrada Expo 57 a 54.

El owner debe revisar y fusionar usando **Create a merge commit**. Si main
sigue en la base evaluada, el nuevo merge tendrá ese SHA como primer padre
y sólo cambios de evidencia; comprobarlo con el validador original. Si avanzó,
repetir sobre la nueva base. No fusionar automáticamente ni cerrar #52.

El agente tiene autorización para crear/publicar week-08-final sólo después
de esa fusión y de comprobar el SHA definitivo, árbol limpio y ausencia del
tag. frozen_sha sigue pending_final_tag; no se ha ejecutado el gate final
local sin etiqueta. Después de crearla, exigir frozen_sha=pass antes de push y
verificar Actions del tag. El archivo de entrega se generará fuera del checkout
congelado únicamente cuando tag remoto y comprobación final sean válidos.
