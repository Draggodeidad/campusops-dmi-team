# Controles de seguridad y privacidad — Semana 04

## Línea base observada

Revisión sobre `main` en `a3920ea55f273c1d42544f6df5c120661cc82088`, antes de incorporar el paquete de semana 4. Se usaron sólo datos sintéticos.

| Superficie | Estado observado | Riesgo relacionado |
|---|---|---|
| Incidencias | `FakeIncidentRepository` conserva tres incidencias en memoria y las pantallas muestran ubicación ficticia. No hay persistencia de incidencias, fotos ni sesión. | T1/T2: aún no existe autorización por actor; corresponde a hitos posteriores. |
| Sesión y almacenamiento | No hay login, token de sesión, `AsyncStorage` ni preferencias de aplicación. | T4: antes de agregar una sesión se necesita un límite de almacenamiento seguro. |
| Diagnóstico y errores | La UI muestra mensajes genéricos al fallar lista o detalle; `GetBackendStatus` devuelve `offline`. No se encontró telemetría de incidencias ni impresión del error crudo en `src/`. | T3: una ruta futura de diagnóstico podría exponer datos si imprime objetos completos. |
| Configuración | `.env` está ignorado; `.env.*` no lo estaba. `EXPO_PUBLIC_COURSE_BACKEND_URL` es una URL pública del backend didáctico, no una credencial. | T4: una variante de entorno podría añadirse a Git por accidente. |
| Reportes y CI | Existen reportes históricos en `reports/` y artefactos de Actions. El escáner revisa archivos de texto rastreados y rechaza patrones de alta confianza. | T3/T4: pruebas y reportes también pueden conservar datos sensibles. |

Baseline reproducible con Node 22.22.0: `npm run typecheck` terminó con código 0; `npm test -- --ci --runInBand` aprobó 7 suites y 12 pruebas; `npm run scan:secrets` informó `Secret scan passed: no high-confidence secrets found.`; `npm audit --omit=dev --json` informó dos paquetes afectados de severidad alta (`@xmldom/xmldom` y `js-yaml`) y ninguno crítico. El escáner no demuestra ausencia absoluta de secretos.

## Controles de este aporte

Pendiente de completar después de implementar y comprobar almacenamiento seguro, secretos, manejo de errores y dependencias. Esta sección sólo describirá trabajo verificado del autor de esta rama.

## Trabajo y evidencia de otros integrantes

- Integrante 2: `redactForTelemetry`, conexión a diagnóstico y pruebas de anidamiento e inmutabilidad. Pendiente de su aporte.
- Integrante 3: `reports/week-04/secret-scan.json`, `reports/week-04/negative-tests.json`, trazabilidad de AC-01..AC-05, consolidación de evidencia y tag final. Pendiente de su aporte.

La existencia de un puerto de almacenamiento antes del login no acredita protección de una sesión activa. La autorización por perfil, la persistencia de fotos y la resolución de conflictos permanecen en sus hitos respectivos.
