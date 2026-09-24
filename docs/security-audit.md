# Auditoría de seguridad — Semana 4

Actividad individual realizada por **Osbaldo** en la rama `week4/security-audit-osbaldo`. Esta auditoría revisa la seguridad y privacidad del código de CampusOps utilizando exclusivamente datos y escenarios sintéticos. No se añadieron contraseñas, tokens, ubicaciones ni datos personales reales en ningún archivo, prueba o registro de evidencia.

---

## Hallazgos

| # | Hallazgo | Riesgo | Solución aplicada | Evidencia |
|---|---|---|---|---|
| **1** | Fuga de datos sensibles en eventos de telemetría y diagnóstico (`redactForTelemetry`) | El envío de eventos de diagnóstico sin filtrar podría exponer credenciales (`authorization`, `token`, `password`), datos personales (`email`, `displayName`) e información sensible de incidencias (`location`, `photos`, notas internas). | Se implementó una función pura e inmutable de sanitización recursiva en la capa Application (`src/application/telemetry/redactForTelemetry.ts`) que sustituye los valores sensibles por `[REDACTED]`, conservando el contexto técnico. **Corregido.** | [Prueba antes](evidence/redaccion-antes.txt) y [Prueba después](evidence/redaccion-despues.txt) |
| **2** | Exposición de variantes de configuración local en el repositorio (`.gitignore`) | La regla original solo ignoraba `.env`, dejando desprotegidas variantes como `.env.local`, `.env.development` o `.env.production`. Si un integrante crea dichos archivos con configuraciones locales, podrían subirse accidentalmente a Git. | Se actualizó `.gitignore` con la regla `.env.*` preservando la plantilla pública `!.env.example`. Se verificó el estado con `git check-ignore`. **Corregido.** | [Protección .env](evidence/proteccion-env.txt) |
| **3** | Ausencia de autorización y filtrado por rol en la consulta de incidencias (`GetIncidents`) | `GetIncidents.execute()` devuelve todas las incidencias y ubicaciones físicas del repositorio a cualquier usuario. En un backend real, un reportante común podría ver incidencias ajenas o áreas restringidas (OWASP A01: Broken Access Control). | **Pendiente.** La regla del proyecto (AGENTS.md) exige que los permisos se validen en el servicio/dominio y no solo ocultando elementos en la UI. Se documenta formalmente como riesgo de diseño para el hito de Autenticación y Sesión. | [Inspección de acceso](evidence/acceso-incidencias-pendiente.txt) |

---

## Hallazgo 1 — Sanitización de telemetría y redacción de datos sensibles

### Problema encontrado

El adaptador de evaluación en `src/course-evaluation/index.ts` mantenía la función `redactForTelemetry` en estado pendiente arrojando la excepción `redactForTelemetry must be implemented in the assigned week`. Si el sistema conectara un proveedor de telemetría, logs o monitoreo de excepciones (como Sentry o Datadog), los payloads enviados contendrían encabezados de autorización, correos electrónicos, nombres reales y ubicaciones físicas en texto plano.

### Riesgo

Cualquier persona con acceso al servicio de telemetría, consola de monitoreo o registros de red podría interceptar tokens activos, credenciales de acceso o datos de carácter personal de los miembros del campus ficticio, violando los principios de confidencialidad y mínimo privilegio.

### Solución

Se desarrolló el caso de uso de sanitización en `src/application/telemetry/redactForTelemetry.ts` y se exportó a través de `src/course-evaluation/index.ts`. La función:
1. Es pura e inmutable: no modifica el objeto original de entrada.
2. Recorre estructuras de datos recursivamente (objetos y listas anidadas).
3. Normaliza las claves ignorando mayúsculas, guiones y guiones bajos (`authorization`, `access-token`, `USER_PASSWORD`, `locationLabel`, `internalComments`).
4. Reemplaza el valor de los campos sensibles por la constante `[REDACTED]`.
5. Preserva los metadatos técnicos indispensables para depuración (`incidentId`, `accept: application/json`, códigos de estado, timestamps).

### Antes

```ts
// src/course-evaluation/index.ts
export function redactForTelemetry(_input: unknown): unknown {
  return pending('redactForTelemetry');
}
```

### Después

```ts
// src/application/telemetry/redactForTelemetry.ts
export function redactForTelemetry(input: unknown): unknown {
  if (input === null || typeof input !== 'object') {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map((item) => redactForTelemetry(item));
  }

  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (isSensitiveKey(key)) {
      output[key] = '[REDACTED]';
    } else if (value !== null && typeof value === 'object') {
      output[key] = redactForTelemetry(value);
    } else {
      output[key] = value;
    }
  }

  return output;
}
```

### Evidencia

- [Fallo antes de la corrección](evidence/redaccion-antes.txt): La suite oficial `course-tests/public/week-04.test.ts` fallaba con código de salida no cero al intentar ejecutar la función pendiente.
- [Éxito después de la corrección](evidence/redaccion-despues.txt): La prueba oficial de Semana 4 y la nueva suite unitaria `course-tests/week-04-security.test.ts` pasan al 100% (5 pruebas verificadas exitosamente), demostrando la redacción correcta y la preservación de inmutabilidad.

---

## Hallazgo 2 — Protección de archivos y variantes de entorno (.env.*)

### Problema encontrado

El archivo `.gitignore` en la raíz del proyecto únicamente incluía una regla literal para `.env`. Herramientas modernas y entornos de desarrollo utilizan frecuentemente variantes como `.env.local`, `.env.development`, `.env.production` o `.env.test`.

### Riesgo

Si un programador define un archivo `.env.local` con tokens locales o URLs de servicios internos para realizar pruebas en su computadora, dicho archivo no era ignorado por Git. Una ejecución rutinaria de `git add .` habría agregado y subido las credenciales al repositorio público de GitHub.

### Solución

Se actualizó `.gitignore` añadiendo la regla comodín `.env.*` para cubrir todas las variantes posibles de archivos de variables de entorno, y se declaró explícitamente la excepción `!.env.example` para mantener la plantilla pública versionada como guía para el equipo.

### Antes

```gitignore
dist/
.env
*.jks
```

### Después

```gitignore
dist/
.env
.env.*
!.env.example
*.jks
```

### Evidencia

- [Comprobación de Git](evidence/proteccion-env.txt): Ejecución de `git check-ignore -v .env .env.local .env.development .env.production .env.test .env.example`.
- Se verificó que todas las variantes locales son efectivamente ignoradas por la regla línea 9 (`.env.*`), mientras que `.env.example` permanece rastreable como plantilla no sensible.
- `git status` confirma que ningún archivo de entorno real está preparado para commit.

---

## Hallazgo 3 — Ausencia de control de acceso y visibilidad por rol en incidencias

### Problema encontrado

Al analizar el flujo de obtención de incidencias en `src/application/incidents/GetIncidents.ts` y su presentación en `src/ui/incidents/IncidentListScreen.tsx`, se observó que el caso de uso invoca `this.repository.findAll()` sin requerir parámetros de sesión, token de autenticación ni rol del usuario.

### Riesgo

En un entorno productivo con incidencias reales de la comunidad universitaria:
1. Un usuario con rol de **Reportante** podría visualizar reportes generados por otros usuarios, incluyendo fotografías y descripciones privadas.
2. Se expondría la ubicación física exacta (`locationLabel`) de aulas cerradas o laboratorios con fallas de seguridad a usuarios no autorizados.
3. El hallazgo corresponde a la vulnerabilidad clasificada como **OWASP Top 10 A01: Broken Access Control** (Control de Acceso Roto).

### Solución y justificación de estado PENDIENTE

- **Estado:** PENDIENTE (declarado formalmente en la auditoría como riesgo de arquitectura).
- **Justificación técnica:** Las reglas de diseño del proyecto (`AGENTS.md`) establecen taxativamente: *"Permisos por rol (Reportante / Técnico / Coordinador) se validan en el servicio, nunca solo ocultando un botón en la UI"*.
- Filtrar la lista únicamente en la pantalla de React Native representaría una falsa sensación de seguridad (bypasseable desde cualquier cliente HTTP). La solución correcta exige esperar al hito de Autenticación, Sesión y SQLite (semanas posteriores), donde se inyectará el contexto del usuario autenticado en el caso de uso para filtrar las consultas en el repositorio.

### Antes y estado actual

```ts
// src/application/incidents/GetIncidents.ts
export class GetIncidents {
  constructor(private readonly repository: IncidentRepository) {}

  async execute(): Promise<readonly Incident[]> {
    return this.repository.findAll();
  }
}
```

### Evidencia

- [Inspección de acceso](evidence/acceso-incidencias-pendiente.txt): Registro detallado de la inspección de código, análisis de impacto según OWASP y justificación del diferimiento al hito de autenticación.

---

## Comprobación final y checklist de entrega

- [x] Rama de trabajo creada exclusivamente para Semana 4: `week4/security-audit-osbaldo`.
- [x] Documento de auditoría creado y estructurado: `docs/security-audit.md`.
- [x] Identificados mínimo 3 problemas con análisis de riesgo (2 corregidos, 1 pendiente justificado).
- [x] Carpeta de evidencias creada con nombres descriptivos: `docs/evidence/`.
- [x] Verificado que `.gitignore` ignora `.env` y variantes locales (`.env.*`).
- [x] Confirmado mediante `git status` que no se agregan archivos `.env`.
- [x] Datos utilizados estrictamente ficticios y sintéticos; ausencia total de credenciales reales.
- [x] Suite completa de pruebas, tipos y arquitectura en verde:
  - `npm run typecheck`: **Exit code 0** (0 errores de TypeScript).
  - `npm run lint`: **Exit code 0** (0 errores, 0 warnings).
  - `npm run check:architecture`: **Exit code 0** (0 violaciones de capas).
  - `npm test`: **9 test suites pasando al 100% (17 pruebas exitosas)**.
