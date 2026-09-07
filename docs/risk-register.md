# Registro de riesgos — CampusOps

**Equipo:** campusops-dmi-team · **Semana:** 01 · **Proyecto:** CampusOps

## Cómo leer esta tabla

Cada riesgo se evalúa con:

- **Probabilidad**: qué tan posible es que ocurra durante el cuatrimestre
  (Baja / Media / Alta).
- **Impacto**: daño al entregable o al aprendizaje si ocurre (Bajo / Medio /
  Alto).
- **Mitigación**: acción concreta para reducir probabilidad o impacto.
- **Detección**: cómo sabríamos que el riesgo se materializó.

## Riesgos priorizados

| # | Riesgo | Probabilidad | Impacto | Mitigación propuesta | Detección |
|---|---|---|---|---|---|
| R1 | **Pérdida de cambios cuando el técnico trabaja sin conexión** (la app se cierra o pierde señal antes de sincronizar). | Alta | Alto | Cola local persistente con identidad estable de operación, sincronización al reconectar y recuperación tras reinicio; nunca borrar una operación sin confirmación del servicio. | Pruebas de reinicio con operaciones pendientes; verificar que las operaciones reaparecen y se sincronizan sin duplicarse. |
| R2 | **Conflicto de asignación**: coordinación reasigna la incidencia mientras el técnico ya la modificó offline. | Media | Alto | Resolución explícita de conflictos que conserve la intención pendiente, informe el conflicto al usuario y no imponga el cambio antiguo ni pierda la nueva asignación. | Caso de prueba obligatorio de reasignación concurrente (semana 8); verificar que ambas versiones quedan registradas. |
| R3 | **Divergencia del entorno**: un integrante usa otra versión de Node/Expo o edita el stack, y el proyecto deja de reproducirse. | Media | Medio | Versión fijada en `.nvmrc` (Node 22.22.0), dependencias con lockfile (`npm ci`), Makefile como interfaz única y prohibición de cambiar el framework durante el curso. | CI reproduce `make setup` + `make feedback` desde cero en cada push. |

**Prioridad**: el orden R1 > R2 > R3 responde a impacto y probabilidad: la
pérdida silenciosa de trabajo offline afecta la confianza en el sistema y no
tiene recuperación sencilla, por eso se atiende primero. R2 es el conflicto
obligatorio del caso y se resuelve con reglas explícitas. R3 se mitiga desde el
inicio con herramientas y se vigila en cada entrega.

## Plan de mitigación (detalle por riesgo)

Ejemplo ya lleno (sirve de guía de formato):

- **R1 — ejemplo completo**: guardar cada operación en la cola local *antes* de
  intentar enviarla al servidor, asignarle un `operationId` estable y marcarla
  como confirmada sólo cuando el servicio responde; al reiniciar, la cola se
  recarga desde SQLite y reintenta con la misma clave de idempotencia.
- **R2 mitigación completa (conflicto de asignación)**: implementar un protocolo de 
  control de versiones por incidencia que combine un assignmentVersion y un registro 
  de intención. Cuando el técnico modifica una incidencia offline, la app guarda 
  localmente la intención (campos cambiados, timestamp, localChangeId) y al sincronizar 
  envía la versión local junto con la assignmentVersion que tenía al editar. 
  El servidor aplica una política de resolución que:

   - si la assignmentVersion del servidor coincide con la enviada, aplica el cambio y aumenta la versión;

   - si difiere, crea un registro de conflicto que conserva ambas versiones y devuelve al 
   cliente un estado conflict con las dos intenciones; la app muestra al técnico una 
   pantalla de resolución que sugiere mantener su cambio, aceptar la reasignación o 
   combinar campos (según tipo de cambio). Además, registrar el conflicto en logs/conflicts.log 
   y notificar al coordinador por un evento de auditoría.
   Esta mitigación evita sobrescribir trabajo, permite auditoría y da control al usuario final.

- **R2  acciones operativas y comprobación**: 
  1. Añadir pruebas automáticas que simulen: (a) reasignación en servidor mientras el técnico edita 
  offline; (b) sincronización posterior con assignmentVersion distinto.

  2. Implementar un endpoint de prueba /test/conflict-scenario que devuelva respuestas controladas 
  para validar la UI de resolución.

  3. Registrar métricas de conflictos en Prometheus/Logs para alertas (umbral: >3 conflictos/día).


- **R3 - mitigación completa (divergencia del entorno)**: fijar y documentar el entorno de desarrollo y ejecución:

  - mantener .nvmrc con 22.22.0 y añadir engines en package.json;

  - forzar instalación reproducible con package-lock.json y recomendar npm ci en CI;

  - exponer Makefile como única interfaz para tareas comunes (make setup, make test, make feedback) 
  y documentar en README el flujo obligatorio;

  - añadir un workflow de GitHub Actions que ejecute make setup y make feedback en cada push y que bloquee merges si falla.
Además, incluir una política de cambios al stack: cualquier propuesta de cambio de versión o framework debe pasar por PR con etiqueta infra y aprobación de al menos dos integrantes.

**R3 - acciones operativas y comprobación**: 
  - Añadir un job en CI que valide node --version y que ejecute npm ci && make feedback.

  - Documentar en docs/ENVIRONMENT.md los pasos para reproducir el entorno local y la versión requerida de herramientas.

## Cómo comprobaremos que lo propuesto funciona

Cada mitigación tendrá una prueba reproducible antes de la semana en que el
riesgo es crítico: la cola offline se prueba en la semana 8 (persistencia y
sincronización), el conflicto de reasignación es el caso obligatorio de esa
misma semana, y la reproducibilidad del entorno se comprueba en cada entrega
con `make verify-week-01` y el workflow público de GitHub Actions.
