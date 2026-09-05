# Semana 01 — Guía para osbaldoXxC y JulianDele

> REGLA DE ORO: si algo da error, NO lo arregles solo. Manda captura del
> error al equipo (Draggodeidad) ANTES de intentar cualquier otra cosa.
> No borres nada, no fuerces nada y no uses `-f` en ningún comando.

## 0. Verifica que estás en el repo correcto

Abre una terminal en la carpeta del proyecto y ejecuta:

```bash
git remote -v
```

Debes ver EXACTAMENTE estas dos líneas (la URL correcta es
`campusops-dmi-team`):

```
origin  https://github.com/Draggodeidad/campusops-dmi-team.git (fetch)
origin  https://github.com/Draggodeidad/campusops-dmi-team.git (push)
```

- Si la URL es OTRA (otro curso, otro repo): detente, no sigas.
- Si dice `fatal: not a git repository`: no estás en la carpeta correcta.
- En ambos casos: manda captura antes de continuar.

## 1. Node 22.22.0 (una sola vez)

```bash
nvm install 22.22.0 && nvm use
```

Comprueba:

```bash
node --version
```

Debe decir `v22.22.0`. Si `nvm` no existe o el comando falla, avisa con
captura (no instales nada por tu cuenta).

## 2. Actualiza el repo

```bash
git pull origin main
```

## 3. Crea TU rama

osbaldoXxC:

```bash
git checkout -b feat/week-01-osbaldoxxc
```

JulianDele:

```bash
git checkout -b feat/week-01-juliandele
```

## 4. Configura tu identidad (una sola vez)

Usa el correo que registraste con el docente.

osbaldoXxC:

```bash
git config user.name "osbaldoXxC"
git config user.email "CORREO_QUE_REGISTRASTE"
```

JulianDele:

```bash
git config user.name "JulianDele"
git config user.email "CORREO_QUE_REGISTRASTE"
```

## 5. Edita SOLO tu archivo

- **osbaldoXxC** → archivo `docs/problem-definition.md`, sección
  **"Criterios de aceptación"**. Borra cada línea que diga
  `<COMPLETAR: osbaldoXxC>` y en su lugar escribe UN criterio verificable
  (ej.: "Al presionar Reportar, la incidencia aparece en la lista con
  estado abierta"). No edites ninguna otra parte del archivo.
- **JulianDele** → archivo `docs/risk-register.md`, sección
  **"Plan de mitigación (detalle por riesgo)"**. Borra cada línea que diga
  `<COMPLETAR: JulianDele>` y escribe UNA acción concreta para ese riesgo
  (ej.: "Guardar cada operación en la cola local antes de enviarla al
  servidor"). No edites ninguna otra parte del archivo.

No toques otros archivos. Si una línea no te queda clara, pregunta antes de
escribir.

## 6. Corre el smoke test y guarda la salida COMPLETA

```bash
make setup
mkdir -p reports/week-01
```

osbaldoXxC:

```bash
npm run test:smoke > reports/week-01/smoke-osbaldoxxc.txt 2>&1
cat reports/week-01/smoke-osbaldoxxc.txt
```

JulianDele:

```bash
npm run test:smoke > reports/week-01/smoke-juliandele.txt 2>&1
cat reports/week-01/smoke-juliandele.txt
```

Copia TODA la salida que veas en pantalla (no solo "pasó"). La usarás en el
paso 10. Si `make setup` tarda o falla, NO te saltes este paso: manda
captura.

## 7. Guarda y sube tu trabajo

osbaldoXxC:

```bash
git add docs/problem-definition.md reports/week-01/smoke-osbaldoxxc.txt
git commit -m "week-01: criterios de aceptacion (osbaldoXxC)"
git push -u origin feat/week-01-osbaldoxxc
```

JulianDele:

```bash
git add docs/risk-register.md reports/week-01/smoke-juliandele.txt
git commit -m "week-01: plan de mitigacion (JulianDele)"
git push -u origin feat/week-01-juliandele
```

## 8. Abre tu PR

Entra a https://github.com/Draggodeidad/campusops-dmi-team → verás el botón
amarillo "Compare & pull request". Haz clic, confirma el título y pulsa
"Create pull request".

**NO presiones "Merge".** Los merge los hace Draggodeidad.

## 9. Revisa el PR del otro (review cruzado)

osbaldoXxC revisa el PR de JulianDele y JulianDele el de osbaldoXxC:

1. En la pestaña "Pull requests", abre el PR del otro.
2. Pestaña "Files changed".
3. Botón verde "Review changes" → selecciona "Approve" → "Submit review".
4. **Copia la URL de la página del PR** (ej.
   `https://github.com/Draggodeidad/campusops-dmi-team/pull/2`) y guárdala.

## 10. Crea tu evidencia individual

Crea el archivo de TU usuario y pega esta plantilla (reemplaza todo lo que
está entre llaves angulares):

- osbaldoXxC → archivo `evidence/week-01/individual.osbaldoxxc.json`
- JulianDele  → archivo `evidence/week-01/individual.juliandele.json`

```json
{
  "studentId": "<TU_USUARIO_GITHUB>",
  "commitShas": ["<PEGA_AQUI_EL_RESULTADO_DE_git_rev-parse_HEAD>"],
  "files": ["<TU_ARCHIVO: docs/problem-definition.md o docs/risk-register.md>"],
  "tests": [],
  "reviews": ["<URL_DEL_PR_DEL_OTRO_DEL_PASO_9>"],
  "prediction": "<Qué esperabas que pasara con tu cambio. 1-2 frases.>",
  "command": "npm run test:smoke",
  "observedResult": "<EN UNA SOLA LÍNEA: la última parte de la salida del test, ej. Tests: 1 passed, 1 total>",
  "explanation": "<Por qué hiciste este cambio y qué demostró. 1-2 frases.>"
}
```

Para el `commitShas`, ejecuta en la terminal:

```bash
git rev-parse HEAD
```

y copia las 40 letras/números exactas dentro de los corchetes.

## 11. Sube tu evidencia

osbaldoXxC:

```bash
git add evidence/week-01/individual.osbaldoxxc.json
git commit -m "week-01: evidencia individual osbaldoXxC"
git push
```

JulianDele:

```bash
git add evidence/week-01/individual.juliandele.json
git commit -m "week-01: evidencia individual JulianDele"
git push
```

## 12. Avisa al equipo

Envía al grupo: captura de `git remote -v`, captura de la salida del smoke
test y la URL de tu PR. Draggodeidad revisa y mergea.

---

## Si algo falla (en cualquier paso)

1. NO borres nada, NO fuerces nada, NO uses `-f`.
2. Toma captura completa del error (incluye el comando que escribiste).
3. Envíala al grupo y espera respuesta.
