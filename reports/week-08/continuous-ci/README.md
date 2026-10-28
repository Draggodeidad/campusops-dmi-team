# W08 — retroalimentación continua tras el cierre

SHA técnico: 11f0f2b (completo en validation.json). Se comprobó un checkout
desechable del commit con Node 22.22.0 y dependencias de instalación limpia.
17 pruebas de procedencia, revalidación real (feedback, W08 y sesión), verify,
public-test-week-08 y verificación del tag congelado: todos exit 0.

Los JSON históricos del checkout de trabajo no se editan. El helper sólo
actualiza copias efímeras después de controles reales aprobados y conserva
bytes/SHA/observaciones originales. El tag week-08-final conserva su SHA
3fbdee0b7118b2a77437e8c8bbfff352dbeaa36d y se comprueba por separado.
No se relaja el evaluador, cambia evidencia individual ni omite gates.

Los logs legibles sólo normalizan whitespace final; cuando aplica se retiene
la salida exacta en gzip con hashes en log-provenance.json. W09 conserva sus
pendientes independientes de integración y evidencia; esta corrección no
los acredita ni genera un tag. Asistencia de Codex declarada; ejecución y
resultados automáticos verificables, sin atribuir revisión humana nueva.
