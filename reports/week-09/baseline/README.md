# Observaciones del baseline #60

`validation.json` indexa comandos y códigos de salida reales del commit técnico
`9b1af62f0cf7a824480c152748af75cf42b76d84`. Este commit posterior sólo agrega
reports; no cambia código/configuración/docs. Los logs son salida observada,
no reportes finales de fault injection/retry metrics ni evidencia individual.
En los logs se normalizan únicamente espacios finales y líneas vacías finales;
`validation.json` conserva hashes de salida original y del texto versionado.
El índice global queda **fail** porque las cuatro pruebas públicas W09 siguen
en stubs y faltan los cinco entregables oficiales. No se afirma W09 completa.

- `zip-inventory-before-integration.json`: comparación previa a copiar, después
  de la extracción/lectura completa fuera del repositorio.
- `zip-inventory.json`: reproducción mediante la herramienta versionada; compara
  todos los miembros con el mismo SHA base antes de extraer en otro directorio.
- `kit-integration.json`: revisión por archivo, acción y hash del resultado.
- `install-comparison.json`: diferencia oficial con el INSTALL acumulado de main;
  se combinó conservando todas las semanas anteriores.
- `setup.log`: instalación inicial con Node 22.22.0, después de copiar el kit y
  antes de los commits técnicos; lock y dependencias permanecieron idénticos.
  Se distingue del SHA comprobado posteriormente, sin atribuirle esa ejecución.
- `baseline.log`: cuatro pruebas del harness, no de proveedor/retry productivos.
- `feedback.log`: tipos, lint, 87 pruebas anteriores, arquitectura, secretos,
  auditoría crítica y export Android Expo. La auditoría informa siete
  vulnerabilidades high en el árbol conservado; el gate crítico retorna 0.
- `session*.log`: readiness (8 regresiones) y 31 pruebas W06.
- `week08.log`: 107 pruebas W08 y probe SQLite; no prueba nativa Android W09.
- `public-isolated.log`: cuatro fallos reales en los dos stubs W09 conservados.
- `verify-w09.log` / `evaluator-verify.json`: verificación estructural pasa;
  este comando no valida comportamiento W09 ni los cinco entregables.
- `public-w09.log` / `evaluator-public.json`: falla por stubs/artefactos ausentes;
  las 87 pruebas anteriores pasan. El evaluador limita su propia salida;
  el log aislado conserva el detalle completo de los cuatro fallos W09.
- `preserve-history.log`: diff vacío sobre app, contratos públicos, dependencias,
  workflows y evidencias previas; código de salida registrado en el índice.
- `diff-check.log`: comprobación de whitespace del cambio técnico.

Para reproducir se requiere Node 22.22.0 (`nvm use`), `make setup` y los comandos
de `validation.json`; el ZIP se proporciona por ruta local a la herramienta.
El ZIP original no se publica dentro de Git. No hay proveedor externo elegido,
llamada externa, implementación de caché/retry, tag, APK, envío Classroom,
aportes ajenos ni revisión humana acreditados. Ayuda de IA y pendientes se
explicitan en el índice y en `docs/week-09-baseline.md`.
