# AGENTS.md — Guía de trabajo para CampusOps

Este archivo aplica a todo el repositorio. Su objetivo es mantener el contexto del proyecto y evitar que un agente o LLM rompa la arquitectura acordada al implementar cambios futuros.

## 1. Contexto permanente

- Producto: CampusOps, aplicación móvil académica para gestionar incidencias de un campus ficticio.
- Stack fijado: React Native, Expo y TypeScript estricto.
- Perfiles reales: Reportante, Técnico y Coordinador. No inventar perfiles adicionales.
- La implementación es acumulativa por semanas. Conservar el trabajo, controles y evidencias de semanas anteriores.
- Usar únicamente datos sintéticos. No añadir secretos, credenciales, ubicaciones ni datos personales reales.
- No reiniciar el proyecto, sustituir el stack ni crear otra aplicación Expo.

Antes de modificar código, leer como mínimo:

1. `docs/CAMPUSOPS.md` y `docs/CAMPUSOPS_API.md`.
2. La actividad y rúbrica de la semana correspondiente en `docs/assignments/`.
3. `docs/adr/ADR-001-architecture.md`.
4. `docs/architecture.mmd`.
5. Las pruebas, reportes y evidencias acumuladas aplicables.

Si la documentación y el código se contradicen, el código revela la arquitectura real. Corregir la discrepancia y actualizar ambos; no documentar una arquitectura ideal que no exista.

## 2. Arquitectura vigente

CampusOps usa una arquitectura por capas sencilla con Ports and Adapters e inyección manual:

```text
UI → Application → Domain ← Infrastructure
             ↑                 │
             └── contratos ────┘

App.tsx = Composition Root
```

### UI — `src/ui/`

Responsabilidades:

- Pantallas, componentes, presentación, estados visuales e interacción.
- Invocar casos de uso recibidos mediante props o dependencias inyectadas.
- Mostrar estados de carga, vacío, éxito y error cuando correspondan.

Reglas:

- Puede importar Application y tipos de Domain.
- No puede importar `src/infrastructure/`, `src/api/`, almacenamiento, HTTP ni SDKs externos directamente.
- No debe construir repositorios ni adaptadores concretos.

### Application — `src/application/`

Responsabilidades:

- Casos de uso y orquestación de flujos.
- Definir puertos de aplicación cuando el contrato no sea una regla del dominio.
- Traducir fallas técnicas a resultados que la UI pueda manejar cuando sea necesario.

Reglas:

- Puede depender de Domain.
- No puede depender de UI ni Infrastructure.
- No debe importar React Native, Expo, `fetch`, almacenamiento ni SDKs de proveedores.

### Domain — `src/domain/` y vocabulario compartido en `src/campusops/`

Responsabilidades:

- Entidades, tipos, reglas y contratos esenciales del negocio.
- Mantener el vocabulario estable de incidencias.

Reglas:

- No puede depender de UI, Application ni Infrastructure.
- No debe importar React, React Native, Expo, HTTP, persistencia o SDKs externos.
- Crear una interfaz sólo cuando represente un límite sustituible real; evitar abstracciones sin propósito.

### Infrastructure — `src/infrastructure/`

Responsabilidades:

- Implementaciones concretas de repositorios, adaptadores y proveedores.
- Encapsular API, persistencia, sesión, ubicación y SDKs externos cuando sus hitos correspondan.
- Convertir formatos externos a contratos internos.

Reglas:

- Puede implementar contratos de Domain o Application.
- No puede depender de UI.
- Un cambio de proveedor debe quedar localizado aquí y en la raíz de composición.

### Composition Root — `App.tsx`

`App.tsx` es el único lugar autorizado para conocer simultáneamente UI, Application e Infrastructure con el fin de construir e inyectar el grafo de dependencias.

- Mantenerlo pequeño y sin reglas de negocio.
- No mover lógica de pantallas o casos de uso a este archivo.
- La excepción de composición no autoriza imports UI → Infrastructure en otros archivos.

## 3. Flujo actual de incidencias

La funcionalidad implementada en Week 02 es deliberadamente pequeña:

```text
IncidentListScreen
  → GetIncidents
    → IncidentRepository
      ← FakeIncidentRepository

IncidentDetailScreen
  ← CampusOpsApp
    → GetIncidentById
      → IncidentRepository
```

- Los datos actuales son deterministas e in-memory.
- `IncidentRepository` debe seguir siendo sustituible sin modificar la UI.
- No conectar todavía un backend real, autenticación, base de datos, GPS, cola offline ni proveedores externos salvo que la actividad semanal lo exija explícitamente.
- No añadir un contenedor DI, DTO o mapper hasta que exista una necesidad concreta y documentada.

## 4. Cómo implementar una funcionalidad nueva

Seguir este orden:

1. Confirmar el alcance y criterio de aceptación de la semana.
2. Identificar la regla o concepto de Domain, si existe.
3. Crear o extender el contrato mínimo que represente un límite sustituible.
4. Implementar la orquestación en un caso de uso de Application.
5. Implementar el detalle técnico en Infrastructure.
6. Inyectar la implementación desde `App.tsx`.
7. Hacer que UI dependa del caso de uso, nunca del adaptador concreto.
8. Añadir pruebas de comportamiento, sustitución y límites relevantes.
9. Actualizar ADR y Mermaid si cambian responsabilidades o dependencias.
10. Generar evidencia únicamente a partir de comandos y resultados realmente observados.

Para sesión, persistencia y ubicación, conservar el mismo patrón cuando llegue su semana:

```text
UI → Use Case → Port ← Adapter → Provider
```

## 5. Límites comprobados automáticamente

El comando `npm run check:architecture` inspecciona los imports bajo `src/`.

Debe conservar estas prohibiciones:

- UI → Infrastructure.
- Application → UI o Infrastructure.
- Domain → UI, Application o Infrastructure.
- Infrastructure → UI.

Si se añade una nueva capa o alias de imports, actualizar el comprobador y su prueba sin debilitar las reglas existentes.

No eliminar, omitir ni modificar pruebas o workflows para ocultar fallos. Corregir la causa.

## 6. Validación mínima antes de entregar un cambio

Ejecutar según el alcance:

```bash
npm run typecheck
npm run lint
npm run test:smoke
npm run test:incidents
npm run test:architecture
npm run check:architecture
```

Para Week 02 también ejecutar:

```bash
make feedback
make verify-week-02
make public-test-week-02
```

`make evidence-week-02` sólo se ejecuta después de crear el tag final y cuando todas las evidencias sean reales y completas.

No considerar válido un resultado exitoso si se obtuvo desactivando controles, usando `--passWithNoTests`, `continue-on-error`, `|| true` o equivalentes.

## 7. ADR, diagrama y evidencias

Cuando cambie la arquitectura:

- Actualizar `docs/adr/ADR-001-architecture.md` con contexto, alternativas, decisión, razones y consecuencias.
- Actualizar `docs/architecture.mmd` para reflejar imports y responsabilidades reales.
- Actualizar `reports/week-02/dependencies.json` con comandos y resultados observables.
- Mantener el vínculo requisito → decisión → prueba → resultado en `evidence/week-02/engineering.json`.

Nunca inventar contribuciones individuales, SHAs, revisiones o resultados. Cada integrante debe registrar trabajo propio verificable. Los TODO pendientes no equivalen a evidencia completa.

## 8. Higiene de cambios y Git

- Inspeccionar `git status` antes de editar.
- Preservar cambios locales ajenos y archivos de semanas anteriores.
- Evitar refactorizaciones no relacionadas con el requisito actual.
- No borrar pruebas, reportes o evidencias históricas.
- No reescribir historial ni usar comandos destructivos para resolver conflictos.
- Mantener separados los commits técnicos y el commit final exclusivo de `reports/` y `evidence/` cuando la guía semanal lo exija.
- No crear ni mover el tag `week-02-final` hasta que todas las comprobaciones y las tres evidencias individuales estén completas.

## 9. Criterio de terminado

Un cambio está terminado sólo cuando:

- Cumple el comportamiento solicitado sin implementar hitos futuros innecesarios.
- Respeta la dirección de dependencias.
- Tiene manejo observable de estados y fallas relevantes.
- TypeScript, lint y pruebas aplicables pasan.
- ADR, diagrama, imports y tests cuentan la misma historia.
- Las evidencias corresponden al SHA comprobado.
- No atribuye trabajo no realizado a ningún integrante.

Si alguna condición no puede cumplirse, dejar el pendiente explícito y no declarar la entrega lista para etiquetar.
