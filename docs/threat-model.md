# Modelo inicial de amenazas — Semana 03

## Alcance y fronteras de confianza

CampusOps sólo usa cuentas, incidencias y ubicaciones sintéticas durante el curso. Las fronteras son: la UI del dispositivo hacia los casos de uso, los adaptadores de infraestructura hacia el backend didáctico y los artefactos/reportes que CI publica para revisión. La UI no autoriza por sí misma: el backend debe validar actor, rol y asignación.

## Activos, amenazas, controles y verificación

| Activo | Amenaza priorizada | Control | Verificación |
|---|---|---|---|
| Asignación y estado de una incidencia | Un técnico modifica una incidencia reasignada o un actor altera una asignación. | Autorización de rol/asignación en el servicio y el límite UI → Application → Domain → Infrastructure. | `npm run test:architecture` y los contratos de backend verifican que una modificación no autorizada se rechace. |
| Incidencias, fotos y ubicación sintéticas | Un actor consulta una incidencia ajena o se filtra ubicación/evidencia en telemetría. | El backend filtra visibilidad por actor; los logs se sanitizan y el repositorio no incorpora datos reales. | Pruebas de contrato y revisión de `docs/CAMPUSOPS.md`; futuros tests negativos validarán sanitización. |
| Credenciales, tokens y archivos de entrega | Un secreto se sube al repositorio o se conserva en un artefacto de CI. | El escaneo reproducible bloquea claves privadas, tokens GitHub/AWS y variables públicas con nombres secretos; CI usa `contents: read`. | `npm run scan:secrets` termina distinto de cero ante un patrón de alta confianza y el workflow conserva reportes con `if: always()`. |

## Decisión de prioridad y riesgo residual

Se atiende primero la exposición de credenciales porque una clave publicada puede reutilizarse fuera de CampusOps y evita confiar en controles posteriores. El escaneo no detecta todos los secretos ni sustituye revisión humana, rotación o autorización del backend; por ello el riesgo residual se mantiene documentado y los datos del proyecto siguen siendo sintéticos.
