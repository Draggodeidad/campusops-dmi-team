# W09 — política de ubicación y resiliencia (#61)

## Alcance y proveedor

CampusOps conserva React Native/Expo/TypeScript y los flujos W06/W08. #61 añade
geocodificación por búsqueda textual explícita, caché y alternativa manual.
No añade GPS, permisos, navegación, seguimiento ni mapas offline. La política de
reintentos y respuesta perdida corresponde a #62; `planRetry` sigue pendiente.
La implementación no acredita entrega semanal, revisión humana ni aportes individuales.

Se elige **Photon**, servidor público `https://photon.komoot.io`, sin cuentas,
pagos ni claves. Su API `/api/?q=…&limit=1` devuelve GeoJSON. Se ofrece un
candidato para aceptar explícitamente, no una ubicación elegida automáticamente.
Infrastructure transforma `[longitude, latitude]` y componentes textuales;
Application valida etiqueta y coordenadas sin coerción ni valores inventados.

Fuentes oficiales consultadas el 27-10-2026:

- [Photon y condiciones del servidor público](https://github.com/komoot/photon):
  uso moderado, posible throttling/bloqueo, sin garantía de disponibilidad ni
  estabilidad. No publica una cuota numérica garantizada. Photon es Apache-2.0;
  no se incorpora su código ni se instala un servidor propio.
- [Contrato API](https://github.com/komoot/photon/blob/master/docs/api-v1.md).
- [Datos OpenStreetMap, atribución y ODbL](https://www.openstreetmap.org/copyright).
  La pantalla muestra Photon, © OpenStreetMap contributors, ODbL y su enlace.

Alternativas consideradas: Open-Meteo no necesita clave para uso educativo,
pero se centra en localidades/códigos postales; Nominatim público exige
identificación de aplicación, máximo agregado de una petición por segundo y
capacidad de cambiar servicio. Photon se adapta a búsqueda de lugares sin
sumar infraestructura de servidor. El costo es depender de un servicio público
sin SLA y aceptar que un campus ficticio normalmente no tenga coincidencias.

## Contratos, validación y caché

Se conservan los puertos #60: `LocationProvider.lookup(query): Promise<unknown>`,
`LocationCache.get/put`, `LocationConfiguration` y `ResilienceClock.now`.
`LookupIncidentLocation.execute({ query, manualLabel })` devuelve
`LocationLookupResult`; `cacheHit?: boolean` añade procedencia sin cambiar
`IncidentLocation` ni la firma pública de `selectIncidentLocation`.
Evaluación y UI usan la misma validación de Application. La referencia manual
es obligatoria y no vacía incluso al buscar. Consulta o configuración inválida
producen errores públicos de validación, sin red ni texto técnico sensible.

- Normalización única en Application:
  `query.normalize('NFC').trim().replace(/\s+/gu, ' ').toLowerCase()`.
- Valores iniciales inyectables: TTL **300000 ms**, timeout **1000 ms**.
  TTL finito >= 0; timeout finito > 0; TTL cero evita tanto get como put.
- Caché volátil LRU, máximo **50 entradas**; copias defensivas al leer y guardar.
  No se escribe en SQLite, archivos, SecureStore o telemetría. Cerrar el proceso
  elimina la caché. Sólo guarda resultados proveedor validados y tiempos epoch.
- Hit únicamente con resultado nuevamente validado, fuente provider, tiempos
  finitos y `storedAtMs <= now < expiresAtMs`. Vencimiento, reloj regresivo,
  corrupción o errores de caché producen miss; nunca se sirve stale. Errores,
  resultados manuales y etiquetas manuales no se cachean.
- Datos numéricos finitos, latitud [-90,90], longitud [-180,180], ceros incluidos;
  tipos incorrectos, campos ausentes o etiqueta vacía no autorizan coordenadas.

El caso de uso recibe proveedor/caché/reloj. `App.tsx` compone implementaciones
y permite sustituirlas en `createGraph`. El proveedor externo usa un
`FetchIncidentTransport` independiente: nunca recibe sesión, bearer token ni
identidad de actor. La UI no conoce adaptadores ni almacenamiento.

## Fallas y experiencia manual

Cada botón de búsqueda genera a lo sumo una petición; no hay autocomplete,
polling ni retries automáticos. Consultas simultáneas en el mismo adaptador
no generan peticiones adicionales. El transporte aborta por timeout y limpia
su temporizador, incluso si falla al leer el cuerpo.

| Situación | Resultado seguro y acción |
|---|---|
| Éxito válido | source provider; candidato requiere aceptación explícita. |
| Sin coincidencias/HTTP distinto de 200 | unavailable; continuar manualmente. |
| Timeout | timeout; continuar manualmente sin esperar al proveedor. |
| Desconexión/rechazo de transporte | offline; continuar manualmente. |
| 429 | rate_limited; Retry-After válido se publica en ms y bloquea nuevas peticiones hasta vencer. |
| JSON/GeoJSON incorrecto | invalid_response; continuar manualmente. |
| Campos ausentes | incomplete; continuar manualmente. |
| Coordenadas inválidas | invalid_coordinates; continuar manualmente. |
| Rechazo inesperado del puerto | unavailable, sin propagar la excepción original. |

Retry-After acepta segundos no negativos o fecha HTTP futura, incluido cero;
valores inválidos/no finitos no se publican. No se recorta una espera válida.
Sin Retry-After válido no se inventa un plazo; sólo una nueva acción explícita
puede volver a consultar. #62 decidirá los retries acotados y presupuesto de
operaciones; esta implementación no altera sus contratos ni las escrituras W08.

La búsqueda tiene su propio campo. El edificio/zona/referencia manual nunca se
envía al proveedor implícitamente. Se permite registrar mientras se busca o
tras cualquier falla. Editar la referencia, cambiar consulta o pulsar “Usar
ubicación manual” invalida la selección; cancelar, enviar, desmontar o cambiar
de sesión invalida respuestas tardías. Los errores no borran el formulario.

Se envía la etiqueta elegida como `locationLabel`, compatible con el backend
textual actual. Source/coordenadas son metadatos de selección durante el
formulario; no se afirma que el backend o SQLite los persistan.

## Privacidad, pruebas y ejecución externa

Usar exclusivamente consultas y referencias ficticias. No introducir PII,
ubicaciones reales ni coordenadas del dispositivo. El campo de búsqueda advierte
esta restricción; la app no puede demostrar que un texto arbitrario sea sintético.
La memoria temporal no ofrece clasificación automática de PII. No hay logs de
consulta, cuerpos, coordenadas, etiquetas del proveedor, errores originales o
cabeceras. Una búsqueda explícita transmite su consulta a Photon; no se afirma
controlar la retención del servidor externo.

```sh
nvm use
npm run test:week-09:location
npm run check:architecture
# Opt-in: red pública; excluido del runner determinista y de los gates automáticos.
npm run check:week-09-location-provider
# Presupuesto explícito para un entorno con latencia de proxy/Internet mayor:
npm run check:week-09-location-provider -- --timeout-ms=5000
```

El runner usa el TypeScript instalado para cargar en memoria los adaptadores
reales; no genera otra implementación. `--local` ejecuta fetch/aborto real sobre
HTTP loopback, incluyendo 429, cooldown y conexión rechazada. Las suites Jest
cubren contratos, caché, pantalla y composición con backend y disco W08 reales.
La suite reservada a #64 permanece libre.

El comando externo usa el proxy del entorno con Node 22.22.0 (`--use-env-proxy`),
consulta una fixture fija ficticia y desactiva caché. Su salida incluye sólo SHA,
fecha, proveedor, endpoint sin consulta, fixtureId, timeout, duración, código HTTP
y resultado sanitizado. No se vuelca el cuerpo ni una posible coincidencia real.
HTTP 200 sin coincidencias demuestra una ejecución del adaptador externo y
fallback; no demuestra éxito geográfico. El éxito con coordenadas se prueba con
fixtures sintéticas. Si no se obtiene respuesta externa válida, el comando falla
y la evidencia queda pendiente; una respuesta del doble nunca la sustituye.

Los resultados reproducidos del SHA técnico se conservan en
`reports/week-09/location/validation.json`, con logs y observación externa.
Las primeras exploraciones de red no se atribuyen al SHA final. Los fallos de
`planRetry` o entregables W09 pendientes se registran separadamente.

Ayuda material de IA: Codex asistió en implementación, pruebas y documentación.
La validación automática y la llamada externa quedan trazadas a comandos reales;
la revisión humana y evidencia individual del owner se registrarán cuando existan.
No se crea tag, se entrega en Classroom ni se cierra automáticamente #61.
