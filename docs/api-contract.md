# Contrato de trabajo W05 — incidencias remotas

Estado: contrato implementado en Week 05. `App.tsx` compone `HttpIncidentRepository` con `FetchIncidentTransport` para la ejecución normal; en pruebas sin `EXPO_PUBLIC_USE_HTTP` conserva el repositorio fake. Las firmas de diseño más abajo documentan el acuerdo inicial; la sección «Contrato implementado» precisa el código real y sus límites.

## Frontera publicada y modelo interno

`parseRemoteResource(input: unknown): ParseResult`, en `src/course-evaluation/index.ts`, conserva exactamente la firma y el resultado publicado en `src/course-evaluation/contracts.ts`: `{ ok: true, value: { id, version, status, payload } }` o `{ ok: false, error: 'contract' }`. Acepta `payload` como objeto JSON o `null`, valida ID y estado no vacíos y versión entera no negativa; ignora campos futuros del sobre. No interpreta errores HTTP ni crea una incidencia del dominio. Su implementación corresponde al trabajo de cliente W05, no a este baseline.

El DTO de lectura tiene `{ id: string, version: number, status: string, payload: object | null }`. El payload de incidencia utilizado por el backend didáctico incluye `category`, `description`, `location`, `reporterId`, `assignedTechnicianId`, `priority`, `notes`, `evidence` e `history`. La lista llega como `{ items: DTO[] }`, el detalle como un DTO y la creación como `{ incident: DTO, operationId: string, duplicate: boolean }`. El cliente valida la forma de cada respuesta y los valores necesarios para construir `Incident` (`src/domain/incidents/Incident.ts`): `id`, `title`, `description`, `category`, `status`, `locationLabel`. `title` es un dato de presentación que debe derivarse explícitamente de un campo válido o de una regla de la aplicación; el servidor no lo envía. Una incidencia con `payload: null` es un sobre válido, pero no contiene categoría, descripción ni ubicación para construir `Incident`; se representa como dato no disponible, sin inventarlos. La lista vacía `{ items: [] }` es éxito con cero incidencias.

## Solicitudes

| Operación | Solicitud | Respuesta esperada |
|---|---|---|
| Lista | `GET /v1/incidents` | `200 { items: DTO[] }` |
| Detalle | `GET /v1/incidents/:id` con ID codificado como segmento | `200 DTO`; `404` equivale a ausencia, no a DTO inválido |
| Creación | `POST /v1/incidents`, JSON `{ category, description, location }`, encabezado `Idempotency-Key` estable | `201 { incident: DTO, operationId, duplicate: false }`; un replay idéntico puede responder `200` y `duplicate: true` |

Se envían los encabezados sintéticos del backend didáctico descritos en `docs/CAMPUSOPS_API.md`. No se registran valores de autorización, actor, descripción, ubicación ni cuerpo de respuesta. Creación sólo corresponde al Reportante; el servidor debe aplicar esa autorización. `Idempotency-Key` se conserva cuando se reintenta la misma operación y no se reutiliza con otro contenido.

## Firmas acordadas para la implementación

El contrato de aplicación que consumirá la UI expone tres operaciones y resultados discriminados. Estas son firmas de diseño; el propietario del cliente las materializará junto con casos de uso y pruebas sin cambiar el `ParseResult` publicado.

```ts
type CreateIncidentInput = Readonly<{
  category: IncidentCategory;
  description: string;
  locationLabel: string;
  operationId: string;
}>;

type IncidentClientError =
  | Readonly<{ kind: 'contract' | 'payload_unavailable' | 'timeout' | 'network' }>
  | Readonly<{ kind: 'server'; status: number }>
  | Readonly<{ kind: 'unauthorized' | 'forbidden' | 'rejected' }>;
type IncidentClientResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; error: IncidentClientError }>;

interface IncidentClientPort {
  list(): Promise<IncidentClientResult<readonly Incident[]>>;
  detail(id: string): Promise<IncidentClientResult<Incident | null>>;
  create(input: CreateIncidentInput): Promise<IncidentClientResult<Incident>>;
}

interface IncidentTransport {
  send(request: Readonly<{
    method: 'GET' | 'POST'; path: string;
    headers: Readonly<Record<string, string>>;
    body?: string; timeoutMs: number;
  }>): Promise<Readonly<{
    status: number; headers: Readonly<Record<string, string>>; bodyText: string;
  }>>;
}
```

Estas firmas eran una propuesta de #27. La implementación final usa `IncidentRepository` en Domain, casos de uso `GetIncidents`, `GetIncidentById` y `CreateIncident` en Application, y `HttpIncidentRepository` más `IncidentTransport` en Infrastructure. No existe `IncidentClientPort` ni una unión `IncidentClientResult` en el código. Un `404` de detalle retorna `null`; los fallos se lanzan como `ApplicationFailure` con código y mensaje controlados. El transporte se inyecta para ensayar respuestas y errores sin Internet.

## Contrato implementado

- `GET /v1/incidents` acepta `200 { items: DTO[] }`; `items: []` produce lista vacía. Cada elemento se valida con `parseRemoteResource` y `mapDtoToIncident`; los elementos no convertibles se omiten. El JSON o sobre de lista inválido produce `INCIDENTS_UNAVAILABLE`.
- `GET /v1/incidents/:id` codifica el segmento. `404` retorna `null`; `200` con sobre válido y `payload: null` produce `ApplicationFailure` con razón `payload_unavailable` porque faltan campos del dominio. La UI muestra que los datos no están disponibles, distinto de la ausencia por 404. Un sobre inválido produce `INCIDENT_UNAVAILABLE` con razón `contract`.
- `POST /v1/incidents` envía `{ category, description, location }` e `Idempotency-Key`. `CreateIncident` valida y recorta entradas antes del envío; el repositorio genera una clave cuando no se recibe una de al menos ocho caracteres. Una llamada posterior que represente el mismo reintento debe aportar explícitamente la misma clave. Se aceptan `200` o `201` con `incident` válido; la implementación no inspecciona aún `operationId` ni `duplicate` de la respuesta.
- `FetchIncidentTransport` usa `fetch` y `AbortController` con timeout por defecto de 5000 ms; su `TimeoutError` se convierte en `INCIDENT_TIMEOUT`. Otras fallas de transporte se convierten en `REMOTE_COMMUNICATION_ERROR`. Los `500` conservan los códigos `INCIDENTS_UNAVAILABLE`, `INCIDENT_UNAVAILABLE` o `CREATE_INCIDENT_FAILED` según la operación, con razón `server`. Las fallas de formato llevan razón `contract`. Los casos de uso preservan estas fallas seguras y la UI distingue timeout, contrato, servidor, red y `payload_unavailable` sin mostrar detalles del proveedor.
- La cabecera de actor y el token son fixtures sintéticos del backend didáctico. El cliente no emite logs de encabezados, respuestas ni valores de ubicación. No existe autenticación productiva, reintento automático ni cola offline en Week 05.

## Escenarios que deben demostrar los propietarios del cliente y las pruebas

- Éxito de lista, detalle y creación; lista vacía y detalle ausente.
- Sobre válido con `payload: null` frente a sobre u objeto JSON inválido.
- `slow` con timeout controlado, `server_error` 500, falla de red y respuesta de creación perdida tras guardarse; el reintento usa la misma clave.
- Stub de `IncidentTransport` determinista y variantes del backend local, con predicción, comando, resultado observado y logs sanitizados.

Los resultados observados se indexan en `reports/week-05/contract-tests.json` y `reports/week-05/failure-matrix.json`. Las pruebas usan el parser, mapper, repositorio, transporte y UI reales con entradas externas controladas. La disponibilidad de un servicio público no forma parte de esta validación.
