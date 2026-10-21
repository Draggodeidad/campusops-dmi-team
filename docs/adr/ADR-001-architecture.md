# ADR-001 — Arquitectura interna de CampusOps

- Estado: aceptada
- Fecha: 2026-09-10
- Alcance: Week 02 — Arquitectura justificable

## Contexto

CampusOps crecerá para atender incidencias, sesión, persistencia y ubicación con tres perfiles: Reportante, Técnico y Coordinador. En Week 02 sólo corresponde demostrar el flujo lista → detalle con datos sintéticos. React Native, Expo y TypeScript ya están fijados y no forman parte de esta decisión.

La línea base de Week 01 concentraba presentación, consulta de salud del backend y manejo de estado en `App.tsx`. En particular, la vista raíz importaba directamente `src/api/courseBackend.ts`. Ese acoplamiento hacía que un cambio de transporte o proveedor alcanzara la presentación y contradecía el límite solicitado para Week 02.

## Problema

Necesitamos separar reglas, orquestación, presentación y proveedores concretos de forma comprobable, manteniendo bajo el costo inicial. La solución debe permitir sustituir el origen de incidencias sin reescribir la UI y debe dejar espacio para los límites futuros de sesión, persistencia y ubicación sin implementarlos antes de tiempo.

## Alternativas consideradas

### Alternativa A — Capas sencillas con puertos y adaptadores

Organizar el código en UI, Application, Domain e Infrastructure. El dominio declara `Incident` y `IncidentRepository`; Application contiene casos de uso; Infrastructure implementa el repositorio fake y el adaptador de salud; `App.tsx` actúa únicamente como raíz de composición e inyecta los casos de uso en la UI.

Ventajas:

- Los casos de uso se prueban con cualquier implementación de `IncidentRepository`.
- La UI no conoce HTTP, almacenamiento, SDKs ni el fake concreto.
- Cambiar el fake por un repositorio API requiere modificar infraestructura y composición, no pantallas.
- Los imports se pueden verificar con una regla pequeña y explícita.

Desventajas:

- Introduce interfaces, casos de uso y una raíz de composición aun para un flujo pequeño.
- Exige disciplina para que nuevas funcionalidades respeten la dirección de dependencias.

### Alternativa B — Clean/Hexagonal completa con contenedor de DI

Separar entidades, interactores, DTO, mappers, puertos de entrada/salida y adaptadores, y resolver dependencias mediante un contenedor configurable.

Ventajas:

- Mayor aislamiento entre formatos de transporte, modelos internos y presentación.
- Sustitución centralizada de implementaciones cuando existan muchas integraciones.
- Puede resultar útil cuando aumenten los flujos, proveedores y políticas de ciclo de vida.

Desventajas:

- Aumenta el boilerplate, la configuración y la superficie de pruebas desde el inicio.
- DTO y mappers duplicarían modelos que por ahora son sintéticos y estables.
- Un contenedor de DI añade complejidad operativa sin resolver un problema actual del flujo lista/detalle.

## Decisión

Adoptamos la alternativa A: arquitectura por capas sencilla con Ports and Adapters e inyección manual en `App.tsx`.

Las dependencias permitidas son:

- UI → Application y Domain (tipos de solo lectura para presentación).
- Application → Domain.
- Infrastructure → Domain o contratos de Application.
- Composition Root (`App.tsx`) → UI, Application e Infrastructure para construir el grafo.

Las dependencias prohibidas principales son:

- UI → Infrastructure.
- Application → UI o Infrastructure.
- Domain → UI, Application o Infrastructure.
- Infrastructure → UI.

`src/campusops/contracts.ts` se conserva como vocabulario público de dominio del starter. Los límites de sesión, persistencia y ubicación quedan identificados como evolución prevista, pero no se implementan en esta semana.

## Razones

La alternativa elegida consigue el aislamiento que hoy se puede verificar: el repositorio fake es reemplazable, los casos de uso son independientes de React Native y la UI no conoce proveedores. Su costo es proporcional al flujo actual y evita introducir DTO, mappers y un contenedor antes de contar con integraciones reales que los justifiquen.

El cambio de proveedor queda localizado: Week 05 añadió `HttpIncidentRepository` bajo el mismo contrato y lo seleccionó en la raíz de composición. Esta decisión prioriza facilidad de prueba y costo bajo de sustitución, aceptando una cantidad moderada de archivos y composición manual.

## Consecuencias positivas

- Lista y detalle consumen casos de uso, no datos concretos de infraestructura.
- `FakeIncidentRepository` permite ejecución determinista sin backend.
- La salud del backend se consulta mediante `BackendHealthPort` y `CourseBackendHealthAdapter`.
- El comprobador automático rechaza imports que atraviesen límites prohibidos.
- El diseño puede evolucionar sin modificar la dirección de dependencias.

## Consecuencias negativas

- La composición manual crecerá si aumenta mucho el número de dependencias.
- La UI usa tipos de dominio directamente; si divergen los modelos de presentación será necesario introducir view models o mappers.
- Los límites previstos de sesión, persistencia y ubicación todavía no tienen implementaciones ejecutables.

## Verificación y trade-off

El beneficio de testabilidad y sustitución se verifica con `npm run test:incidents`: un repositorio alternativo satisface los mismos casos de uso. El costo es la estructura adicional visible en los cuatro límites. `npm run test:architecture` comprueba tanto el estado final como la capacidad del control para detectar un import directo UI → Infrastructure; `npm run check:architecture` inspecciona el árbol real de `src`.

La discrepancia inicial se reproduce consultando el archivo de la línea base con `git show fcc8a61430027abfbdca2ad938bc7c99093bd03f:App.tsx`: allí `App.tsx` importaba directamente `src/api/courseBackend.ts`. En el estado corregido, `CourseBackendHealthAdapter` encapsula ese detalle y la UI recibe `GetBackendStatus` por inyección.

## Posibles evoluciones futuras

- Extender `HttpIncidentRepository` sólo cuando un hito posterior requiera nuevas operaciones.
- Añadir puertos y adaptadores de sesión, persistencia y ubicación en sus semanas correspondientes.
- Introducir DTO/mappers sólo si los contratos remotos divergen del dominio.
- Sustituir la composición manual por un módulo o contenedor cuando su tamaño y ciclo de vida lo justifiquen.

## Anexo de Semana 04 — almacenamiento y errores seguros

La aplicación sigue sin login ni sesión activa. Para preparar un límite real y sustituible sin introducir el flujo de Semana 06, `SessionSecretStore` vive en Application y `ExpoSecureSessionSecretStore` lo implementa en Infrastructure mediante `expo-secure-store`. El adaptador no se inyecta todavía desde `App.tsx` porque ningún caso de uso actual guarda una sesión; sus llamadas nativas se comprueban con un proveedor sustituido en pruebas. La configuración nativa del módulo está en `app.json`.

Alternativas: guardar un token en preferencias comunes sería insuficiente para un secreto; añadir ahora login y ciclo de sesión adelantaría autorización, refresh y logout sin su contrato semanal. El puerto estrecho y el adaptador nativo permiten probar almacenamiento y borrar el secreto, con el costo de una dependencia nativa y de no poder afirmar protección de una sesión aún inexistente.

`ApplicationFailure` entrega códigos y mensajes constantes para fallas de repositorio y almacenamiento. Los casos de uso no propagan mensajes, `cause` ni objetos de error de proveedores a la UI. El control de redacción de telemetría sigue asignado a otro integrante; este mapeo funciona independientemente de él. Las pruebas de Semana 04 verifican sustitución y caminos negativos; `check:architecture` conserva la dirección de imports.

## Anexo de Semana 05 — cliente HTTP y DTO validado

**Contexto.** Week 05 exige consultar lista y detalle, crear incidencias y soportar respuestas remotas vacías, inválidas o fallidas. El fake de Week 02 no podía probar la frontera de red. El sobre remoto tiene `id`, `version`, `status` y `payload`, mientras `Incident` contiene campos propios de la app, entre ellos un título derivado.

**Alternativas.** (1) Hacer `fetch` en pantallas habría mezclado transporte, validación y presentación e impedido sustituir la red en pruebas. (2) Reutilizar el DTO como `Incident` habría permitido que un `payload: null` o campos corruptos entraran al dominio. (3) Introducir un cliente de aplicación con una unión de resultados y un nuevo contenedor DI habría aislado más estados, pero duplicado el puerto existente y aumentado la migración de casos de uso y pruebas acumuladas.

**Decisión.** Conservar `IncidentRepository` como puerto de dominio y los casos de uso de Application. `HttpIncidentRepository` implementa lista, detalle y creación; `FetchIncidentTransport` encapsula `fetch` y timeout; `parseRemoteResource` valida el sobre y `mapDtoToIncident` convierte sólo DTO completos. `App.tsx` inyecta el HTTP en ejecución normal y el fake en tests de base. `ApplicationFailure` transmite códigos y mensajes controlados sin filtrar objetos de red. La UI mantiene estados de carga, vacío y error.

**Consecuencias y costo.** Las pruebas sustituyen el transporte sin Internet y comprueban que un DTO corrupto no llega a pantalla. Los fallos de timeout, contrato, red, HTTP 500 y payload nulo se distinguen mediante códigos o razones seguras que los casos de uso preservan y la UI presenta. La lista descarta elementos individuales inválidos; la creación sólo preserva la clave de idempotencia cuando el mismo caller la vuelve a proporcionar. El costo es un mapper y archivos de transporte adicionales, además de mantener el fake para pruebas históricas. No se introduce autenticación real, sincronización ni reintento automático.

**Verificación.** `course-tests/week-05-client.test.tsx`, `course-tests/week-05-transport-validation.test.tsx`, `course-tests/week-05-ui-failure.test.tsx` y `course-tests/public/week-05.test.ts` ejercen parser, mapper, transporte, repositorio y pantalla con respuestas controladas. `npm run test:architecture` y `npm run check:architecture` comprueban los límites de imports. Los resultados de entrega W05 se indexan en `reports/week-05/` con el SHA evaluado.

## Anexo de Semana 06 — sesión, generaciones y entrega reproducible

**Contexto.** La revisión de #39 reprodujo ocho fallos en el código recibido:
identidad saliente incorrecta, autorización fixture desde anonymous, replay
bajo otra identidad, refresh obsoleto aceptado, envío expirado, restauración
inválida, carrera restore/logout y fallo de borrado oculto. Los resultados
originales permanecen en `reports/week-06/validation/` y en el historial.
El usuario autorizó corregirlos y terminar la validación de entrega.

**Alternativas.** (1) Renovar por solicitud produce refresh duplicados y carreras.
(2) Una promesa global sin generación no distingue una sesión nueva de una
respuesta antigua. (3) Una política por generación, una promesa compartida y
persistencia serializada permite limitar replays e invalidar respuestas viejas.
Elegimos la tercera, conservando inyección manual y los puertos existentes.

**Decisión implementada.** `RefreshCoordinator` en Application comparte la
política de generación, cancelación y replay con `DefaultSessionController` y
el adaptador público `coordinateRefresh`. El controlador mantiene reloj,
identidad y tokens; persiste antes de publicar authenticated; login/logout
invalidan la generación anterior; restore valida schema, strings, rol y
expiración finita y comprueba generación después de la lectura. Las escrituras
y borrados se serializan; un error de clear se propaga como falla controlada,
no como purga exitosa. La UI restaura al arrancar, presenta fallos, permite
reintentar el cierre y oculta datos privados al perder sesión.

`SessionTransportDecorator` sustituye las cabeceras de identidad sin distinguir
mayúsculas/minúsculas. Consulta expiración, comparte refresh antes del envío,
comprueba generación antes de aceptar respuestas o replay y conserva cuerpo y
clave de idempotencia. Un segundo 401 invalida sesión; 403 no renueva. Un 401
retardado del token anterior reutiliza la renovación ya completada. La UI usa
la versión remota preservada por el mapper; las fixtures antiguas del fake
pueden carecer de versión y no autorizan una acción versionada.

`AuthenticatedIncidentTransport` se conserva como demostración histórica de
la actividad separada #35, fuera del grafo de la app; sus resultados no
sustituyen la prueba del decorador compuesto. No se elimina trabajo anterior.

**Consecuencias y límites.** Puertos inyectables y reloj controlado permiten
pruebas deterministas; generaciones, cola de almacenamiento y estados de UI
requieren pruebas adicionales de carreras y fallas. El backend sigue siendo
sintético: token fixture, sin expiración real del servidor ni rotación
productiva completa. SecureStore se prueba detrás del SDK sustituido, sin
certificar cifrado físico ni un APK. GPS y cola offline siguen fuera de W06.

**Verificación.** `npm run check:week-06-readiness` conserva las ocho aserciones
originales. Las seis suites W06 incluyen pruebas del grafo real compuesto por
`App.tsx` y su UI contra el backend loopback, versiones sucesivas, errores
visibles, limpieza, restore, escrituras retenidas y respuestas obsoletas.
Los logs y SHA de validación final se indexan en
`reports/week-06/final-validation/index.json`. Los documentos W02–W05 y sus
observaciones históricas conservan procedencia; los workflows revalidan el
checkout desechable y comprueban tags históricos en su propia versión, sin
mover etiquetas ni reemplazar SHA como atajo.

## Anexo W08 — contratos del baseline #42 (21-10-2026)

**Contexto.** El kit W08 exige datos y cola durables, migración recuperable y
conflicto por reasignación. La app todavía compone únicamente el flujo online
W06: no tiene adaptador local ni motor sync. `SyncRecord` estaba declarado en
el módulo de evaluación, que no debe convertirse en dependencia de Application.

**Alternativas.** (1) Usar memoria global o SecureStore como cola: la primera
no sobrevive al proceso y el segundo está destinado a secretos, sin la
transacción conjunta de snapshot/cola requerida. (2) Introducir una DB y
conectar toda la app en el baseline: mezclaría #42 con #43–#45 y bloquearía
publicar las interfaces antes de implementar. (3) Publicar puertos mínimos y
fixtures, verificar capacidad del proveedor y reservar implementación para
sus issues. Se elige la tercera.

**Decisión presente.** `LocalWorkspace`, `PendingOperationStore` y
`LocalIncidentSnapshot` son contratos en Application. `commitChange` exige
confirmar snapshot y operación juntos; notas y referencias durables conservan
autor e identidad; tokens permanecen en el puerto SecureStore W06.
`SyncRecord` pasa como tipo a Domain y se reexporta desde evaluación,
conservando su forma pública. No hay adaptador local ni nueva dependencia en
`App.tsx`. El diagrama muestra estos contratos sin presentarlos como flujo activo.

**Proveedor para #43.** El manifiesto de Expo 57 instalado recomienda
expo-sqlite `~57.0.1`; se inspecciona la implementación publicada 57.0.4 y su
transacción exclusiva con rollback. Un probe SQLite de Node comprueba
reapertura entre procesos y reversión de esquema/datos/versiones sobre disco.
Se selecciona ese proveedor para Android; la instalación y comprobación del
adaptador Expo nativo siguen pendientes en #43. No se equipara el probe del
motor con una prueba de la app o del SDK nativo.

**Consecuencias y comprobación.** La preparación permite construir pruebas en
paralelo con una factory de recursos aislados y puntos de falla dentro de la
transacción; el costo es mantener el contrato al implementar adaptadores.
Los tres tests del baseline comprueban fixtures/lifecycle, no migración de la
app. `test:week-08:public` conserva los fallos de los stubs hasta #44. Las
observaciones y SHA W08 se indexan en `reports/week-08/baseline/validation.json`;
los reportes/evidencias W02–W06 conservan su procedencia histórica sin reescribir
resultados sobre otro SHA. Alcance, esquema acordado y límites del proveedor:
`docs/week-08-baseline.md`.

## Anexo W08 — motor compartido #44 (21-10-2026)

**Contexto.** #42 dejó contratos y fixtures; #44 requiere merge/dedupe reales
conservando las firmas evaluables. La reasignación remota y el inicio local no
pueden combinarse recursivamente dentro de `work` sin romper autorización.

**Alternativas.** Last-write-wins por versión/reloj perdería una intención o
una asignación. Merge recursivo de subcampos produciría un estado iniciado por
un actor que no lo solicitó. Rechazar toda concurrencia impediría cambios
independientes válidos. Elegimos merge de tres vías por campo completo con
comparación JSON estructural, conflictos ordenados y decisión explícita.

**Decisión implementada.** `resolveSync` y `deduplicateOperations` viven en
Application; el primero importa únicamente el tipo `SyncRecord` de Domain.
Evaluación reexporta exactamente esas funciones; `App.tsx/createGraph` las
expone como `syncEngine`. No hay dos algoritmos ni dependencia de Application
en evaluación. El motor se invoca desde el grafo real en la suite de composición;
la UI todavía no consume sync y el flujo con workspace/envío sigue en #45.
La política, precondiciones y límites están en `docs/sync-policy.md`.

**Consecuencias.** El merge conserva entradas y trata `work` como indivisible;
los valores anidados retornados se consumen readonly. Dedupe conserva el primer
objeto/orden por ID, sin garantizar idempotencia remota. El beneficio es una
regla determinista reutilizable sin HTTP o almacenamiento; el costo es retener
base/local/remoto y resolver explícitamente los conflictos. Una confirmación
de servidor será precondición del retiro de cola en #45. No hay reintentos,
persistencia, resolución UI ni implementación de `planRetry` W09 en este motor.

**Verificación.** `test:week-08:sync` incluye las suites de comportamiento y
composición; `test:week-08:public` conserva los tres tests oficiales intactos.
El agregado W08 y su workflow ejecutan la suite nueva sin omitir gates. Los
resultados reales y su SHA se registran en `reports/week-08/sync/`; el histórico
del baseline conserva los fallos observados antes de implementar #44.
