# CampusOps — starter público de Desarrollo Móvil Integral

Base técnica: Expo SDK 57, React Native 0.86, React 19, TypeScript estricto y Node.js 22. Este repositorio es el punto de partida del equipo; no contiene pruebas ocultas, respuestas, secretos ni lógica privada de calificación.

Lee `docs/CAMPUSOPS.md` (caso y alcance) y `docs/CAMPUSOPS_API.md` (contratos y variantes públicas). Semana 05 conecta lista, detalle y creación de incidencias al backend didáctico mediante `HttpIncidentRepository`. Las funciones de `src/course-evaluation/` se implementan en su semana correspondiente; las de hitos posteriores siguen pendientes.

El nombre es provisional. Se conservan slug e identificadores nativos existentes para no romper builds o instalación. Los fixtures del backend son públicos, ficticios y sólo para desarrollo; no equivalen a una autenticación de producción.

## Requisitos

- Node.js 22.22.0 (la versión esperada está en `.nvmrc`).
- npm, GNU Make y Git.
- Para Android nativo: JDK 17 y Android SDK con Platform 35, Build Tools 35 y NDK 27.1.12297006.
- Equipo de exactamente tres integrantes y repositorio público de GitHub, conforme a las instrucciones docentes.

## Inicio reproducible

```bash
nvm use
make setup
make feedback
```

Para desarrollo local:

```bash
make run-backend
make run
```

`make feedback` ejecuta la misma base pública del workflow: typecheck, lint, smoke test, auditoría crítica y bundle Android de Expo. Un resultado verde ofrece retroalimentación, pero la calificación final la determina una reproducción docente desde el SHA entregado y checks adicionales controlados por la materia.

## Semana 05: cliente de incidencias

En dos terminales, desde la raíz del repositorio:

```bash
make run-backend
make run
```

La app usa el backend en `http://10.0.2.2:4310` desde el emulador Android y `http://localhost:4310` en otras plataformas. El servidor conserva datos sintéticos en memoria. La app envía el actor didáctico `reporter-1` y el token público de prueba; no son credenciales de producción. Abre la lista, selecciona una incidencia para ver el detalle o usa «+ Reportar» para crear una con categoría, descripción y ubicación textual. Reiniciar el servidor restaura sus datos iniciales.

`docs/api-contract.md` describe solicitudes, DTO, conversión al dominio y fallas. El backend admite variantes mediante `X-Course-Scenario`: `success`, `nullable`, `malformed`, `slow` y `server_error` para esta semana. Las pruebas del cliente usan transporte o `fetch` controlado para reproducir estos caminos sin Internet público. `timeout_after_commit` representa una respuesta perdida tras crear: al reintentar la **misma** operación se debe conservar su clave de idempotencia; la interfaz actual no ofrece reintento automático.

Para observar una variante del backend local desde la terminal, con el servidor iniciado:

```bash
curl -i -H 'Authorization: Bearer course-valid-token' -H 'X-Course-Actor: reporter-1' -H 'X-Course-Scenario: success' http://127.0.0.1:4310/v1/incidents
curl -i -H 'Authorization: Bearer course-valid-token' -H 'X-Course-Actor: reporter-1' -H 'X-Course-Scenario: nullable' http://127.0.0.1:4310/v1/incidents
curl -i -H 'Authorization: Bearer course-valid-token' -H 'X-Course-Actor: reporter-1' -H 'X-Course-Scenario: malformed' http://127.0.0.1:4310/v1/incidents
curl -i -H 'Authorization: Bearer course-valid-token' -H 'X-Course-Actor: reporter-1' -H 'X-Course-Scenario: server_error' http://127.0.0.1:4310/v1/incidents
curl -i --max-time 1 -H 'Authorization: Bearer course-valid-token' -H 'X-Course-Actor: reporter-1' -H 'X-Course-Scenario: slow' http://127.0.0.1:4310/v1/incidents
```

El último comando fuerza un límite de un segundo en `curl` para reproducir una espera agotada ante la variante `slow` (observada en aproximadamente 1.2 segundos); la app usa `AbortController` con cinco segundos. El alcance de cada variante depende del endpoint, así que el comportamiento contractual se verifica además con las suites locales.

La lista vacía y el detalle ausente son estados válidos. Un sobre con `payload: null` es válido para el parser, pero no produce una incidencia con datos inventados: en detalle se muestra «datos no disponibles», distinto del 404. Un DTO inválido se descarta antes de entrar al dominio; un cuerpo JSON inválido, timeout, falla de red o HTTP 500 producen errores controlados. La interfaz distingue estas fallas con mensajes seguros; los códigos técnicos se comprueban en las pruebas del repositorio. No se registran cuerpos ni encabezados sensibles en logs.

Verificación de Week 05, en el orden de la guía oficial:

```bash
make setup
node node_modules/jest/bin/jest.js --no-watchman --cacheDirectory .jest-cache --ci --runInBand --runTestsByPath course-tests/week-05-client.test.tsx course-tests/public/week-05.test.ts course-tests/week-05-transport-validation.test.tsx course-tests/week-05-ui-failure.test.tsx
make feedback
make verify-week-05
make public-test-week-05
```

Los índices de resultados están en `reports/week-05/contract-tests.json` y `reports/week-05/failure-matrix.json`; la decisión técnica y aportes individuales, en `evidence/week-05/`. Tras el commit exclusivo de reportes/evidencias y el tag anotado `week-05-final`, ejecutar `make evidence-week-05`. Ese comando comprueba también que el tag apunte a `HEAD`. Los JSON de `verify`, `public-tests` y `failure` que produce el evaluador son diagnósticos del checkout, no equivalen a una calificación ni sustituyen los reportes redactados por el equipo.

## Actividades semanales

Cada paquete semanal agrega el enunciado dirigido al alumno, su test público y un workflow de feedback. Copia únicamente los archivos indicados por el paquete y ejecuta:

```bash
make verify-week-01
make public-test-week-01
make evidence-week-01
```

Sustituye `01` por la semana efectiva correspondiente. No edites tests o workflows para ocultar fallos. Consulta `docs/EVIDENCE_CONTRACT.md` y `docs/SUBMISSION.md` antes de entregar.

## Identidad, entrega y seguridad

- Configura en Git el nombre y correo aprobados en el roster; no compartas una sola identidad entre integrantes.
- La entrega semanal es el tag `week-XX-final`, su SHA completo y la URL del repositorio.
- No subas `.env`, tokens, credenciales, datos personales reales ni archivos de firma.
- El backend incluido es sintético y no contiene credenciales.
- Todo valor `EXPO_PUBLIC_*` queda expuesto al cliente y jamás debe contener secretos.
