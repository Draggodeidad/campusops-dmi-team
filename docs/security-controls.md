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

| Control | Decisión y alcance real | Comprobación |
|---|---|---|
| Almacenamiento seguro | `SessionSecretStore` declara guardar, leer y borrar; `ExpoSecureSessionSecretStore` usa `expo-secure-store` con una clave fija y accesibilidad de Keychain limitada al dispositivo desbloqueado. No se guarda ninguna sesión mientras no exista login. | `course-tests/week-04-storage.test.ts` prueba llamadas, lectura nula, borrado, entrada vacía y fallas nativas con un proveedor sustituido. |
| Errores seguros | Los casos de uso de incidencias y el adaptador de almacenamiento convierten fallas técnicas en `ApplicationFailure` con códigos y mensajes constantes. No adjuntan error crudo ni `cause`; la UI sigue mostrando mensajes genéricos. | `course-tests/week-04-errors.test.tsx` inyecta errores con una cadena sintética sensible y confirma que no aparece en la UI. |
| Secretos de configuración | `.env.*` queda ignorado, con excepción de `.env.example`. La URL `EXPO_PUBLIC_COURSE_BACKEND_URL` es configuración pública; nunca debe recibir tokens. No se detectaron secretos de alta confianza versionados en la baseline, por lo que no se eliminó una credencial existente. | `git check-ignore` comprueba las variantes y `npm run scan:secrets` conserva el gate previo. |
| Dependencias | Se instaló el módulo compatible con Expo 57 y se actualizaron versiones transitivas vulnerables dentro de sus rangos existentes. | `npm ci` y `npm audit --json` terminaron con cero vulnerabilidades reportadas en el registro consultado. |

La elección de `expo-secure-store` evita guardar un futuro token en preferencias comunes. En Android utiliza almacenamiento cifrado con Android Keystore; el plugin excluye automáticamente sus entradas del respaldo Android cuando no existe configuración de respaldo propia. En iOS utiliza Keychain. [Referencia del proveedor](https://docs.expo.dev/versions/v54.0.0/sdk/securestore/). El test unitario verifica el uso del proveedor; el bundle Expo no demuestra por sí solo el cifrado en un dispositivo ni una instalación Android.

Riesgo residual: el secreto puede estar en memoria durante su uso; un dispositivo comprometido o un log futuro fuera de estas rutas puede exponerlo. Keychain en iOS puede persistir después de reinstalar la app. Una falla o indisponibilidad del almacén debe impedir que se finja una sesión guardada. Falta probar el ciclo completo de sesión en Semana 06. `npx expo install --check` señaló recomendaciones de actualización de Expo, React Native, ESLint Expo y Jest Expo del stack ya fijado; no se cambiaron versiones ajenas al control.

Comprobación de este aporte con Node 22.22.0: `make feedback` terminó con código 0, 9 suites y 19 pruebas aprobadas, escáner sin hallazgos, auditoría sin vulnerabilidades reportadas y bundle Android exportado. `make verify-week-04` terminó con estado `pass`. `make public-test-week-04` terminó con estado `fail`: aún faltan `secret-scan.json`, `negative-tests.json`, `engineering.json`, la evidencia individual consolidada y la implementación pública de `redactForTelemetry`. Ese fallo identifica trabajo pendiente de otros integrantes; no se desactivó el control.

## Trabajo y evidencia de otros integrantes

- Integrante 2: `redactForTelemetry`, conexión a diagnóstico y pruebas de anidamiento e inmutabilidad. Pendiente de su aporte.
- Integrante 3: `reports/week-04/secret-scan.json`, `reports/week-04/negative-tests.json`, trazabilidad de AC-01..AC-05, consolidación de evidencia y tag final. Pendiente de su aporte.

La existencia de un puerto de almacenamiento antes del login no acredita protección de una sesión activa. La autorización por perfil, la persistencia de fotos y la resolución de conflictos permanecen en sus hitos respectivos.
