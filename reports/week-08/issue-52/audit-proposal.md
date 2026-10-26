# Propuesta separada de dependencias — sin aplicar

Fuente reproducible: audit-production.json y audit-analysis.json de esta carpeta.
`npm audit --omit=dev --json` informa ocho entradas high: Expo es directa;
@expo/cli, @expo/code-signing-certificates, brace-expansion, compression,
node-forge, source-map-js y zod son transitivas. Sobreviven a omitir dev y no
se deben describir como ocho dependencias exclusivamente de desarrollo.
Su procedencia principal es el tooling de Expo. Esto no demuestra que cada
paquete sea alcanzable en el bundle móvil exportado.

Proponer un PR independiente `fix/security-compatible-transitives`, posterior
a la congelación W08, con actualización acotada del lockfile dentro de rangos:

| Paquete | Instalado | Objetivo publicado compatible |
|---|---|---|
| brace-expansion | 1.1.18 y 5.0.9 | 1.1.21 y 5.0.12, conservando cada major |
| compression | 1.8.1 | 1.8.2, permitido por ^1.7.4 |
| source-map-js | 1.2.1 | 1.2.2, permitido por ^1.2.1 |

No garantizar compatibilidad sólo por semver: revisar el diff del lockfile,
repetir npm ci, tipos/lint, arquitectura, W06/readiness, W08, feedback y export
Android. Comparar audit antes/después y conservar los hallazgos restantes.
No aplicar paquetes, overrides ni cambios de umbral en el PR de evidencias.

node-forge 1.4.0 es la última versión consultada y el advisory no publica un
parche; no inventar 1.4.1 ni aceptar el downgrade a Expo 54 que sugiere audit.
El parche Zod 4.6.6 existe, pero Expo CLI declara ^3.25.76: imponer Zod 4 sería
un cambio de major incompatible con el contrato declarado. Proponer seguimiento
del proveedor compatible con Expo 57; no afirmar que existe una corrección
segura para las ocho entradas. La copia Zod 4 de ESLint es dev adicional y no
debe confundirse con la copia Zod 3 de Expo incluida en estas ocho entradas.

Fuentes primarias de seguridad:
- https://github.com/advisories/GHSA-vc2v-76pw-4v95
- https://github.com/advisories/GHSA-68fv-2mgg-jv7q
- https://github.com/advisories/GHSA-86w9-cpqp-85rv
- https://github.com/advisories/GHSA-mrhx-c7xc-m3w5

Estado: propuesta documental, sin PR vacío y sin actualizaciones aplicadas.
