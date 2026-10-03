# Contrato de trabajo W05 — incidencias remotas

Estado: baseline de la issue #27 para los propietarios de #28–#30. Las firmas de abajo fijan el acuerdo inicial para implementar el cliente y sus pruebas; #28 mantiene este documento cuando la implementación concrete los tipos. La app todavía usa `FakeIncidentRepository`. No son evidencia de que el flujo remoto funcione.

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

`IncidentClientPort` es la frontera de Application; el adaptador HTTP y `IncidentTransport` viven en Infrastructure. El transporte se inyecta al adaptador para ensayar respuestas y errores sin Internet. La composición para cambiar del fake al cliente queda en `App.tsx`, una vez que el cliente esté implementado. Los errores del cliente son un tipo separado de `ParseResult`: `contract` describe un sobre o cuerpo corrupto; `payload_unavailable` describe el `null` permitido que no puede mapearse al dominio; `timeout`/`network` describen fallas técnicas; `server` conserva sólo el código HTTP. Un `500` no se convierte en `contract`. Un `404` de detalle produce `ok: true, value: null`. Se capturan rechazos y abortos del transporte y se traducen sin propagar mensajes de proveedor a la UI.

## Escenarios que deben demostrar los propietarios del cliente y las pruebas

- Éxito de lista, detalle y creación; lista vacía y detalle ausente.
- Sobre válido con `payload: null` frente a sobre u objeto JSON inválido.
- `slow` con timeout controlado, `server_error` 500, falla de red y respuesta de creación perdida tras guardarse; el reintento usa la misma clave.
- Stub de `IncidentTransport` determinista y variantes del backend local, con predicción, comando, resultado observado y logs sanitizados.

Los resultados se registrarán en `reports/week-05/contract-tests.json` y `reports/week-05/failure-matrix.json` cuando esas pruebas existan y se hayan ejecutado. No se crean reportes de entrega con resultados supuestos.
