# Contrato confirmado W06 — baseline de #36

## Fuentes, alcance y revisión

Base: `791e222a6c057acf3ca534d233bcf79771c554c9`. Se extrajo el ZIP fuera del repositorio y se leyeron completos sus ocho archivos UTF-8; no contiene binarios, código productivo nuevo, scripts ni configuración de dependencias. El inventario con tamaños, hashes y comparación está en `reports/week-06/baseline/zip-inventory.json`. Se revisaron también arquitectura/ADR, contratos, composición, transporte/repositorio HTTP, SecureStore, backend, evaluador y evidencias W05.

El kit contiene `INSTALL.md`, tres guías en `docs/assignments/`, workflow W06, prueba pública W06 y los dos documentos CampusOps. Prueba y documentos CampusOps son idénticos a main: no se sobrescribieron. Se añadieron las guías y workflow; INSTALL integra W06 conservando instrucciones W05. Las referencias ACTIVITY_STUDENT_FACING.md, STARTER_AND_REPOSITORY.md y RUBRIC_PUBLIC.md son nombres alternativos: no vienen como archivos adicionales; sus equivalentes son las tres guías semanales. Makefile, evaluador y contratos requeridos ya soportaban W06.

Disponible del 06/10/2026 08:00 al **12/10/2026 23:59 America/Mexico_City**. Actividad: 8 puntos; quiz individual separado: **2 puntos**, no 3 como decía la planificación anterior. Las tarjetas individuales #34/#35 no modifican esta fecha ni forman parte de #36.

| Criterio | Máximo | Comprobación requerida |
|---|---:|---|
| AC-01 | 2.5 | Reproducir SHA, instalación y verify |
| AC-02 | 2 | Login, expiración, refresh compartido, logout y almacenamiento seguro |
| AC-03 | 1.5 | Sin bucles/refresh duplicados; eliminación persistida al cerrar |
| AC-04 | 1.5 | Política de renovación y transición segura: alternativas, costo/beneficio y prueba |
| AC-05 | 0.5 | Aporte individual verificable de cada integrante |

G1/G2/G3 limitan a 4.8/8 ante falta de reproducción/flujo central o exposición real; G4 limita individualmente a 5.6/8 sin aporte individual. Aplicar sólo el límite más restrictivo. Ver rúbrica íntegra, sin porcentajes inventados para niveles parciales.

## Interfaces de diseño para #37 y #38

**Estas firmas quedan publicadas para implementación posterior; no existen aún en src.** Application mantiene estado y coordinación; Infrastructure implementa proveedor/persistencia/transporte; App.tsx compone; UI sólo recibe Application y tipos de Domain. No se cambia el ADR ni el diagrama vigente para representar código futuro.

```ts
// src/application/session/SessionClock.ts
interface SessionClock { now(): number } // epoch en milisegundos
// src/application/session/SessionSnapshot.ts; CampusRole ya existe en src/campusops
 type SessionState = 'anonymous' | 'signing-in' | 'authenticated'
   | 'expired' | 'refreshing' | 'logging-out';
 type SessionSnapshot = Readonly<{
   state: SessionState;
   actorId: string | null;
   role: CampusRole | null;
   expiresAt: number | null;
   generation: number;
 }>;
// src/application/session/SessionController.ts
interface SessionController {
  getSnapshot(): SessionSnapshot;
  subscribe(listener: (snapshot: SessionSnapshot) => void): () => void;
  login(actorId: string): Promise<void>;
  refresh(): Promise<void>;
  logout(): Promise<void>;
}
// src/application/session/SessionProvider.ts — jamás expuesto a UI
 type SessionTokens = Readonly<{
   accessToken: string; refreshToken: string; expiresIn: number;
 }>;
interface SessionProvider {
  login(actorId: string): Promise<SessionTokens & Readonly<{
    actorId: string; role: CampusRole;
  }>>;
  refresh(refreshToken: string): Promise<SessionTokens>;
}
```

Implementar controlador en #37. subscribe devuelve unsubscribe y notifica cambios; snapshot es inmutable, sin secretos. Estado inicial anonymous/generación 0, identidad/expiración null; incremento de generación al reemplazar o invalidar sesión. Login exitoso calcula `expiresAt = clock.now() + expiresIn * 1000`; exactamente en expiresAt se considera expirada. Proveedor valida JSON desconocido, tokens no vacíos, actor solicitado, rol permitido y expiresIn positivo finito. Fallas se expresan con ApplicationFailure controlada; no se filtran cuerpos ni errores de proveedores a UI.

Reutilizar `SessionSecretStore.save(secret: string)`, `read(): Promise<string | null>` y `clear(): Promise<void>`, sin romper W04 ni su clave histórica. Guardar JSON versionado `{schemaVersion: 1, actorId, role, accessToken, refreshToken, expiresAt}` en SecureStore; validar al leer, descartar/borrar registros corruptos, incluido un secreto W04 que no represente sesión. Generación es de ejecución y no se restaura desde almacenamiento. Serializar escrituras/borrados para que logout no sea seguido por una escritura vieja. No publicar authenticated antes de persistir; un fallo de almacenamiento deja estado seguro y error observable. Un fallo de clear no permite afirmar que el token fue borrado. No registrar el JSON ni valores sensibles. La restauración al arranque corresponde a #37 y debe comprobar expiración antes de enviar solicitudes.

Una promesa de refresh compartida por generación atiende todos los waiters; cada solicitud conserva requestId, generación e intento 0/1. Máximo un replay, con mismo cuerpo y clave de idempotencia. Segundo 401 finaliza con falla segura; 403 no renueva. Logout y nuevo login invalidan respuestas viejas: ni éxito ni falla obsoletos pueden restaurar/borrar una sesión nueva. Refresh fallido pasa a anonymous, limpia persistencia y finaliza todos los waiters; la promesa se libera también al fallar.

Conservar exactamente `AuthEvent` y `coordinateRefresh(events: readonly AuthEvent[])` con resultado `{status: 'anonymous' | 'authenticated', activeGeneration: number | null, refreshCalls: number, retriedRequestIds: readonly string[], persistedToken: string | null}`. No ampliar eventos oficiales ni implementar un algoritmo independiente para evaluación: compartir la lógica de transición de Application. No imprimir persistedToken en evidencias.

Reutilizar `IncidentTransport` en Infrastructure mediante decorador de sesión; no importarlo desde Application. #37 define el puerto de contexto de autorización interno que el decorador consume y compone todo en App.tsx. Preservar el repositorio/casos de uso W05 y la prueba histórica fake. Implementar sólo acciones necesarias start/resolve/close/reopen, usando baseVersion e idempotencia; sin cola offline ni GPS.

## Backend, ownership y límites

Login acepta actorId sintético y devuelve actor/rol, accessToken, refreshToken y expiresIn 60. Refresh acepta únicamente el refresh inicial; devuelve otro refresh que el simulador no vuelve a aceptar. El servidor no simula expiración temporal/rotación productiva: usar reloj y transporte controlados para carreras; comprobar autorización por actor/asignación contra backend real. No modificarlo para aparentar garantías.

| Issue | Responsable según asignados de GitHub, confirmado por el usuario | Archivos y salida |
|---|---|---|
| #36 | Draggodeidad | Guías, baseline, scripts npm, CI oficial, logs de integración |
| #37 | osbaldoXxC | Application/session, adaptadores, UI, App.tsx, evaluación y diagrama real |
| #38 | JulianDele | Suites/fixtures W06 y auth-tests/concurrency |
| #39 | Draggodeidad | Consolidación engineering/individual, entrega y tag final |

Los cuerpos de #37/#38 indican responsables inversos; prevalecen los asignados confirmados. No se cambiaron asignaciones. #38 añadirá sus suites a test:week-06 y npm test cuando existan: `course-tests/week-06-session.test.ts`, `course-tests/week-06-authorization.test.tsx`, fixtures en `course-tests/fixtures/week-06/`. #37 mantiene coordinateRefresh y los archivos productivos; #38 no implementa sesión. Ambos deben usar el contrato publicado, evitando editar scripts/CI en paralelo.

## Comandos, reportes y pendientes

Usar Node 22.22.0 y `make setup`. Ejecutar `npm run typecheck`, `npm run lint`, `npm run test:smoke`, `npm run test:incidents`, `npm run test:architecture`, `npm run check:architecture`, `npm run backend:self-test`, regresiones acumuladas y `npm run test:week-06`. `npm test` incluye explícitamente W06 y no activa semanas futuras. Gates oficiales: `make feedback`, `make verify-week-06`, `make public-test-week-06`; `make evidence-week-06` sólo tras consolidación y tag final.

El workflow se conserva íntegro: también exige evidencias/tag finales y puede fallar en una rama parcial. make feedback termina en npm test si W06 falla: eso impide alcanzar auditoría/export, que se comprobarán por separado sin presentar feedback como exitoso. El evaluador verify comprueba herramientas pero no demuestra ciclo de sesión; public exige archivos y comportamiento. Su selección npm ejecuta además las regresiones explícitas.

Entregables finales: `docs/session-state-machine.mmd`, `reports/week-06/auth-tests.json`, `reports/week-06/concurrency.json`, `evidence/week-06/engineering.json`, `evidence/week-06/individual.json`. Los crea su issue responsable, no #36. Reportes: schemaVersion 1, week 6, commitSha completo, generatedAt ISO y checks con id/status/scenarioType/command/evidence; estados pass/fail/not_applicable, escenarios nominal/boundary/failure y al menos un boundary/failure por reporte. Engineering incluye decisión, dos alternativas, tradeoff, AC-01..AC-05 y verification; individual exactamente tres miembros con identidades y aportaciones reales. Consultar EVIDENCE_CONTRACT y guía de repositorio para campos completos y commit final exclusivo de reports/evidence.

Logs antes/después e índice de comandos: `reports/week-06/baseline/`. Verify/public son diagnósticos generados del checkout, no reportes auth-tests/concurrency ni evidencia de entrega completa. Los fallos de coordinateRefresh corresponden a #37; suites/reportes independientes a #38; consolidación/tag a #39. #36 no crea tag ni evidence final. Ayuda material de Codex: revisión del kit, documentación, scripts y ejecución; verificable mediante diff y logs, sin atribuir trabajo a compañeros.
