# W06 — Consolidación y ficha de entrega (#39)

**Estado: no listo para etiquetar.** Esta ficha prepara la entrega; no acredita
que el flujo integrado cumpla W06. No se crea/mueve `week-06-final` ni se entrega
en Classroom durante esta tarea.

| Campo | Valor |
|---|---|
| Repositorio | https://github.com/Draggodeidad/campusops-dmi-team |
| Rama de trabajo | `feat/week-06-baseline-interfaces` |
| PR de integración | https://github.com/Draggodeidad/campusops-dmi-team/pull/40 |
| Tag previsto | `week-06-final` (creación posterior autorizada) |
| SHA final de entrega | **Pendiente de validación final** |
| Cierre oficial del kit | 12/10/2026 23:59 America/Mexico_City |

## Procedencia y dependencias

Se sincronizó la rama mediante fast-forward hasta
`500b51cbc13ed11eb5c46bdbf01a4da928face1c`; `origin/main` seguía en
`791e222a6c057acf3ca534d233bcf79771c554c9` y ya era ancestro. No se fusiona
el PR en main. Durante la validación se incorporó también el commit remoto
`8bf9663afed401128a34ae942f564c466df8302d`, conservando ambas líneas de historia.
Ese cambio asignaba a osbaldo un SHA de Julian; la consolidación restituye el
registro propio verificable de cada autor. Los primeros logs de revisión se
conservan en `validation/before-remote-sync/`, con su SHA real.
El ZIP local se conserva sin añadirlo a Git. Inventario/hash y
comparación íntegra originales: `reports/week-06/baseline/zip-inventory.json`.
El mapeo AC y los 8 puntos se verifican en las tres guías oficiales de
`docs/assignments/week-06*`; el quiz es separado y no forma parte de esta tarea.

| Dependencia | Evidencia en rama | Estado real |
|---|---|---|
| #36 — Draggodeidad | `c74e4796b7f50f3d804f853fec2b271fd6417728`, `84be09df0220dd4116267275abf626c876bce7c8` | Kit/contrato/configuración/logs publicados; issue abierta, PR sin integrar en main |
| #37 — osbaldoXxC | `1f2a4b43decf3747caa5c77eecaebe2750dd0fd0`, evidencia propia `f4a77a8e150c8ea6c4698056270a39b8f31da8a7` | Implementación recibida; correcciones de revisión pendientes |
| #38 — JulianDele | `500b51cbc13ed11eb5c46bdbf01a4da928face1c` | Pruebas/reportes recibidos; regresiones integradas pendientes |
| #39 — Draggodeidad | Documentación, scripts, revisión reproducible y consolidación actuales | Aportes reunidos; cierre bloqueado por validación |

Los asignados reales de #37/#38 prevalecen sobre los nombres invertidos en el
plan original. El usuario confirmó privadamente el roster ya registrado y el
aporte de Julian. Se conserva el registro propio de osbaldo de
`individual.osbaldoxxc.json`; no se le atribuyen los tests añadidos por Julian.
Las observaciones asistidas por IA se identifican como tales, sin afirmar
ejecución manual personal ni revisiones GitHub que no existen.

## Revisión y pendientes asignados

`npm run check:week-06-readiness` ejercita código productivo con fixtures
sintéticos y emite sólo estados, contadores y booleanos. Exit 1 significa que
hay invariantes incumplidas. No reemplaza las suites aportadas por #38 ni se
presenta un gate oficial como aprobado a causa de esos probes.

| Hallazgo / reproducción | Corrección necesaria | Responsable |
|---|---|---|
| `repository-uses-active-session-actor`; `anonymous-repository-does-not-send-fixture-authorization` | Repositorio + decorador deben consumir la sesión actual; no enviar fixture autorizado desde anonymous | #37 osbaldoXxC |
| `old-401-is-not-replayed-as-new-actor` | Verificar generación antes del replay; nunca reenviar intención anterior con otra identidad | #37 osbaldoXxC |
| `evaluation-rejects-refresh-success-after-logout` | Compartir transiciones reales entre Application y coordinateRefresh; rechazar resultado obsoleto | #37 osbaldoXxC |
| `expired-request-refreshes-before-send` | Consultar expiración antes de enviar; renovar o impedir envío expirado | #37 osbaldoXxC |
| `restore-rejects-invalid-role-and-empty-tokens`; `restore-completion-cannot-resurrect-after-logout` | Validar datos completos y generación; serializar restauración y cleanup; conectar arranque | #37 osbaldoXxC |
| `refresh-cleanup-reports-storage-delete-failure` | Propagar falla controlada de clear; no afirmar purga si persiste el registro | #37 osbaldoXxC |
| `src/ui/CampusOpsApp.tsx:154`, `:164` | Presentar errores de login/logout y no ocultar fallo de borrado | #37 osbaldoXxC |
| `src/ui/CampusOpsApp.tsx:185` y modelo `Incident` sin versión | Preservar versión real del DTO y enviarla en acciones sucesivas | #37 osbaldoXxC |
| `App.tsx` no llama restore; lista/detalle siguen visibles con anonymous | Integrar arranque y vuelta efectiva al login; aislar estado de pantalla por sesión | #37 osbaldoXxC |
| `AuthenticatedIncidentTransport` sólo aparece en suite separada | Evitar segundo algoritmo como evidencia del grafo real; probar el decorador compuesto | #37 osbaldoXxC / #38 JulianDele |
| Prueba de autorización usa backend directamente | Añadir regresión con grafo de app/UI, roles, versiones y fallos de persistencia | #38 JulianDele |
| Auditoría crítica inicial de dependencias | Se actualizó únicamente shell-quote 1.10.0 → 1.12.0 en lockfile dentro del rango existente; comprobar reinstalación y gates en los logs actuales | #39 Draggodeidad |

Las pruebas existentes pueden aprobar mientras estos escenarios fallan. El
backend valida 403/409 y no muta ante rechazo, pero sus tokens son fixtures:
no simula expiración temporal ni rotación productiva completa. Un refresh
inicial devuelve otro refresh que el servidor no vuelve a aceptar. Las
pruebas nativas sustituyen el SDK y no certifican cifrado físico ni APK.

La corrección de lockfile conserva las versiones fijadas de Expo/React Native
y no elimina advisories de menor severidad. El resultado de `audit:ci` sólo
acredita el umbral crítico configurado. El fallo inicial de auditoría y el log
de actualización se conservan, aunque la verificación posterior apruebe.

## Matriz requisito → decisión → prueba → resultado

| Requisito confirmado | Issues / decisión | Artefacto y validación |
|---|---|---|
| AC-01 reproducción, 2.5 | #36/#39; mismo proyecto/stack y comandos acumulados | Inventario baseline; `validation/index.json`; setup, feedback, verify, public con logs/exit codes |
| AC-02 ciclo de sesión, 2 | #37/#38; refresh por generación, un replay, persistir antes de authenticated | Diagrama real; `auth-tests.json`; suites W06 y probes de actor/expiración/restore |
| AC-03 falla segura, 1.5 | #37/#38; cleanup y no aceptar respuestas viejas | `concurrency.json`; barreras A/B/C; probes de replay, logout tardío y clear |
| AC-04 decisión, 1.5 | #39; alternativas y costo de generación/serialización | ADR W06 y `engineering.json`, incluyendo verificaciones fallidas |
| AC-05 aporte, 0.5 | #36–#39; conservar autoría real y asistencia | Tres miembros en `individual.json`, SHA completos y archivos verificables |

El índice final incluye SHA técnico, entorno y logs; `engineering.json` y los
reportes apuntan a ese SHA. Las observaciones anteriores permanecen en el
historial y en `reports/week-06/validation/received/`; no se sustituyen SHA de
W01–W05 para superar la validación actual.

## Secuencia posterior, todavía no ejecutada

1. Resolver los pendientes asignados, añadir regresiones y revisar el diff.
2. Integrar por las reglas de main con autorización; guardar SHA técnico.
3. Instalar con Node 22.22.0, repetir controles acumulados, cinco suites W06,
   readiness, `make feedback`, `make verify-week-06` y `make public-test-week-06`.
4. Regenerar reportes con resultados reales sobre ese SHA y guardar un único
   commit final que modifique sólo `reports/` y `evidence/`. Comprobar relación
   padre directo, schemas, aportes y árbol limpio de trabajo de entrega.
5. Sólo con checks y revisión completos y autorización posterior: crear tag
   anotado `week-06-final`; ejecutar `make evidence-week-06`; comprobar que tag
   y SHA completo coinciden y publicar rama/tag. Un fallo impide declarar lista
   la entrega. Cualquier corrección posterior exige revisar otra vez la
   secuencia; nunca mover el tag como atajo.
6. Rellenar SHA final de ficha y entregar URL/tag/SHA en Classroom únicamente
   con autorización posterior.
