# Revisión documental W09 — JulianDele

## Alcance y criterio

Revisé `docs/resilience-policy.md`, `docs/CAMPUSOPS_API.md`,
`course-contracts.json`, la actividad y guía publicadas de Week 09, y los
resultados existentes bajo `reports/week-09/`. No ejecuté pruebas en esta revisión
ni inspeccioné o modifiqué lógica productiva. Los estados describen si localicé
evidencia en las fuentes, no certifican una entrega completa ni sustituyen la
reproducción del comando indicado en cada reporte.

Los nombres de reporte solicitados por el contrato de curso,
`reports/week-09/fault-injection.json` y `reports/week-09/retry-metrics.json`, no
están presentes en esas rutas. Hay reportes de validación y logs bajo
`reports/week-09/location/`, `retry/` e `integration-order/`; esa diferencia se
registra como discrepancia de entrega.

## Checklist

| Requisito | Fuente/Ruta | Evidencia localizada | Estado | Observación |
|---|---|---|---|---|
| proveedor | `docs/resilience-policy.md`; `reports/week-09/location/external-execution.json` | Se documenta Photon (`https://photon.komoot.io`) y la llamada externa está registrada con fixture ficticia `w09-fictional-campus-location`. | PRESENTE | El proveedor y su restricción de disponibilidad pública están documentados; el resultado externo no encontró coincidencia. |
| ejecución real | `reports/week-09/location/external-execution.json`; `reports/week-09/location/validation.json` | Comando registrado `npm run check:week-09-location-provider -- --timeout-ms=5000`; HTTP 200, 1005 ms, `externalExecutionConfirmed: true`, outcome `manual`. | PRESENTE | Confirma llamada real a Photon. No es evidencia de coordenadas válidas: el resultado fue sin coincidencia y se conservó la alternativa manual. |
| caché | `docs/resilience-policy.md`; `reports/week-09/location/validation.json`; `reports/week-09/integration-order/location.log` | Política LRU en memoria, máximo 50 entradas y TTL inicial 300000 ms; suite de ubicación 78/78 y probe loopback enumera `cache-hit`. | PRESENTE | La caché es volátil; la evidencia no indica persistencia en SQLite ni en archivos. |
| ubicación manual | `docs/resilience-policy.md`; `reports/week-09/location/external-execution.json`; `reports/week-09/integration-order/location.log` | Photon sin coincidencia produjo `outcome: manual`; el probe loopback incluye `connection-refused-manual`. | PRESENTE | Se conserva referencia textual manual y no se inventan coordenadas. |
| datos inválidos | `docs/CAMPUSOPS_API.md`; `docs/resilience-policy.md`; `reports/week-09/location/validation.json` | Contrato limita latitud/longitud a rangos finitos; suite de ubicación reporta 78 pruebas aprobadas y cubre coordenadas inválidas según el registro individual W09 de la suite. | PRESENTE | El reporte de validación resumido no desglosa cada aserción; el estado se apoya en la suite y el contrato, no en una ejecución nueva. |
| datos incompletos | `docs/resilience-policy.md`; `reports/week-09/location/validation.json` | La política describe `incomplete` como resultado no disponible con fallback manual; suite de ubicación registrada 78/78. | PRESENTE | No se deben completar campos o coordenadas ausentes con valores inventados. |
| timeout | `docs/resilience-policy.md`; `reports/week-09/integration-order/location.log`; `reports/week-09/retry/validation.json` | El probe de ubicación lista `socket-abort-timeout`; retry reporta POST timeout seguido de replay con mismo cuerpo/clave. | PRESENTE | Son casos de transporte controlado/loopback; no se presenta como indisponibilidad de Photon. |
| HTTP 429 | `docs/resilience-policy.md`; `reports/week-09/integration-order/location.log`; `reports/week-09/integration-order/retry.log` | Probe de ubicación incluye `429-retry-after`; el probe retry registra GET con dos envíos y espera observada de 1029 ms frente al mínimo de 1000 ms. | PRESENTE | Se respeta Retry-After; no se recorta una espera válida. |
| offline | `docs/resilience-policy.md`; `reports/week-09/integration-order/location.log` | El probe de transporte local incluye `connection-refused-manual`. | PRESENTE | La falla de conexión conserva la alternativa manual; no equivale a una ejecución externa exitosa. |
| intento 4 | `docs/CAMPUSOPS_API.md`; `docs/resilience-policy.md`; `reports/week-09/integration-order/clock-regression-after.log` | La política establece que desde intento 4 no se reintenta; el log de regresión indica que los errores transitorios se detienen tras cuatro envíos reales. | PRESENTE | Límite de cuatro envíos totales y máximo de tres repeticiones posteriores al envío inicial. |
| POST estable | `docs/CAMPUSOPS_API.md`; `docs/resilience-policy.md`; `reports/week-09/integration-order/public-direct.log`; `reports/week-09/retry/validation.json` | La prueba pública aprueba “does not retry a POST without stable idempotency identity”; los recibos de POST registran `stableKey: true` e `identicalBody: true`. | PRESENTE | POST sin clave estable no se reintenta; el replay mantiene identidad y cuerpo. |
| respuesta perdida | `docs/CAMPUSOPS.md`; `docs/resilience-policy.md`; `reports/week-09/retry/validation.json` | `lost-resolve-response` y `lost-close-response`: dos envíos, recibo duplicado, mismo ID/cuerpo y `effectCount: 1`. | PRESENTE | Evidencia de loopback sintético; el propio reporte limita el caso: el backend didáctico no implementa notificaciones. |
| sanitización | `docs/CAMPUSOPS.md`; `docs/resilience-policy.md`; `reports/week-09/integration-order/clock-regression-after.log` | El log incluye un test aprobado de métricas limitadas a campos técnicos incluso ante contenido hostil y fallo del logger. | PRESENTE | La evidencia citada es de pruebas/logs sanitizados; no acredita retención o comportamiento de sistemas externos. |
| rutas oficiales de reportes | `course-contracts.json`; `docs/assignments/week-09.md`; `reports/week-09/` | El contrato exige `reports/week-09/fault-injection.json` y `reports/week-09/retry-metrics.json`; los reportes disponibles están anidados en subdirectorios. | DISCREPANTE | La evidencia técnica existe en rutas auxiliares, pero los dos artefactos requeridos en las rutas oficiales no están presentes. El gate público también registra su ausencia. |

## Resultado de revisión

La documentación de política y los reportes de validación por subcarpeta aportan
trazabilidad para proveedor, fallback, retry y respuesta perdida. No se debe
interpretar un HTTP 200 externo sin coincidencia como éxito geográfico. El estado
de los reportes oficiales queda discrepante mientras falten los dos archivos de
raíz exigidos por `course-contracts.json`; no los generé porque esta tarea limita
el alcance a checklist y evidencia individual.

Esta revisión es documental. No ejecuté comandos ni afirmo que Julian haya
realizado personalmente los tests descritos en los reportes históricos.
