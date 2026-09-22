# Modelo de amenazas inicial — Semana 03

## Introducción

Elaboramos este modelo sobre el estado comprobado de CampusOps al cierre de la
Semana 03. El producto es una aplicación React Native con Expo y TypeScript. La
implementación actual muestra incidencias sintéticas mediante una lista y un
detalle; `FakeIncidentRepository` es in-memory y `CourseBackendHealthAdapter`
consulta únicamente la salud del backend didáctico. No afirmamos que exista
autenticación, autorización, persistencia, GPS, carga de fotografías ni un
backend de incidencias implementados en la aplicación actual.

El alcance de esta semana es proteger el código, la configuración y la cadena de
comprobación, y dejar identificados los riesgos de los flujos que el producto
deberá implementar. Usamos únicamente fixtures y ubicaciones ficticias.

## Metodología de priorización

Usamos una matriz cualitativa de probabilidad e impacto. La probabilidad puede
ser **Baja**, **Media** o **Alta**; el impacto puede ser **Bajo**, **Medio** o
**Alto**. La prioridad resulta de combinar ambos factores: Baja para riesgos
Bajo/Baja, Media para una dimensión Media, Alta para Alta probabilidad o Alto
impacto, y Crítica cuando una exposición puede comprometer secretos reutilizables
fuera de la aplicación.

La prioridad describe el riesgo actual, no la existencia de una funcionalidad.
Cuando un control pertenece a una semana posterior lo marcamos como **Futuro**
y no lo presentamos como protección disponible hoy.

## Activos

| Activo | Descripción | Propietario lógico | Sensibilidad | Impacto ante compromiso |
|---|---|---|---|---|
| Incidencias | Identificadores, descripción, categoría, estado y ubicación textual de un reporte. Hoy existen fixtures in-memory. | Coordinación del campus ficticio | Media | Consulta o modificación indebida y pérdida de integridad operativa. |
| Sesiones / identidad | Actor, perfil y ciclo de sesión previstos por el contrato didáctico; no están implementados en la app actual. | Servicio de identidad del proyecto | Alta | Suplantación, acceso a incidencias ajenas y acciones con otro perfil. |
| Fotografías | Evidencias adjuntas previstas para incidencias; hoy no hay captura ni almacenamiento. | Reportante o técnico, según la evidencia | Alta | Exposición visual, ubicación implícita o datos personales en una imagen. |
| Ubicación | Etiqueta de lugar y futuras coordenadas; el modelo actual sólo tiene etiquetas sintéticas en incidencias. | Reportante y coordinación | Alta | Revelación de zonas sensibles o correlación de actividades. |
| Asignaciones | Relación entre una incidencia y el técnico responsable, prevista por el contrato. | Coordinador | Alta | Alteración de responsabilidades, acceso indebido o pérdida de trazabilidad. |
| Credenciales | Tokens, claves privadas y valores sensibles de configuración. No se incluyen credenciales reales. | Equipo y mantenedores del repositorio | Crítica | Acceso a repositorios, servicios o datos fuera del proyecto. |
| Configuración | Variables como `EXPO_PUBLIC_COURSE_BACKEND_URL`, scripts npm y workflow. | Equipo de desarrollo | Media | Desvío de endpoints, ejecución no reproducible o exposición accidental. |
| Logs | Salidas de pruebas, CI y diagnósticos. Actualmente se conservan resultados de herramientas, no telemetría de producción. | Equipo de desarrollo | Media | Divulgación de tokens, identificadores o datos de incidencias. |
| Evidencia técnica | Reportes JSON, pruebas, commits y documentación que sustentan la entrega. | Equipo docente y equipo CampusOps | Media | Pérdida de auditabilidad o afirmaciones de seguridad no reproducibles. |
| Artefactos de CI/CD | Paquete Expo, reportes y artefactos publicados por GitHub Actions. | Equipo y repositorio GitHub | Media/Alta | Distribución de código o resultados contaminados, o filtración de secretos. |

## Fronteras de confianza

| Frontera | Datos que cruzan | Riesgo y tratamiento actual |
|---|---|---|
| Usuario ↔ Aplicación móvil | Entradas de descripción, selección de incidencia y, en hitos futuros, sesión, fotos y ubicación. | La UI actual presenta datos sintéticos; no autentica ni autoriza al usuario. No tratamos ocultar botones como control de seguridad. |
| UI ↔ Application | Acciones de consulta, identificadores de incidencia y resultados de lista/detalle. | La UI recibe casos de uso inyectados y no importa Infrastructure; `test:architecture` y `check:architecture` verifican el límite. |
| Application ↔ Domain | Contratos `IncidentRepository`, entidades `Incident` y resultados de casos de uso. | El dominio no depende de React Native, HTTP ni persistencia; la dirección de dependencias se comprueba automáticamente. |
| Application ↔ Infrastructure | Solicitudes a puertos y respuestas de repositorios/adaptadores concretos. | Infrastructure implementa contratos; el fake es determinista y el adaptador de salud encapsula `fetch`. No existe aún un repositorio API de incidencias. |
| Aplicación ↔ Backend/API | La URL de salud y, en el contrato didáctico, futuros tokens, actor, DTO, acciones e idempotency keys. | El único acceso actual es `GET /health` mediante `CourseBackendHealthAdapter`. Las reglas de visibilidad, rol y asignación del contrato aún no son una autorización implementada en la app. |
| Repositorio GitHub ↔ GitHub Actions | Código, lockfile, workflow, variables públicas y reportes. | El workflow usa `permissions: contents: read`, instala con `npm ci` y conserva reportes. Una revisión de cambios y la protección de secretos siguen siendo necesarias. |
| GitHub Actions ↔ Dependencias externas | Paquetes npm, acciones `checkout`, `setup-node`, `upload-artifact` y el registro npm. | `package-lock.json`, typecheck, lint, auditoría crítica y bundle reducen deriva; una dependencia comprometida sigue siendo riesgo residual. |

## Flujo de datos

El flujo ejecutable actual es `CampusOpsApp → GetIncidents/GetIncidentById →
IncidentRepository ← FakeIncidentRepository`. La raíz `App.tsx` construye e
inyecta dependencias. El flujo separado de salud es
`GetBackendStatus → BackendHealthPort ← CourseBackendHealthAdapter →
courseBackend.ts → GET /health`.

Los datos de incidencias que cruzan la UI son sintéticos y no se escriben en
almacenamiento. Los flujos de sesión, fotografías, ubicación, asignación,
sincronización y autorización están documentados como alcance del producto o
contrato didáctico, pero no se consideran controles actuales.

## Matriz de amenazas

### T1 — Consulta de incidencias ajenas

- **Descripción:** un actor obtiene el detalle o la lista de una incidencia que no le corresponde.
- **Activo afectado:** incidencias, ubicación y posibles fotografías.
- **Escenario de ataque:** un cliente modifica un identificador o un perfil enviado al servicio y solicita una incidencia de otro reportante o una asignación ajena.
- **Probabilidad:** Media.
- **Impacto:** Alto.
- **Prioridad:** Alta.
- **Justificación:** el contrato define visibilidad por actor, pero la app actual no tiene sesión ni autorización real; la futura integración podría confiar indebidamente en datos del cliente.
- **Control mitigante:** autorización por actor, rol y asignación en el servicio; validación de DTO y pruebas negativas de contrato. La arquitectura por capas limita el acceso directo de UI a proveedores, pero no reemplaza autorización.
- **Estado del control:** Futuro. La separación de capas es existente; la autorización y sus pruebas pertenecen a semanas posteriores.
- **Método de verificación:** probar reportante, técnico y coordinador contra `/v1/incidents` y `/v1/incidents/:id`, incluyendo un caso de incidencia no visible.
- **Comando reproducible:** `npm test -- --ci --runInBand course-tests/public/week-03.test.ts` verifica el alcance de esta semana; las pruebas de autorización del contrato aún no existen en el árbol actual.
- **Resultado esperado:** esta semana pasan las pruebas públicas de workflow/modelo; cuando se implemente autorización, una consulta no visible debe responder rechazo sin datos.
- **Riesgo residual:** alto hasta implementar sesión, autorización real y pruebas negativas; los fixtures actuales no demuestran control de acceso.

### T2 — Alteración de asignaciones

- **Descripción:** un usuario cambia el técnico asignado o modifica una incidencia reasignada sin permiso.
- **Activo afectado:** asignaciones, estado e historial de incidencias.
- **Escenario de ataque:** un técnico envía una acción con otro `technicianId`, o un cambio offline antiguo sobrescribe una reasignación posterior.
- **Probabilidad:** Media.
- **Impacto:** Alto.
- **Prioridad:** Alta.
- **Justificación:** una asignación incorrecta cambia quién puede trabajar el caso y puede ocultar la trazabilidad; además, el repositorio actual no ejecuta acciones ni conflictos.
- **Control mitigante:** autorización server-side, `baseVersion`, `Idempotency-Key`, detección de conflicto y preservación de historial, según el contrato público.
- **Estado del control:** Futuro. Hoy sólo existe el límite arquitectónico y el fake de lectura.
- **Método de verificación:** prueba de actor/asignación incompatible, versión obsoleta, repetición idempotente y conflicto de reasignación.
- **Comando reproducible:** `npm run test:architecture` comprueba el límite actual; no existe todavía un comando local que pruebe la acción de asignación real.
- **Resultado esperado:** el árbol actual no tiene violaciones de arquitectura; una futura acción no autorizada debe devolver `403` o `409` sin mutar el recurso.
- **Riesgo residual:** alto por ausencia de mutaciones, persistencia, control de concurrencia y autorización ejecutable.

### T3 — Filtración de datos mediante logs

- **Descripción:** una salida de diagnóstico o artefacto registra tokens, contraseñas, ubicación, fotografías, comentarios o historial de asignaciones.
- **Activo afectado:** logs, credenciales, ubicación, fotografías y evidencia técnica.
- **Escenario de ataque:** un objeto de respuesta se imprime completo durante una falla y el log queda disponible en CI o en un reporte.
- **Probabilidad:** Media.
- **Impacto:** Alto.
- **Prioridad:** Alta.
- **Justificación:** CI conserva artefactos y una filtración persistente puede ampliar el alcance de un incidente; la sanitización de telemetría está definida para una semana posterior, no implementada hoy.
- **Control mitigante:** permitir sólo campos técnicos como `incidentId`, `correlationId`, `status`, `attempt` y `durationMs`; redactar credenciales, identidad, ubicación, fotos y texto libre antes de registrar.
- **Estado del control:** Futuro. El alcance y la lista de campos están documentados en `CAMPUSOPS_API.md`; no hay sanitizador actual.
- **Método de verificación:** pruebas negativas con objetos anidados que comprueben que las claves sensibles no aparecen y revisión de artefactos de CI.
- **Comando reproducible:** `npm run lint` y `npm run typecheck` validan el código actual, pero no prueban sanitización porque esa función aún no existe.
- **Resultado esperado:** no hay errores de lint ni tipos en el estado actual; una futura prueba debe demostrar que los valores sensibles se sustituyen por `[REDACTED]`.
- **Riesgo residual:** alto para futuras integraciones hasta implementar y probar la sanitización.

### T4 — Exposición de credenciales

- **Descripción:** una clave privada, token o variable pública sensible llega al repositorio o a un artefacto de CI.
- **Activo afectado:** credenciales, configuración y artefactos de CI/CD.
- **Escenario de ataque:** un commit agrega una clave con formato reconocible o un nombre `EXPO_PUBLIC_*` sensible; el workflow continúa y publica el resultado.
- **Probabilidad:** Media.
- **Impacto:** Alto.
- **Prioridad:** Crítica.
- **Justificación:** una credencial reutilizable puede permitir acceso fuera de CampusOps y el daño no depende de que la app actual tenga backend de negocio. Por eso atendemos primero esta amenaza.
- **Control mitigante:** `tools/scan-secrets.py` detecta claves privadas, tokens GitHub, claves AWS y nombres públicos sensibles; `make feedback` lo ejecuta mediante `make verify`; CI tiene `contents: read`, no ignora errores y sube reportes con `if: always()`.
- **Estado del control:** Implementado esta semana. La corrección del failure path retiró la fixture sintética sin debilitar las reglas.
- **Método de verificación:** introducir temporalmente una fixture sintética con patrón detectado, comprobar salida distinta de cero y confirmar después el estado limpio. No se usó una credencial real.
- **Comando reproducible:** `python tools/scan-secrets.py` (en este entorno Windows requiere Python instalado); en CI se ejecuta `make feedback` y localmente está registrado en `reports/week-03/security.json`.
- **Resultado esperado:** una coincidencia produce `Potential secrets found` y código distinto de cero; el árbol corregido produce `Secret scan passed: no high-confidence secrets found.`
- **Riesgo residual:** el escáner es regex de alta confianza y no detecta secretos arbitrarios; todavía se requiere revisión humana, rotación si alguna credencial se expone y aislamiento del runner.

## Controles y verificaciones

| Control | Estado | Evidencia o comando | Qué demuestra y qué no demuestra |
|---|---|---|---|
| Capas, puertos e inyección manual | Existente | `npm run test:architecture`; `node tools/check-architecture.cjs` | Detecta imports prohibidos; no concede autorización de negocio. |
| TypeScript estricto | Existente | `npm run typecheck` | No hay errores de tipos; no prueba secretos ni permisos. |
| Lint | Existente | `npm run lint` | Mantiene reglas estáticas; no prueba comportamiento de seguridad. |
| Secret scanning | Implementado esta semana | `npm run scan:secrets`; workflow `make feedback` | Bloquea patrones de alta confianza. La ejecución local requiere Python; el failure path sintético y el éxito corregido constan en `reports/week-03/security.json`. |
| CI con mínimo privilegio | Implementado esta semana | `npm test -- --ci --runInBand course-tests/public/week-03.test.ts` | Comprueba `contents: read`, setup reproducible y ausencia de bypasses; no prueba permisos de usuario final. |
| Auditoría de dependencias | Existente en el pipeline | `npm run audit:ci` | Falla ante advisories críticos; el resultado histórico de `SECURITY.md` es fechado y no equivale a autorización ni secreto scanning. |
| Reportes de seguridad | Implementado esta semana | `reports/week-03/security.json` | Indexa caso nominal y failure path; su SHA debe mantenerse alineado con la versión entregada. |
| Sanitización de logs, sesión, autorización, persistencia y ubicación | Futuro | No hay comando implementado en el estado actual | Se verificará en las semanas correspondientes; no los declaramos controles actuales. |

## Riesgos residuales

1. La aplicación actual no autentica ni autoriza; una UI por perfiles no sería una
	barrera suficiente.
2. El backend de incidencias y sus mutaciones no están conectados a la app; por
	tanto no podemos demostrar todavía visibilidad, asignación o conflictos.
3. No existe almacenamiento de fotos, cola offline, GPS ni sanitizador de logs.
4. `scan-secrets.py` sólo reconoce patrones conocidos y no sustituye secretos
	gestionados, revisión humana ni rotación.
5. Las dependencias externas y acciones de CI siguen siendo una cadena de
	suministro que debemos revisar después de cada cambio.

## Limitaciones conocidas

Este modelo analiza el código y documentación actuales, no una arquitectura ideal
ni funcionalidades futuras. Las cuentas, IDs, ubicaciones y patrones usados para
la prueba de fallo son sintéticos. El resultado de `SECURITY.md` sobre auditoría
de dependencias es fechado y debe volver a ejecutarse antes de liberar. La
ejecución local del escaneo de secretos no fue posible en este entorno porque no
está disponible Python; no lo presentamos como un PASS local.

## Conclusiones

Determinamos que la exposición de credenciales recibe prioridad crítica porque
puede escapar del dominio académico y el control es comprobable ahora mediante
un failure path sintético. El workflow conserva el principio de mínimo
privilegio, ejecuta typecheck, lint, tests, auditoría y secret scanning, y guarda
resultados. La arquitectura existente reduce acoplamiento y facilita pruebas,
pero no sustituye autenticación, autorización ni protección de datos.

Como siguiente trabajo de seguridad, debemos implementar y probar los controles
de sesión, autorización por actor/rol/asignación, sanitización de logs,
persistencia de fotos y ubicación sólo cuando correspondan a sus hitos. Hasta
entonces, el riesgo residual se mantiene explícito y no afirmamos que esas
protecciones ya existan.
