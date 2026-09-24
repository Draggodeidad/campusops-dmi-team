# Auditoría de seguridad — Semana 4

Actividad individual en la rama `week4/security-audit-Imanol`. Revisión del código de CampusOps con datos exclusivamente sintéticos. No se encontraron credenciales reales ni se usaron datos personales para probar las correcciones.

## Hallazgos

| # | Hallazgo y ubicación | Riesgo | Solución aplicada | Evidencia |
|---|---|---|---|---|
| 1 | `redactForTelemetry` estaba pendiente en `src/course-evaluation/index.ts`. | Un flujo futuro de diagnóstico podría registrar campos de identidad, tokens, ubicación o evidencia sin sanitizar. No se observó una filtración actual en consola. | Implementada la redacción recursiva en Application y conectada al adaptador evaluable, sin mutar la entrada. **Corregido.** | [Prueba antes](evidence/redaccion-antes.txt) y [prueba después](evidence/redaccion-despues.txt). |
| 2 | `.gitignore` ignoraba `.env`, pero no variantes como `.env.local`. | Una variante con configuración sensible podría agregarse por accidente a Git. No se observó un archivo de ese tipo versionado. | Se añadieron `.env.*` y la excepción `!.env.example`. **Corregido.** | [Comprobación de Git](evidence/proteccion-env.txt). |
| 3 | `GetIncidents` devuelve todas las incidencias del repositorio fake y las pantallas muestran sus ubicaciones sin sesión ni autorización. | Al reemplazar los datos ficticios por datos de usuarios, alguien sin permiso podría consultar reportes ajenos o sus ubicaciones. | **Pendiente.** Implementar autorización en el servicio y pruebas por perfil en el hito de sesión; la UI por sí sola no es una barrera. | [Inspección del código y modelo de amenazas](evidence/acceso-incidencias-pendiente.txt). |

## Hallazgo 1 — Sanitización de telemetría ausente

### Problema encontrado y riesgo

El contrato público de Semana 4 exige que `redactForTelemetry` recorra objetos y listas, oculte claves sensibles y preserve campos técnicos. La función sólo lanzaba un error. La prueba pública falló con `redactForTelemetry must be implemented in the assigned week`. Aunque la aplicación actual no imprime objetos sensibles, faltaba el control previsto para futuros diagnósticos.

### Antes

```ts
export function redactForTelemetry(_input: unknown): unknown {
  return pending('redactForTelemetry');
}
```

### Después

`src/application/telemetry/redactForTelemetry.ts` contiene la función real y `src/course-evaluation/index.ts` la exporta para la prueba pública. Recorre listas y objetos, normaliza las claves a minúsculas sin `_` ni `-`, sustituye el valor completo de las claves sensibles por `[REDACTED]` y crea una salida nueva. Por ejemplo:

```ts
redactForTelemetry({ 'access-token': 'token-ficticio', incidentId: 'INC-001' });
// { 'access-token': '[REDACTED]', incidentId: 'INC-001' }
```

### Evidencia

La [prueba inicial](evidence/redaccion-antes.txt) falla antes del cambio. La [prueba posterior](evidence/redaccion-despues.txt) pasa junto con casos nuevos de objetos anidados, listas, claves normalizadas, campos técnicos conservados y entrada congelada. Es un control por nombres de campo: texto libre en otras claves no debe enviarse sin revisión a telemetría.

## Hallazgo 2 — Variantes de `.env` sin protección

### Problema encontrado y riesgo

La regla anterior sólo cubría `.env`. `git check-ignore` no encontraba una regla para `.env.local` ni `.env.production`; si alguien creara esos archivos, podrían agregarse al repositorio por error. `git ls-files` mostró que sólo `.env.example` está versionado entre los nombres inspeccionados.

### Antes

```gitignore
.env
```

### Después

```gitignore
.env
.env.*
!.env.example
```

### Evidencia

La [salida de Git](evidence/proteccion-env.txt) confirma que `.env`, `.env.local` y `.env.production` quedan ignorados, que `.env.example` sigue disponible como ejemplo y que no se versionaron archivos de entorno con valores sensibles. Las variables `EXPO_PUBLIC_*` son públicas en la app; no deben contener secretos.

## Hallazgo 3 — Visibilidad de incidencias sin autorización

### Problema encontrado y riesgo

`GetIncidents.execute()` usa `findAll()` y las pantallas muestran `locationLabel`. No hay sesión ni comprobación de visibilidad por reportante, técnico o coordinador en este flujo. La [inspección](evidence/acceso-incidencias-pendiente.txt) y `docs/threat-model.md` confirman el límite. Hoy sólo se muestran incidentes y ubicaciones sintéticos; no se afirma una exposición de datos reales.

### Antes y estado después de esta actividad

```ts
return this.repository.findAll();
```

El comportamiento sigue igual. La corrección requiere aplicar permisos sobre la consulta real en el servicio y probar que un actor no ve incidencias ajenas. Ese trabajo corresponde al hito de sesión y autorización; ocultar campos en la pantalla no resolvería el acceso al dato.

## Comprobación final

- `npm run typecheck`, `npm run lint`, las pruebas de humo, incidencias y arquitectura, y `npm run check:architecture`: **correctos**.
- Prueba pública de Semana 4 más pruebas nuevas de sanitización: **9 suites y 15 pruebas correctas**. Véase [salida observada](evidence/redaccion-despues.txt).
- `npm run scan:secrets`: **sin coincidencias de alta confianza**; el escáner no demuestra ausencia absoluta de secretos.
- `make feedback`: **correcto**, incluido el bundle Android. `npm run audit:ci` informó dos avisos de severidad alta, pero el umbral configurado es `critical`; estos avisos no se declaran corregidos aquí.
- La revisión de archivos de entorno se hizo por nombres y reglas de Git, sin imprimir el contenido de ningún `.env`.

La entrega contiene dos correcciones comprobadas y un riesgo pendiente declarado. No se crearon credenciales, tokens ni datos personales reales para la demostración.
