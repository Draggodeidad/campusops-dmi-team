# Controles de seguridad y privacidad — Semana 04

## Controles implementados

| Control | Implementación verificada | Alcance actual |
|---|---|---|
| Almacenamiento protegido de secretos de sesión | `SessionSecretStore` define guardar, leer y borrar. `ExpoSecureSessionSecretStore` usa `expo-secure-store`, una clave fija y `WHEN_UNLOCKED_THIS_DEVICE_ONLY`; rechaza cadenas vacías y convierte fallas del proveedor en `ApplicationFailure`. | El puerto y adaptador existen, pero no hay login ni sesión activa conectados a la app. La prueba sustituye el módulo nativo; no mide cifrado en un dispositivo. |
| Errores de aplicación no reveladores | `GetIncidents`, `GetIncidentById` y el adaptador de SecureStore producen códigos y mensajes constantes; no propagan el error del proveedor como `cause`. | La UI de incidencias muestra mensajes genéricos. La prueba usa errores sintéticos que contienen una cadena sensible ficticia. |
| Redacción de telemetría | `redactForTelemetry` recorre recursivamente objetos y arreglos, normaliza claves ignorando mayúsculas, guiones y guiones bajos, reemplaza valores sensibles con `[REDACTED]` y no muta la entrada. Está exportada desde `src/course-evaluation/index.ts`. | Es una función disponible y probada; no encontramos un sumidero de logging de producción conectado en la app. No afirmamos que todos los logs futuros la invoquen automáticamente. |
| Exclusión de archivos de entorno | `.gitignore` excluye `.env` y `.env.*`, excepto `.env.example`. `EXPO_PUBLIC_COURSE_BACKEND_URL` es configuración pública de prueba, no un secreto. | El nombre `EXPO_PUBLIC_*` implica exposición al bundle; no se deben poner tokens ni claves allí. |
| Búsqueda de secretos | `tools/scan-secrets.py` busca claves privadas, tokens GitHub, claves AWS y nombres de variables `EXPO_PUBLIC_*` con nombres sensibles. El workflow W04 tiene `contents: read`, ejecuta verificación reproducible y conserva artefactos con `if: always()`. | El escáner aplica patrones de alta confianza y no acredita ausencia absoluta de secretos. En su ejecución actual reportada no encontró coincidencias. |

## Amenazas mitigadas

Relacionamos estos controles con las amenazas T1–T4 de [docs/threat-model.md](threat-model.md):

| Amenaza | Mitigación de Week 04 | Verificación y límite |
|---|---|---|
| T1 — Consulta de incidencias ajenas | Los errores de consulta no exponen el identificador o error privado al usuario. | `course-tests/week-04-errors.test.tsx` valida mensajes constantes. Esto no implementa autorización por actor ni permisos del backend. |
| T2 — Alteración de asignaciones | La redacción oculta `technicianId`, `assignedTechnicianId` y `assignmentHistory` antes de producir el objeto sanitizado. | `course-tests/week-04-telemetry.test.ts` verifica esos campos en una estructura anidada. No hay mutaciones ni autorización real de asignaciones en la app actual. |
| T3 — Filtración por logs o errores | `redactForTelemetry` oculta ubicación, coordenadas, fotos, evidencia, comentarios internos e identidad; los casos de uso y SecureStore no propagan mensajes crudos de fallas. | Las suites de telemetría y errores usan datos ficticios y comprueban el resultado. No existe un pipeline de telemetría de producción que permita afirmar una cobertura global. |
| T4 — Exposición de credenciales | El escaneo de patrones de alta confianza bloquea coincidencias; el adaptador de sesión usa SecureStore y no persiste valores vacíos; los errores de proveedor no exponen su mensaje. | El escaneo actual pasó sin hallazgos y las suites de almacenamiento/telemetría pasaron. No hay login ni secretos reales en los fixtures. |

## Evidencia asociada

- `reports/week-04/secret-scan.json` registra la herramienta, comando, alcance,
	exclusiones y salida observada del escaneo.
- `reports/week-04/negative-tests.json` relaciona las seis categorías de datos
	sensibles solicitadas con controles y pruebas negativas.
- `course-tests/week-04-storage.test.ts` verifica operaciones del adaptador,
	entrada vacía y fallas del proveedor con valores sintéticos.
- `course-tests/week-04-errors.test.tsx` confirma que el error de repositorio no
	aparece en mensajes ni en el árbol renderizado de UI.
- `course-tests/week-04-telemetry.test.ts` verifica redacción recursiva,
	normalización de nombres e inmutabilidad.
- `course-tests/public/week-04.test.ts` valida la redacción de datos de CampusOps.
- En la revisión actual, `typecheck` y lint terminaron sin errores; las cuatro
	suites de Week 04 ejecutadas juntas aprobaron 16 pruebas; el escáner informó
	`Secret scan passed: no high-confidence secrets found.`.
- Los archivos históricos `reports/week-04/verify.json` y
	`reports/week-04/public-tests.json` corresponden al SHA anterior
	`05266e43d9004c247cb5ce84eb041b99ba5c201a`. El primero registra el pase de
	verificaciones base; el segundo registra un fallo anterior a la integración de
	la implementación de telemetría. No los presentamos como resultado del HEAD
	actual `42bf03defaf422fa5240d04c3c003fef51527d96`.

## Riesgos residuales

- No existe autenticación ni autorización de usuario. La redacción de datos no
	impide consultar o modificar recursos sin permiso.
- SecureStore no está conectado a un flujo de sesión. Los tests usan un mock del
	proveedor nativo, por lo que no prueban Android Keystore, Keychain real,
	reinstalación ni compromiso del dispositivo.
- El secreto estará disponible en memoria mientras se use. iOS Keychain puede
	conservar valores entre reinstalaciones según las reglas del sistema.
- La sanitización debe aplicarse en cada punto de registro. La función por sí
	sola no protege un logger que la omita ni texto libre que no esté bajo una
	clave sensible reconocida.
- Aún no hay almacenamiento de fotografías, ubicación del dispositivo ni
	sincronización de asignaciones implementados. La prueba de redacción usa
	objetos sintéticos y no valida artefactos reales de esos flujos.
- El escáner de secretos puede omitir formatos no incluidos en sus expresiones
	regulares, secretos divididos/transformados y contenido binario o no UTF-8.

## Limitaciones actuales

El modelo de Week 03 describía la sanitización como futura en el SHA evaluado
entonces. La implementación y las pruebas actuales materializan ese control para
payloads pasados a `redactForTelemetry`; la amenaza original T3 sigue siendo
válida para cualquier ruta que no use esa función.

El escáner recorre recursivamente el árbol de trabajo, no sólo archivos
rastreados. Omite directorios `.git`, `.expo`, `node_modules`, `coverage`,
`dist`, `android` e `ios`; omite `.env.example` y extensiones de imagen, zip y
paquetes Android. Ignora archivos que no puede leer como UTF-8 y no informa un
inventario individual ni un conteo de archivos. Por ello, el pase sólo significa
que no encontró los patrones declarados dentro de su alcance.

El workflow de Week 04 instala dependencias, genera el bundle, ejecuta
`make verify-week-04` y `make public-test-week-04`, y sube evidencia incluso ante
fallas. La comprobación de evidencia final se reserva para `week-04-final`.
Este documento no afirma que la etiqueta final ya exista ni que se haya validado
un build nativo instalado en dispositivo.
