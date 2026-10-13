# W06 — Ficha y validación de entrega (#39)

Las ocho regresiones de revisión se corrigieron manteniendo sus aserciones.
La entrega queda acreditada únicamente por los logs finales, el tag anotado
publicado y los checks del SHA exacto; los resultados históricos de la primera
consolidación no sustituyen esa validación.

| Campo | Valor |
|---|---|
| Repositorio | https://github.com/Draggodeidad/campusops-dmi-team |
| Rama de trabajo | `feat/week-06-baseline-interfaces` |
| PR | https://github.com/Draggodeidad/campusops-dmi-team/pull/40 |
| Etiqueta de entrega W06 | `week-06-final` |
| SHA completo | Resolver con `git rev-list -n 1 week-06-final`; sólo tras crear/publicar y verificar el tag |
| Cierre oficial del kit | 12/10/2026 23:59 America/Mexico_City |

El formato solicitado para Classroom usa W06. `week-05-final` y su SHA son la
entrega histórica W05: se conservan sin moverlos. La congelación original no envió en Classroom ni
fusionó en main. El usuario autorizó arreglar las ocho
regresiones, verificar los checks y preparar la referencia final de entrega.

## Procedencia y autoría

#36 aportó kit/contrato/configuración con commits propios de Draggodeidad.
#37 aportó implementación de osbaldoXxC en
`1f2a4b43decf3747caa5c77eecaebe2750dd0fd0` y su evidencia propia.
#38 aportó pruebas/fixtures/reportes de JulianDele en
`500b51cbc13ed11eb5c46bdbf01a4da928face1c`. Se preservó el commit remoto
`8bf9663afed401128a34ae942f564c466df8302d` y se corrigió su atribución errónea
sin reescribir historia. El roster registrado y el aporte Julian fueron
confirmados privadamente por el usuario. No se inventan ejecuciones manuales
ni revisiones remotas de compañeros.

La primera consolidación `372064458bfed08f29e72fcc6319b48fabd8d9c5` documentó
las ocho brechas. Sus logs siguen en `reports/week-06/validation/`. Las
correcciones de este seguimiento autorizado pertenecen a Draggodeidad con
asistencia declarada de Codex; no se reasignan a los compañeros. La evidencia
individual final conserva tres autores, commits y observaciones verificables.

## Correcciones comprobables

| Regresión original | Comportamiento corregido |
|---|---|
| Identidad saliente distinta de sesión | Decorador reemplaza Authorization/X-Course-Actor, ignorando variantes de mayúsculas |
| Fixture autorizado desde anonymous | Se retiran cabeceras de identidad; no se exponen vistas privadas |
| Replay viejo bajo actor nuevo | Generación se comprueba antes de aceptar respuesta o repetir solicitud |
| Refresh obsoleto en evaluación | RefreshCoordinator comparte cancelación y replay con controlador y adaptador público |
| Envío expirado sin renovar | Se consulta reloj/snapshot y se comparte renovación previa; rechazo inmediato invalida sin segundo refresh |
| Restore acepta registro inválido | Se validan schema, strings no vacíos, rol y expiración finita |
| Restore tardío tras logout | Se descarta lectura si cambió generación; nunca restaura ni borra sesión nueva |
| Borrado fallido oculto | Error seguro observable; UI oculta datos, muestra error y permite reintentar |

Además, el arranque invoca restore, las acciones usan versión remota real y
la UI presenta fallas de login/logout/refresh. La nueva suite recorre el grafo
real de `App.tsx` contra backend local: técnico inicia/resuelve, coordinador
cierra/reabre, reportante recibe rechazo sin mutación. Comprueba versiones
sucesivas, restauración, borrado fallido, logout durante escritura retenida,
refresh fallido obsoleto y 401 concurrente retardado con cuerpo/clave estables.

## Requisito → decisión → prueba

| Requisito confirmado | Decisión / evidencia |
|---|---|
| AC-01, reproducción 2.5 | Node 22.22.0, mismo stack/lockfile, setup/feedback/verify/public con SHA y logs reales |
| AC-02, comportamiento 2 | Controlador inyectado, persistir antes de authenticated, reloj y roles; seis suites W06 y ocho probes |
| AC-03, falla 1.5 | Single-flight por generación, un replay, invalidación y error de persistencia observable; concurrency.json y carreras retenidas |
| AC-04, decisión 1.5 | ADR W06 y engineering.json: alternativas, costo/beneficio, prueba y resultado |
| AC-05, aporte 0.5 | individual.json con los tres registros propios, commits y ayuda material declarada |

Kit y rúbrica íntegra: `docs/assignments/week-06*`; inventario original:
`reports/week-06/baseline/zip-inventory.json`. El quiz es separado.
Resultados finales: `reports/week-06/final-validation/index.json` y logs.
Los reportes/engineering referencian el SHA técnico validado y el siguiente
commit contiene sólo reports/evidence, evitando una autorreferencia de SHA.

## CI y congelación

W06 obtiene historial/tags completos y evalúa el HEAD del PR, que debe
coincidir con el tag final. Readiness y arquitectura se ejecutan explícitamente;
no se omiten gates. W01/W02 conservan revalidación acumulativa en checkout
desechable. W05 ahora revalida sus dos índices contra regresiones actuales,
conservando observaciones originales, y comprueba evidencia congelada en el
tag W05 dentro de un checkout temporal. No se mueve ningún tag histórico ni
se cambian sus SHA para aparentar una ejecución nueva.

Después de guardar código y documentación, se ejecutan los controles completos
con logs y códigos de salida. Se guardan evidencias en un único commit final
exclusivo de reports/evidence; se crea el tag anotado, se ejecuta
`make evidence-week-06` y se publica rama/tag. Ese reporte posterior al tag
permanece local, como exige el kit. El texto definitivo de Classroom sólo se
entrega cuando la referencia remota, evidencia congelada y GitHub Actions
coinciden y aprueban. El PR queda revisable sin fusión automática en main.

## Límites

El backend sigue siendo sintético: sus tokens no acreditan autenticación de
producción, no modela expiración temporal del servidor y su refresh rotado no
permite otra rotación. Las pruebas usan reloj/promesas controladas y loopback.
El SDK nativo de SecureStore se sustituye en tests: no se certifica cifrado
físico ni instalación de APK. La auditoría aprueba el umbral crítico fijado,
no la ausencia de todos los advisories. GPS, proveedores externos y cola
offline quedan fuera de W06. `AuthenticatedIncidentTransport` conserva la
demostración histórica separada #35; no sustituye el grafo productivo evaluado.


## Recuperación posterior de main

El merge #40 incorporó la versión anterior a los dos commits finales. La
recuperación posterior, las referencias efectivamente entregadas y la
validación continua que conserva el tag se documentan en
`docs/week-06-main-recovery.md`. El tag de entrega publicado sigue siendo el
mismo; la integración posterior no modifica el commit enviado en Classroom.
