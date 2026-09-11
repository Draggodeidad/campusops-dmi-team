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

El cambio de proveedor queda localizado: una futura `ApiIncidentRepository` implementará el mismo contrato y se seleccionará en la raíz de composición. Esta decisión prioriza facilidad de prueba y costo bajo de sustitución, aceptando una cantidad moderada de archivos y composición manual.

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

- Incorporar `ApiIncidentRepository` cuando el hito requiera backend real.
- Añadir puertos y adaptadores de sesión, persistencia y ubicación en sus semanas correspondientes.
- Introducir DTO/mappers sólo si los contratos remotos divergen del dominio.
- Sustituir la composición manual por un módulo o contenedor cuando su tamaño y ciclo de vida lo justifiquen.
