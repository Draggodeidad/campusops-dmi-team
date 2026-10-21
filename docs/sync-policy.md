# W08 — política compartida de sincronización (#44)

## Decisión, alternativas y costo

Usamos merge de tres vías por campo completo: una base común, una intención
local y una lectura remota actual. Los cambios independientes o iguales se
combinan; cambios incompatibles requieren una decisión explícita informada.
Esto satisface los requisitos 4–5 de W08 y AC-02/AC-03/AC-04.

Se descartó last-write-wins por versión o por reloj: podría borrar el inicio
pendiente o imponer una asignación antigua. Se descartó combinar recursivamente
todos los subcampos: en `work` produciría un inicio sobre el técnico recién
asignado, aunque ese técnico nunca lo solicitó. Rechazar cualquier cambio
concurrente conservaría datos, pero bloquearía cambios independientes válidos.
La política elegida permite estos últimos y protege invariantes de campos
compuestos. Su costo es retener base/local/remoto y pedir intervención en
conflictos que quizá una regla de negocio más específica podría resolver.

## Contrato ejecutable y comparación JSON

`src/application/sync/resolveSync.ts` contiene la única implementación de
`resolveSync(base: SyncRecord, local: SyncRecord, remote: SyncRecord)`:

- Devuelve `{ kind: 'merged', fields }` si todos los campos son compatibles.
- Devuelve `{ kind: 'conflict', fields: string[] }` con **todos** los nombres
  incompatibles ordenados mediante `sort()` (orden de strings de JavaScript,
  sin depender de locale). No publica un merge parcial al haber conflicto.
- Un campo sin cambio local toma el remoto; sin cambio remoto toma el local;
  si ambos cambiaron al mismo contenido toma ese contenido. Si ambos cambiaron
  de forma distinta, declara conflicto.
- Compara contenido JSON recursivamente: claves propias de objetos sin importar
  orden; arrays conservan orden y longitud; distingue tipos y null. Una clave
  ausente representa borrado y difiere de null. Incluye altas y bajas de campos.
- Cada campo superior es indivisible, incluso si contiene objetos. `id` y
  `version` son metadatos; una versión mayor nunca decide un conflicto.
- No muta entradas. El mapa de salida es nuevo; valores anidados pueden compartir
  referencias con las entradas y se consumen como readonly.

Precondición: snapshots JSON válidos de **la misma incidencia y base común**.
El motor puro no valida un formato externo, IDs coincidentes, versiones o
autorización. Los límites de persistencia/orquestación #43/#45 deben comprobarlos;
no pasar undefined, NaN, Infinity, instancias de clases o referencias cíclicas.

## Caso obligatorio y resolución informada

Base v1: `work = { assignedTechnicianId: 'technician-1', status: 'assigned' }`.
Local v1: mismo asignado con `status: 'in_progress'`. Remoto v2: asignado
`technician-2` con `status: 'assigned'`. El resultado es exactamente
`{ kind: 'conflict', fields: ['work'] }`. Ni el remoto, ni la intención local,
ni las operaciones originales se modifican o descartan por esta decisión.

En el flujo que implementará #45 se conservarán base, local, remoto y operación
pendiente. Se informará la versión/asignación actual, la intención original y
por qué ya no es aplicable. Un usuario autorizado decidirá explícitamente
revisar/reformular la intención sobre el estado actual o descartarla de forma
informada. No se enviará automáticamente el inicio antiguo ni se marcará un
conflicto como confirmación de servidor. El descarte explícito requiere su propio
registro; no puede pasar por `acknowledge` como si se hubiera ejecutado.

La sesión W06 sigue siendo obligatoria: sólo enviar bajo la identidad original
autorizada; cambiar de cuenta no transfiere la cola. El servidor conserva la
comprobación final de perfil/asignación/versión. `merged` sólo significa que los
datos son combinables, nunca que la acción esté autorizada o confirmada.

## Identidad estable, confirmación y reintentos

`src/application/sync/deduplicateOperations.ts` conserva el primer objeto de
cada `operationId` exacto y el orden de aparición, sin mutar objetos o lista.
No genera, normaliza ni sustituye IDs. Si la lista contiene el mismo ID con
contenido distinto también conserva el primero, como exige su firma; **no**
certifica que la segunda entrada sea una operación válida.

La idempotencia completa requiere más: el almacén debe rechazar atómicamente
la reutilización de ID con otro contenido; cada reenvío conserva ID, autor,
incidencia, versión base y cuerpo. El servidor debe reconocer ese ID/cuerpo y
devolver el resultado sin duplicar efectos. Dedupe de una lista no lo acredita.
Reformular una intención necesita una operación nueva con identidad nueva;
nunca cambiar cuerpo/baseVersion conservando una clave ya enviada.

Sólo retirar de la cola tras comprobar confirmación inequívoca del servidor
para esa operación exacta. Un timeout puede ocurrir después del commit remoto;
error de red, 401/403, 409 o conflicto mantienen el pendiente. #45 implementará
el envío y la confirmación antes de llamar `PendingOperationStore.acknowledge`.

Política acordada para el ciclo W08 de #45: como máximo **dos envíos** por
operación y ciclo explícito (inicial y un reintento), únicamente ante falla
transitoria con la misma identidad/cuerpo y sesión vigente. Al agotar el límite
se conserva pendiente y se informa; 403/409/conflicto requieren intervención,
no un bucle automático. Un ciclo nuevo requiere nueva acción de sincronización.
Este motor puro no envía ni reintenta. No implementa `planRetry`, backoff ni la
política de proveedor W09.

## Grafo real y comprobación

`App.tsx/createGraph().syncEngine` expone estas dos funciones de Application.
`src/course-evaluation/index.ts` reexporta las mismas funciones con sus firmas
públicas intactas; Application sólo importa `SyncRecord` de Domain.
`course-tests/week-08-sync-composition.test.ts` invoca el motor desde ese grafo,
comprueba identidad con evaluación, merge compatible y conflicto con pendientes
conservados. Esto prueba composición del motor; el flujo UI offline, persistencia,
confirmación y resolución interactiva siguen en #43/#45. No se presentan como
implementados por exponer funciones en el grafo.

| Caso / requisito | Prueba reproducible |
|---|---|
| Sin cambios, independientes, mismo cambio, JSON estructural, arrays ordenados, altas/bajas/null | `npm run test:week-08:module -- course-tests/week-08-sync.test.ts` |
| Conflictos ordenados y `work` indivisible, reasignación exacta, entradas congeladas, primera identidad | Misma suite, usando `createWeek08Scenario` del baseline #42 |
| Motor común desde composición y evaluación, sin solicitudes de red | `npm run test:week-08:sync` (incluye ambas suites) |
| Firmas y tres casos oficiales sin modificar | `npm run test:week-08:public` |
| Regresión de sesión y límites | `npm run test:week-06`, `npm run check:week-06-readiness`, `npm run test:architecture`, `npm run check:architecture` |

El runner agregado `npm run test:week-08` incluye baseline, probe de proveedor,
motor/composición y público. El workflow W08 ejecuta el motor adicionalmente a
sus gates oficiales. #48 puede ampliar estas pruebas sin sustituir la lógica.
Resultados, SHA comprobado y comandos observados: `reports/week-08/sync/`.
Este cambio no certifica persistencia, reinicio, migración, idempotencia de extremo
a extremo, revisión humana ni entrega W08. Asistencia material de Codex en código,
pruebas, documentación y ejecución; revisión humana pendiente.
