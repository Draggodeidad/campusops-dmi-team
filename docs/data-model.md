# Modelo local W08 — persistencia de #43

Se conservan los puertos publicados en #42. `SqliteLocalWorkspace` implementa
`LocalWorkspace` y `PendingOperationStore`; `createExpoWorkspace` conecta
expo-sqlite y expo-file-system de Expo 57. `App.tsx/createGraph` construye e
inyecta `localWorkspace`, sustituible por el mismo puerto. La apertura es
explícita y diferida: construir el grafo no abre recursos ni lanza promesas.
El flujo W08 de #45 consume este recurso desde `IncidentWorkspace`, compuesto
en `App.tsx`; el inicio habitual persiste antes de intentar la red.

## Esquema y relaciones

Archivo Android privado `campusops-workspace.sqlite` en el directorio por
defecto de expo-sqlite, modo WAL. Versión actual **2**, controlada por
`PRAGMA user_version`. SQL real: `SqliteLocalWorkspace.ts`.

| Tabla / versión | Columnas y propósito |
|---|---|
| `snapshots`, v1 y v2 | `incident_id TEXT PRIMARY KEY NOT NULL`, `snapshot_json TEXT NOT NULL`. JSON de `LocalIncidentSnapshot`: `base`, `local`, `notes`, `photos`. |
| `pending_operations`, v1 | `sequence INTEGER PRIMARY KEY AUTOINCREMENT`, `operation_id TEXT NOT NULL UNIQUE`, `incident_id TEXT NOT NULL REFERENCES snapshots(incident_id)`, `operation_json TEXT NOT NULL`. |
| `pending_operations`, v2 | Conserva las cuatro columnas y añade `actor_id TEXT NOT NULL`, `base_version INTEGER NOT NULL CHECK (base_version >= 0)`. Índice `pending_actor_sequence(actor_id, sequence)` para la consulta posterior por actor. |

Las operaciones conservan **exactamente** `operationId`, `incidentId`,
`baseVersion`, `actorId`, `action` y `payload`. Su orden es el de `sequence`,
no el de un reloj o de un ID regenerado. El adaptador comprueba la existencia
del snapshot al insertar y migrar; no depende de que una conexión externa
active `PRAGMA foreign_keys`. No hay API de borrado de snapshots.

`base` y `local` contienen el mismo ID, su versión y campos JSON completos.
Se persiste directamente `SyncRecord`, con el mapper HTTP corregido en #45 para conservar
asignación: `fields.work` conserva técnico y estado. Notas incluyen
`noteId/operationId/actorId/text`; fotos incluyen
`evidenceId/operationId/actorId/localUri/mediaType/byteLength`. No hay secretos
de sesión: permanecen en SecureStore W06. La validación rechaza claves de
tokens, contraseñas, authorization o secrets; no sustituye revisar los datos
introducidos por callers. Sólo se usan fixtures sintéticas.

## Escrituras, recuperación y fotos

- `open/close` son idempotentes. Toda operación requiere recurso abierto;
  las llamadas de cada instancia se serializan, incluido su ciclo de vida.
  Cada escritura usa `withExclusiveTransactionAsync` y exclusivamente `txn`.
  Otra conexión concurrente puede recibir un error de bloqueo; se propaga,
  sin descartar la cola ni reintentar indefinidamente.
- `commitChange` valida coincidencia de ID y versión base, captura los datos
  al invocarse y confirma snapshot y operación en **una transacción**.
  `saveSnapshot` guarda caché sin crear cola. Su caller debe conservar cambios
  locales pendientes al aplicar respuestas remotas; esa política pertenece a #45.
- `enqueue` exige snapshot existente. El mismo ID y contenido JSON equivalente
  es no-op, incluso con distinto orden de claves. Un cuerpo distinto rechaza
  con `IDENTITY_CONFLICT`. Un replay de `commitChange` tampoco regresa el
  snapshot a una intención antigua. Arrays tienen orden; se rechazan ciclos,
  `undefined`, huecos, valores no finitos, funciones y objetos no JSON.
- `acknowledge(id)` elimina sólo ese ID, idempotentemente, sin borrar snapshot
  ni fotos. **La confirmación remota es precondición del caller**, no algo que
  el almacén pueda deducir de un string. Timeout, conflicto y autorización
  fallida no deben llamar acknowledge; #45 comprueba esa integración.
- El proveedor copia archivos `file://` al directorio privado durable
  `Paths.document/campusops-attachments`, con nombres UUID independientes de
  la identidad de operación, antes de publicar su referencia en SQL. Verifica
  existencia y tamaño. No se descarga, captura ni sube ninguna foto.
  `getSnapshot` devuelve la URI durable resultante; el caller no debe seguir
  usando la URI temporal original tras guardar.
- Si falla SQL, se borran únicamente las copias nuevas de esa escritura.
  Una referencia ya administrada se verifica y se reutiliza sin borrarla.
  No hay atomicidad entre SQL y archivos: una caída abrupta antes del commit
  puede dejar un archivo huérfano, nunca una referencia confirmada al caché.
  Se prioriza retener datos; la recolección de huérfanos y la liberación de
  fotos ya confirmadas quedan pendientes, sin borrar archivos compartidos.
- Errores del proveedor se traducen a `WorkspaceError('STORAGE')` sin mensaje,
  payload ni causa nativa. `CLOSED`, `VERSION`, `INVALID_DATA` e
  `IDENTITY_CONFLICT` distinguen fallas controladas. #45 las presenta mediante
  resultados/estados de Application y UI, comprobados en la suite de integración.

No se garantiza conservación tras desinstalar, borrar datos de la app o
modificar archivos externamente. El almacenamiento operativo no cifra por
sí mismo notas/fotos. Web queda fuera: el proveedor exige transacciones
exclusivas de Expo, disponibles en Android, plataforma de referencia.

## Migración transaccional v1 → v2

1. La apertura lee versión dentro de la transacción exclusiva. Una DB vacía
   crea v1; una instalación normal migra inmediatamente a v2. `targetVersion: 1`
   permite preparar fixtures anteriores reales y no vacías.
2. Validar snapshots previos; crear `pending_v2` con autor y versión base.
   Invocar `migration.afterSchema` **dentro** de la transacción.
3. Leer cola por secuencia, validar JSON e identidades y snapshot referenciado;
   copiar secuencia, JSON original, autor y versión base sin generar IDs.
   Invocar `migration.afterCopy` dentro de la misma transacción.
4. Sustituir tabla previa, crear índice y fijar `user_version = 2`; commit.
   SQLite revierte DDL, filas e indicador de versión ante cualquier falla.

Misma versión: no-op. Downgrade y versiones desconocidas: rechazo sin cambiar
datos. Si open falla, cierra la conexión; una nueva instancia o un nuevo open
puede reintentar sobre v1 intacta. Datos corruptos previos bloquean migración,
preservan filas y requieren diagnóstico; no se "reparan" eliminando cola.

## Factory y comprobación reproducible

Node **22.22.0**, `make setup` y `npm run test:week-08:persistence` ejecutan
`course-tests/week-08-workspace-owner.test.ts` y la suite independiente
`course-tests/week-08-persistence.test.ts` de #47, con rutas explícitas.
El agregado W08 y su workflow invocan ese mismo script. La factory de #42 recibe
`createNodeWorkspace(options)`: el **mismo adaptador SQL de producción** sobre
SQLite Node en disco, cambiando únicamente driver y operaciones de archivos.
`reopen` crea instancia nueva sobre el mismo recurso; `cleanup` sólo retira
su directorio aislado. Esta suite del owner no reemplaza la revisión #47.
Comprueba contenido leído desde otro proceso, reapertura, copia/rollback,
aislamiento, fallas, migraciones y versiones. No acredita por sí sola Expo nativo.

Con SDK Android, Java compatible y emulador **x86_64** encendido:
`ANDROID_HOME=… ANDROID_SERIAL=… npm run test:week-08:native`.
El runner genera el proyecto nativo de la misma app y modifica temporalmente
sólo archivos Android generados/ignorados para usar `tools/week-08-native-entry.tsx`
y el ID aislado `mx.edu.dmi.engineeringapp.w08test`. Compila debug, usa Metro
8098, crea datos v1 y foto desde caché, elimina el origen, cierra y hace
`am force-stop`; otro proceso recupera datos y prueba ambos rollbacks de
migración, escrituras, limpieza y acknowledge con Expo SQLite/FileSystem reales.
Restaura archivos generados y desinstala sólo la app de prueba al terminar.
No cambia `index.ts`, no requiere backend ni permisos de cámara/galería, no
limpia la app CampusOps existente. Un fallo produce salida distinta de cero.

Hooks compartidos: `enqueue.afterWrite`, `change.afterSnapshot`,
`acknowledge.afterDelete`, `migration.afterSchema`, `migration.afterCopy`.
Todos se invocan antes del commit. Índice de resultados observados y límites:
`reports/week-08/persistence/validation.json`; no se presumen aprobaciones
nativas o humanas por disponer del runner. No se crea tag ni entrega Classroom.

Referencias del proveedor: [Expo SQLite](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/)
y [Expo FileSystem](https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/);
las firmas se contrastaron con los paquetes instalados del lockfile.


## Extensión aditiva de integración #45

No cambia SQL ni `user_version = 2`: los nuevos metadatos opcionales viven en
el JSON del snapshot y las fixtures anteriores siguen siendo válidas.
`listSnapshots()` amplía mínimamente el puerto para recuperar copias propias,
incluso después de confirmar y retirar su última operación. Consulta real:
`SELECT snapshot_json FROM snapshots ORDER BY incident_id`.

| Metadato | Uso real |
|---|---|
| `ownerActorId` | Identidad que obtuvo la copia autorizada. `recover()` sólo publica sus propias copias, notas y archivos. Un snapshot histórico sin owner no se adopta automáticamente. |
| `remote`, `remoteReaderActorId` | Última comparación autorizada, separada de base/local. `recover()` no expone este remoto a la identidad anterior; `inspect()` exige nueva lectura autorizada. |
| `operationStates` | Estado por ID: pending, retry, conflict, forbidden, reviewed, superseded; campos conflictivos y vínculo a reemplazo cuando corresponda. |
| `resolutions` | Decisión explícita keep_remote o reformulate, actor revisor y operación original/reemplazo. No constituye confirmación remota. |
| `confirmedOperations` | Peticiones originales verificadas antes de acknowledge; permiten reconocer un replay explícito del caller sin reutilizar la identidad con otro contenido. |

El mapper conserva asignado, reportante, notas, evidencias y prioridad además
de versión/estado. El registro de sync separa `work` indivisible de `details`,
`notes`, `evidence` y `priority`. La asignación no se reconstruye a partir del
perfil de sesión. Notas/fotos locales mantienen su operación de origen; una
reformulación enlaza el nuevo ID mediante `resolutions`, conservando ese origen.

Las mutaciones de un `IncidentWorkspace` se serializan a nivel de flujo para
no sobrescribir un registro local que llegó durante sync. `commitChange`
continúa siendo la transacción conjunta de snapshot/cola. Antes de acknowledge
se guarda la respuesta verificada y su petición original; si falla el guardado
o el borrado transaccional, la operación permanece y puede reenviarse igual.
`saveSnapshot` nunca crea ni retira una operación.

Reformular requiere una lectura reciente autorizada, versión esperada y que
el historial no contenga la operación original. Se crea **otro ID** sobre esa
base mediante commitChange, mientras el original queda en la misma cola con
estado superseded. Conservar la asignación remota registra reviewed y mantiene
base/local, nota, archivo y operación originales. Sólo una confirmación exacta
habilita acknowledge; reviewed/superseded son archivo de intenciones, no filas
confirmadas ni pendientes enviados automáticamente. Su retención aumenta el
almacenamiento: no se implementa purga automática en esta fase.

El SVG sintético se prepara en caché bajo acción explícita del usuario y el
proveedor #43 lo copia/verifica en documentos antes de confirmar SQL. La UI
consume la URI durable leída del snapshot, no el origen temporal. Ni el caso
de uso ni el backend didáctico acreditan una carga de imagen: únicamente se
confirma la referencia `evidenceId`. No se requieren cámara, galería ni GPS.

Prueba del grafo/SQLite real sobre disco y backend loopback:
`npm run test:week-08:integration`, o la ruta dedicada
`npm run test:week-08:module -- course-tests/week-08-integration.test.tsx`.
La prueba de reapertura crea otro adaptador/grafo sobre el mismo archivo;
la certificación nativa de #43 mantiene su runner independiente. La sesión
conserva W06: una sesión expirada no se restaura como autenticada tras reiniciar;
para recuperar datos de esa cuenta se requiere volver a iniciar sesión.
