# Revisión documental W08 — JulianDele

## Alcance

Revisión documental basada únicamente en `docs/week-08-baseline.md`,
`docs/CAMPUSOPS.md`, `docs/CAMPUSOPS_API.md`,
`docs/EVIDENCE_CONTRACT.md`, `course-contracts.json`,
`reports/week-08/baseline/validation.json` y
`src/application/persistence/LocalWorkspace.ts`.

La validación disponible es el baseline del SHA
`9f56862e269221ff96a5789b77d32162c8d57d24`. El propio reporte la limita a
preparación, fixtures/harness y probe del proveedor; no acredita por sí solo la
persistencia de la aplicación, la sincronización integrada ni la entrega W08.
Las afirmaciones posteriores que aparecen en el documento baseline se consideran
referencias documentales, no prueba de comportamiento si no hay una observación
correspondiente en el reporte permitido para esta revisión.

## Checklist

| Requisito | Ruta revisada | Observación | Estado |
|---|---|---|---|
| `identity / author / baseVersion` | `src/application/persistence/LocalWorkspace.ts`; `docs/week-08-baseline.md`; `reports/week-08/baseline/validation.json` | El puerto permite `enqueue(PendingIncidentOperation)` y `commitChange(snapshot, operation)`. El baseline especifica que la operación conserva `operationId`, `incidentId`, `baseVersion` y `actorId`; la interfaz por sí sola no comprueba la persistencia de esos valores. La validación baseline no informa una prueba de la operación en el adaptador CampusOps. | Pendiente de evidencia de implementación y prueba del adaptador |
| Reinicio de nota/foto | `docs/CAMPUSOPS.md`; `src/application/persistence/LocalWorkspace.ts`; `docs/week-08-baseline.md`; `reports/week-08/baseline/validation.json` | CAMPUSOPS exige recuperar trabajo local después de reiniciar. El baseline describe fixtures y un harness que reabre recursos, pero distingue ese harness de un adaptador durable CampusOps; el reporte no acredita recuperación de nota/foto de la app tras reinicio. | Pendiente |
| Migración / rollback | `src/application/persistence/LocalWorkspace.ts`; `docs/week-08-baseline.md`; `reports/week-08/baseline/validation.json` | `migrate(targetVersion)` forma parte del contrato. El baseline registra un probe de capacidad SQLite y describe migración transaccional prevista; el reporte lo limita al proveedor/harness y no acredita la migración/rollback del adaptador CampusOps. | Pendiente de prueba del adaptador; el probe de proveedor no basta |
| Conflicto `start` vs `reassignment` | `docs/CAMPUSOPS.md`; `docs/CAMPUSOPS_API.md`; `docs/week-08-baseline.md`; `reports/week-08/baseline/validation.json` | El contrato establece que `work` agrupa asignación y estado, y que un inicio local frente a reasignación remota debe conservar ambas intenciones como conflicto. El baseline reporta la prueba pública de sync fallida en ese SHA por stubs de `resolveSync`/`deduplicateOperations`; no acredita el flujo integrado ni resolución en la app. | Pendiente en el SHA del baseline |
| Merge independiente | `docs/CAMPUSOPS_API.md`; `docs/week-08-baseline.md`; `reports/week-08/baseline/validation.json` | El contrato pide combinar cambios independientes y comparar contenido JSON. El reporte baseline registra fallo del test público de sync mientras las funciones evaluadas seguían como stubs en ese SHA. | Pendiente en el SHA del baseline |
| Operación repetida | `docs/CAMPUSOPS.md`; `docs/CAMPUSOPS_API.md`; `docs/week-08-baseline.md`; `reports/week-08/baseline/validation.json` | El contrato exige identidad y cuerpo estables, replay idempotente y ausencia de efectos duplicados. El reporte baseline pasa el self-test del backend, pero no acredita el ciclo de operación durable de CampusOps tras reinicio ni el flujo de sync integrado. | Pendiente de evidencia de extremo a extremo |
| Retirar sólo confirmado | `src/application/persistence/LocalWorkspace.ts`; `docs/week-08-baseline.md`; `reports/week-08/baseline/validation.json` | El puerto ofrece `pending.acknowledge(operationId)`, pero su firma no recibe un recibo ni prueba confirmación. El baseline asigna esa precondición al caller y dice que timeout, 403, 409 o conflicto deben conservar la cola; la validación baseline no demuestra la integración del caller con respuestas del servidor. | Pendiente de prueba del flujo de confirmación |

## Conclusión

En las fuentes autorizadas, varios comportamientos aparecen como requisitos o
contratos, pero el reporte de baseline no los acredita como flujos durables de la
aplicación. Por eso no marqué como implementado ningún requisito cuyo único
respaldo sea una firma de interfaz o una descripción normativa. Esta revisión no
ejecuta pruebas, no modifica código productivo y no sustituye los reportes de
persistencia, sync o integración posteriores.