# W08 — política compartida e integración de sincronización (#44–#45)

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

El flujo `IncidentWorkspace` de #45 conserva base, local, remoto y operación
pendiente. Una lectura autorizada informa la versión/asignación actual y la
intención original; un 403 no revela la nueva asignación al técnico anterior.
Un usuario autorizado puede conservar la asignación remota y archivar la
intención sin borrarla, o reformular cuando siga autorizado, como describe la
integración ejecutable más abajo. No se envía automáticamente el inicio antiguo ni se marca un
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
error de red, 401/403, 409 o conflicto mantienen el pendiente. #45 implementa
el envío y la confirmación antes de llamar `PendingOperationStore.acknowledge`.

Política histórica para el ciclo W08 de #45 (sustituida en W09 por #62): como máximo **dos envíos** por
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
conservados. Esta suite prueba composición del motor. El flujo UI offline,
persistencia, confirmación y resolución de #43/#45 ya están integrados y se
comprueban por separado con `test:week-08:persistence` e integración.

| Caso / requisito | Prueba reproducible |
|---|---|
| Sin cambios, independientes, mismo cambio, JSON estructural, arrays ordenados, altas/bajas/null | `npm run test:week-08:module -- course-tests/week-08-sync.test.ts` |
| Conflictos ordenados y `work` indivisible, reasignación exacta, entradas congeladas, primera identidad | Misma suite, usando `createWeek08Scenario` del baseline #42 |
| Motor común desde composición y evaluación, sin solicitudes de red | `npm run test:week-08:sync` (rutas explícitas: sync, composición y sync-validation de #48; el agregado y workflow W08 invocan ese script) |
| Firmas y tres casos oficiales sin modificar | `npm run test:week-08:public` |
| Regresión de sesión y límites | `npm run test:week-06`, `npm run check:week-06-readiness`, `npm run test:architecture`, `npm run check:architecture` |

El runner agregado `npm run test:week-08` incluye baseline, probe de proveedor,
persistencia (incluida #47), motor/composición y validación #48, integración y
público. El workflow W08 conserva todos sus gates oficiales, incluido AC-03.
`reports/week-08/sync/` conserva la ejecución histórica del motor #44;
`reports/week-08/migration-tests.json` indexa la reproducción consolidada.
La prueba del motor por sí sola no certifica persistencia, reinicio, migración
o idempotencia remota. Asistencia material de Codex en código, pruebas,
documentación y ejecución; revisión humana y entrega W08 pendientes.


## Integración ejecutable #45

`PerformIncidentAction.start` delega al `IncidentWorkspace` inyectado. Guarda
la operación antes de intentar sync; una falla de almacenamiento impide enviar.
La UI permite además guardar inicio sin intentar red, añadir nota y referencia
sintética y recuperar copias de la misma cuenta. Al fallar consultas por red o
timeout puede mostrar la copia propia; no sustituye rechazos de autorización
o contrato con caché. Mientras hay intención activa se bloquean otras acciones
online sobre esa incidencia. Resolve/close/reopen conservan su flujo W06.

El ciclo explícito «Sincronizar con mi sesión» lee la base remota antes de
enviar, aplica las funciones compartidas y conserva campos compatibles en el
snapshot local. No modifica el cuerpo o baseVersion de ninguna operación.
Se procesa por orden, deteniendo esa incidencia al fallar; una reformulación
ocupa la posición lógica de su original. Otras incidencias pueden avanzar.
En el ciclo histórico W08, timeout y desconexión admitían un segundo envío idéntico;
403/409/respuesta inválida no disparan reintento automático. Los replays 401
acotados por el decorador W06 siguen siendo renovación de sesión, no un ciclo
de reintentos de proveedor W09. No hay observador de conectividad: al recuperar
la conexión el usuario inicia otro ciclo mediante el control accesible.

El gateway usa el transporte autenticado W06, fijando actor y generación en
cada solicitud. El decorador comprueba esa vinculación antes de renovar,
enviar y repetir. Un cambio de cuenta conserva las operaciones del autor
previo, limpia las vistas privadas y no permite enviarlas como el nuevo actor.
Los tokens no se guardan en el workspace ni aparecen en los logs de #45.

La respuesta 200/201 debe contener el mismo operationId, duplicate booleano,
la misma incidencia y un evento de historial con autor/acción/ID originales,
versión base + 1 y efecto coherente (estado/asignado o nota/evidenceId).
El gateway rechaza confirmaciones incompletas o de otra operación. Cuando una
respuesta perdida ya dejó ese evento remoto, el ciclo permite el **replay de
la petición original** para obtener su recibo, aunque la versión haya avanzado.
No usa una lectura GET como autorización para acknowledge. Si el replay devuelve
un recibo antiguo, conserva el estado remoto más reciente ya leído en la caché. Timeout, 403, 409,
401, fallas SQL y recibos inválidos conservan la fila.

### Reasignación y decisión humana

El backend real devuelve 403 al técnico anterior incluso en GET. Se informa
«Acceso denegado: requiere revisión autorizada» conservando el inicio, nota,
archivo y cola, sin mostrar la nueva asignación a quien no puede leerla.
No se deduce una asignación concreta de ese 403. Coordinación abre el detalle
remoto y pulsa «Consultar servidor y revisar conflicto»: una lectura autorizada
permite mostrar intención local y estado/asignación/version remotos. El merge
exacto del escenario produce `['work']`.

La decisión «Conservar asignación remota y archivar intención sin borrarla»
revalida la versión esperada, registra actor/decisión y marca reviewed. Mantiene
los originales y no llama acknowledge ni envía el inicio previo. Una versión
que cambió desde la inspección exige volver a revisarla. El actor original sólo
puede reformular cuando sigue autorizado; nunca recupera la antigua asignación
por elegir una resolución local. La UI y la suite prueban estos controles.

### Tres acciones con base 1

Inicio, nota y foto sobre base 1 son válidos como conservación offline.
Después de confirmar inicio en v2, la nota original obtiene 409 y se conserva;
no se envían tres escrituras supuestamente consecutivas sobre v1. El autor
inspecciona y elige reformular la nota sobre v2 con otro ID. Una vez confirmada
en v3, hace lo mismo con la foto. Los originales permanecen superseded en
la cola/auditoría y la foto conserva su evidenceId/archivo. La reformulación
rechaza un original presente en historial: una respuesta ambigua exige replay,
no otra operación que duplique el efecto. No hay rebase automático.

### Verificación y límites

`npm run test:week-08:integration` ejecuta gateway y flujo/UI. Prueba el grafo
real de App.tsx, SQLite en disco con la factory #42/#43, backend didáctico por
HTTP local, socket abortado en timeout_after_commit, reapertura del recurso,
conflicto/revisión, reformulación, identidad y rollback. El transporte Node
sustituye fetch y el driver Node sustituye Expo; no sustituye el adaptador SQL,
el controlador de sesión, los casos de uso, el mapper ni el motor compartido.
El runner `test:week-08:module` sigue disponible para la suite por ruta. El
agregado W08 y el workflow oficial incorporan esta suite sin quitar gates.

Las notas/operaciones archivadas y los recibos se retienen sin purga. El
backend sigue en memoria y sólo confirma metadatos de evidencia; su reinicio
pierde historial remoto, por lo que una operación ambigua requiere revisión,
no inventar una confirmación. No se implementa captura/carga de imágenes,
GPS, infraestructura productiva ni los stubs futuros de W09/W10. Los logs y
SHA realmente comprobados quedan en `reports/week-08/app-integration/`.
La revisión humana y la evidencia individual completa del equipo siguen
pendientes y no se atribuyen a esta ejecución asistida por Codex.

## Política activa W09 #62

El motor puro merge/dedupe sigue sin hacer red. El workspace ahora invoca el
gateway una vez; SessionTransportDecorator/IncidentRetryExecutor comparten hasta
cuatro envíos por solicitud, incluido replay W06, y 10 s de presupuesto. GET
previo y POST tienen presupuestos separados. Desconexión conserva pendiente y
pide otro ciclo manual; timeout/429/500/502/503/504 aplican backoff/Retry-After
sólo con identidad/cuerpo estables. Se conservan revisión, recibo y acknowledge
W08. Reglas, configuración, pruebas y límites: docs/resilience-policy.md.
