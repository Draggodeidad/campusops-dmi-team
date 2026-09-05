# Definición del problema — CampusOps

**Equipo:** campusops-dmi-team · **Semana:** 01 · **Proyecto:** CampusOps (Desarrollo Móvil Integral 2026)

## 1. Problema que atiende

En un campus universitario las fallas (eléctricas, de laboratorio, fugas de agua,
conectividad, equipos descompuestos, riesgos de seguridad y mantenimiento) suelen
reportarse por canales informales: un mensaje, una llamada o un papel que se
pierde. Cuando un reporte no queda registrado, no se puede saber quién lo atiende,
en qué estado está ni qué evidencia lo respalda.

CampusOps atiende ese problema: convierte una falla del campus en un proceso
trazable. El sistema acompaña una incidencia desde el reporte hasta el cierre,
registra quién hizo qué en cada transición y permite que técnicos y coordinación
trabajen con o sin conexión sin perder cambios.

**Usuarios del sistema** (todos ficticios, campus sintético):
- **Reportante**: cualquier miembro de la comunidad del campus.
- **Técnico**: personal de mantenimiento/operación asignado a incidencias.
- **Coordinador**: responsable de priorizar, asignar y cerrar.

## 2. Qué incluye y qué excluye el proyecto

**Incluye (núcleo obligatorio):**

- Incidencias con categoría, descripción, zona y evidencia.
- Tres perfiles de usuario con permisos distintos validados en el servicio.
- Flujo de estados: reportada → asignada → en proceso → en verificación → cerrada,
  más cancelación, reapertura y devolución a proceso.
- Historial de cada transición y operaciones idempotentes.
- Operación offline-first con cola persistente y sincronización con detección de
  conflictos (caso obligatorio: reasignación mientras el técnico trabaja offline).
- Logs sanitizados, pruebas automatizadas y release Android verificable.

**Excluye (fuera del mínimo):**

- Pagos o integración con sistemas institucionales reales.
- Chat en tiempo real o panel web administrativo completo.
- IA para reconocimiento de imágenes.
- Publicación obligatoria en tiendas.
- Datos, ubicaciones o personas reales.

## 3. Responsabilidades por actor

| Actor | Puede |
|---|---|
| **Reportante** | Crear incidencias, elegir categoría, describir, adjuntar evidencia, indicar ubicación, consultar sus reportes y agregar información posterior. |
| **Técnico** | Consultar sus asignaciones, iniciar la atención, registrar diagnóstico y notas, marcar la resolución y trabajar sin conexión para sincronizar después. |
| **Coordinador** | Priorizar, asignar/reasignar, verificar, cerrar o reabrir incidencias y consultar historial y evidencias. |

El permiso real se valida en el servicio; ocultar un botón no es suficiente.
Un técnico no puede modificar una incidencia que fue reasignada a otra persona.

## 4. Recorrido de una incidencia

1. **Reportar**: el reportante crea la incidencia con descripción, categoría,
   zona y evidencia. Estado inicial: `open` (reportada).
2. **Asignar**: el coordinador revisa el conjunto, prioriza y asigna un técnico
   responsable. Estado: `assigned`.
3. **Atender**: el técnico asignado inicia la atención, registra diagnóstico,
   notas y evidencias (posiblemente offline). Estado: `in_progress` y luego
   `resolved` cuando solicita verificación.
4. **Cerrar**: el coordinador revisa la solución y evidencias y cierra la
   incidencia (`closed`). Si la verificación falla, devuelve a proceso; si el
   caso reaparece, puede reabrir hacia `assigned`.

Cada transición genera una entrada de historial y respeta el rol autorizado. Las
operaciones repetidas (por reintento o doble envío) no duplican eventos ni
evidencias (idempotencia).

## 5. Criterios verificables de aceptación

Todo criterio debe poder comprobarse con un comando, una prueba o una ejecución
observable. La versión entregada de esta semana (tag `week-01-final`) cumple:

- **AC-W1-1**: `make setup` termina sin errores en una máquina limpia y
  `make feedback` termina con salida exitosa (typecheck, lint, smoke test,
  auditoría crítica y bundle Android de Expo). — verificable en CI
  (`public-feedback`).
- **AC-W1-2**: la prueba básica (`npm run test:smoke`) pasa y muestra el estado
  del backend como `available` con el doble controlado.
- **AC-W1-3**: los archivos `docs/problem-definition.md` y
  `docs/risk-register.md` describen el caso CampusOps con actores, alcance y
  riesgos priorizados, no una app genérica.
- **AC-W1-4**: el registro `reports/week-01/baseline.json` contiene al menos una
  observación `fail` (falla controlada) y una `pass` (corrección verificada),
  con comandos reproducibles.
- <COMPLETAR: osbaldoXxC>
- <COMPLETAR: osbaldoXxC>
- <COMPLETAR: osbaldoXxC>

Criterio de ejemplo que puedes usar de guía (ya está lleno):

- **AC-W1-0 (ejemplo)**: si se modifica el `testID` del estado del backend, el
  smoke test falla con un mensaje que señala el componente afectado; al
  restaurarlo, el test vuelve a pasar sin cambios en los archivos de prueba.

## 6. Decisión de alcance para esta semana

Esta semana no se implementan pantallas, inicio de sesión ni flujos completos.
Se entrega una base reproducible y una definición técnica del caso. El
fundamento de esta decisión y sus alternativas quedan en
`evidence/week-01/engineering.json`.
