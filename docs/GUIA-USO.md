# Guía de uso — Elephant-Goldfish Model en DeepSeek Harness

Este plugin trae el **Elephant-Goldfish Model (EGM)** a DeepSeek Harness (DSH).
EGM separa dos roles: el **Elefante** (tu sesión, que tiene todo el contexto y
redacta el documento) y los **Goldfish** (revisores que leen el documento sin la
conversación previa, para encontrar supuestos no declarados). Vos decidís los
trade-offs y aprobás el diseño antes de implementar.

Todo corre con el modelo configurado en DSH. No llama a ninguna API externa.

---

## 1. Requisitos e instalación

- DSH instalado y abierto (Desktop o `dsh web`), con permiso total para instalar
  plugins.
- Una carpeta de proyecto abierta como directorio de trabajo de la sesión: ahí
  se escriben los artefactos (`concepts_brief.md`, `design_draft.md`, reportes).

Instalación (una vez por perfil):

```text
plugin_manager { action: "install_bundle", target: "github:marcelosf80/dsh-elephant-goldfish" }
```

La respuesta esperada incluye `application: "applied"` y `warnings: []`.

> **Después de instalar, actualizar o cambiar de fuente (link ↔ GitHub),
> reiniciá el Harness una vez.** El proceso en ejecución conserva el módulo que
> ya importó; el reinicio carga la versión nueva. Las sesiones se conservan.

## 2. Verificar que quedó instalado

1. Abrí una sesión nueva o reiniciá la actual.
2. Escribí `/egm-drift-report` o mirá el selector de skills: deberían aparecer
   `egm-bootstrap`, `egm-drift-report`, `egm-resolve` y `egm-review-loop`.
   Las otras tres (`egm-brainstorm`, `egm-draft`, `egm-review`) son de uso
   humano: no aparecen en el catálogo del modelo a propósito, se invocan con `/`.
3. Si no aparece nada: `plugin_manager { action: "list_bundles" }` debe mostrar
   `dsh-elephant-goldfish` con `enabled: true`.

## 3. Las siete skills

| Skill | Para qué sirve | Cómo se inicia |
| --- | --- | --- |
| `egm-brainstorm` | Explorar una idea con 7 lentes y escribir el brief | `/egm-brainstorm <idea>` |
| `egm-draft` | Convertir el brief en documento de diseño, sección por sección | `/egm-draft` |
| `egm-review` | Revisión Goldfish en 5 estadios con reportes | `/egm-review <archivo.md>` |
| `egm-resolve` | Procesar hallazgos y aplicar correcciones aprobadas | `/egm-resolve` |
| `egm-review-loop` | Correr un grupo de revisores para una tarea puntual | `/egm-review-loop` |
| `egm-bootstrap` | Documentar un repositorio existente (READMEs por carpeta) | `/egm-bootstrap <ruta>` |
| `egm-drift-report` | Comparar documentos de diseño contra el código actual | `/egm-drift-report <carpeta>` |

La forma de invocarlas es escribir `/nombre` como palabra suelta en tu mensaje.
No hace falta nada más.

---

## 4. Flujo completo recomendado

### Paso 0 — Preparar el proyecto

Abrí la carpeta del proyecto como directorio de trabajo. El agente escribe los
artefactos ahí. Si querés guardarlos en una subcarpeta, agregá esta línea a tu
primer mensaje o a un `AGENTS.md` del proyecto:

```text
EGM artifact directory: docs/designs
```

### Paso 1 — Explorar la idea (brainstorm)

```text
/egm-brainstorm Agregar entrega de webhooks para eventos de pedido.
```

Qué pasa:

1. El agente te hace **preguntas abiertas** (problema, consumidor, restricciones,
   casos borde, cómo se mide el éxito) durante varios turnos. Respondé en chat.
2. Cuando el problema está claro, resume una **hipótesis anclada** y te muestra
   un gate con dos opciones: `Review with Goldfishes` (seguir) o `Clarify
   additional constraints...` (seguir charlando).
3. Si aprobás, lanza **7 revisores en paralelo** (contrarian/YAGNI, costos y
   cuotas, UX, migración, observabilidad, deuda técnica, TRIZ) y consolida.
4. Escribe **`concepts_brief.md`** con el brief acordado. Te avisa con la ruta.

### Paso 2 — Redactar el diseño (draft)

```text
/egm-draft
```

O, si querés indicar el brief explícitamente:

```text
/egm-draft Context File: docs/designs/concepts_brief.md
```

Qué pasa: redacta `design_draft.md` en este orden — **Overview / Goals /
Problema / Non-Goals** → **Technical Plan** → **Alternatives** →
**Implementation** → finalización. Después de cada sección:

- te muestra un resumen corto en chat y el link al archivo (nunca vuelca el
  documento entero en el chat);
- te pide aprobar o pedir cambios.

Podés responder con la opción, o escribir los cambios en chat, o editar
directamente `design_draft.md` y luego aprobar.

> En DSH no existen los comentarios inline sobre artefactos: las correcciones
> van como texto en el chat o como ediciones al archivo.

### Paso 3 — Revisión Goldfish (review)

```text
/egm-review design_draft.md
```

Te va a pedir el modo de revisión (un gate de una sola pregunta):

1. **Interactive** — los 5 estadios con checkpoint después de cada uno.
2. **Consolidated** — los 5 estadios sin pausas, un reporte consolidado.
3. **Feature spec only** — estadios 5 a 8 (sin plan de implementación).
4. **Implementation plan only** — solo el estadio 9.

Si ya sabés qué querés, salteá el gate indicando el estadio:

```text
/egm-review design_draft.md Step: 5
```

Los cinco estadios y qué producen:

| Estadio | Revisores | Reporte |
| --- | --- | --- |
| 5 — Zoom Out inicial | zoom_out + inventive_catalyst (2) | `zoom_out_report.md` |
| 6 — Comprensión | comprehension (1) | `comprehension_report.md` |
| 7 — Crítica | design + structural + style (3) | `critic_report.md` |
| 8 — Zoom Out intermedio | zoom_out (1) | `intermediate_zoom_out_report.md` |
| 9 — Readiness de implementación | implementation_readiness + codebase_details + style (3) | `implementation_readiness_report.md` |
| Consolidado | todos los anteriores | `consolidated_review_report.md` |

Cada revisor arranca en **contexto limpio** (no ve la conversación) y recibe solo
su persona, el estándar y los archivos que correspondan.

### Paso 4 — Resolver hallazgos (resolve)

En el checkpoint del estadio 7 o 9 elegí `Resolve findings with agent`, o invocá:

```text
/egm-resolve
```

Qué pasa: clasifica cada hallazgo en CONTEST / ESCALATE / PROPOSE FIX / DECLINE,
escribe **`goldfish_review_report.md`** y espera tu decisión (auto-accept,
interactivo ítem por ítem, o continuar sin cambios). Aplica solo lo aprobado
sobre `design_draft.md` y recalcula líneas si seguís revisando.

---

## 5. Cómo responder los gates

Los gates de EGM tienen reglas estrictas, y DSH las respeta:

- **Una sola pregunta por turno.** No te va a preguntar dos cosas juntas.
- **Opciones claras, sin “(Recommended)”.** La primera opción es la acción
  principal, pero la decisión es tuya.
- **Para datos abiertos** (una ruta, un texto libre) te lo pide en chat, no como
  múltiple opción.
- Si un gate no tiene respuesta posible, respondé `pause`/cerrá el flujo: los
  reportes ya escritos quedan guardados.

## 6. Artefactos que genera

| Archivo | Cuándo aparece |
| --- | --- |
| `concepts_brief.md` | Fin de `egm-brainstorm` |
| `design_draft.md` | `egm-draft` (se completa sección por sección) |
| `zoom_out_report.md`, `comprehension_report.md`, `critic_report.md`, `intermediate_zoom_out_report.md`, `implementation_readiness_report.md` | Estadios 5–9 de `egm-review` |
| `consolidated_review_report.md` | Modo consolidado |
| `goldfish_review_report.md` | `egm-resolve` |
| `YYYY-MM-DD_DRIFT_REPORT.md` | `egm-drift-report` |
| `README.md` por carpeta | `egm-bootstrap` |

Todos se escriben en el directorio de trabajo (o en el `EGM artifact directory`
si lo definiste). **Nunca** dentro del plugin.

## 7. Usos sueltos

```text
/egm-drift-report docs/designs
```
Compara cada documento de diseño con el código real y reporta solo las
divergencias (o “No drift detected”).

```text
/egm-bootstrap src/
```
Recorre el árbol y genera/actualiza READMEs por carpeta con el contrato real del
código. En DSH el relevamiento se hace inline (no puede delegar en cascada).

```text
/egm-review-loop
```
Para revisar un documento contra un grupo de revisores y estándares que elegís
vos, sin pasar por el flujo completo de `egm-review`.

## 8. Ejemplos copiables

```text
/egm-brainstorm Quiero que los tenants reciban eventos de pedido en tiempo real en vez de hacer polling cada 30 segundos.
```

```text
/egm-draft Context File: concepts_brief.md
```

```text
/egm-review design_draft.md Step: 5
```

```text
/egm-review docs/designs/checkout.md
```

```text
/egm-drift-report docs/designs
```

## 9. Cuánto cuesta cada paso

No hay números fijos: depende del modelo y del tamaño del documento. Como guía:

| Etapa | Subagentes | Costo relativo |
| --- | --- | --- |
| `egm-brainstorm` | 7 revisores + consolidación | alto |
| `egm-draft` | ninguno (solo tu sesión) | bajo |
| `egm-review` completo | 10 revisores (2+1+3+1+3) | alto |
| `egm-review Step: 5` | 2 revisores | medio |
| `egm-resolve` | ninguno | bajo |
| `egm-drift-report` | ninguno (lecturas) | medio |

Sugerencia: arrancá con `Step: 5` para validar la dirección y corré el flujo
completo cuando el documento esté maduro.

## 10. Límites de este port

- **Profundidad de delegación 1.** Un subagente no puede delegar en otro. Por eso
  los revisores se lanzan desde la sesión principal y `egm-synthesizer` es solo
  una forma de prompt aquí.
- **Revisores en modo lectura por instrucción**, no por una allowlist del host.
  El prompt les prohíbe escribir y delegar.
- **Aislamiento de contexto:** un revisor nuevo no ve la conversación previa,
  pero sí los archivos de instrucciones del proyecto (`AGENTS.md`). No pegues
  hallazgos de revisores anteriores en su prompt.
- **Sin comentarios inline:** las revisiones se piden en chat o editando el
  archivo.
- Si en tu perfil se activa el *tool-result pruner* con su umbral de 8192
  caracteres, cargar `egm-review` (≈24 KB) podría recortarse; en el perfil
  Desktop está desactivado y lo verifiqué sin recorte.

## 11. Problemas comunes

| Síntoma | Causa / solución |
| --- | --- |
| `/egm-review` no hace nada | La skill no está activa: revisá `list_bundles` y reiniciá tras instalar/actualizar. |
| “cannot read the skills directory” | El proceso quedó con un módulo viejo cacheado: reiniciá el Harness. |
| No encuentro los archivos generados | Están en el directorio de trabajo de la sesión (o en `EGM artifact directory`). |
| El revisor dice que no puede leer su persona | Ruta mal pasada: el prompt debe llevar rutas absolutas al paquete instalado. |
| Quiero que los revisores usen otro modelo | Hoy el perfil solo autoriza DeepSeek; el tool `subagent` acepta `provider`/`model` si agregás rutas. |

## 12. Buenas prácticas

1. **Vos sos el Elefante.** EGM no decide arquitectura por vos: te presenta
   opciones con sus trade-offs y espera tu elección.
2. **Contexto primero.** Cuanto mejor sea el brief del brainstorm, mejor sale el
   draft.
3. **No aceptes por cansancio.** Los revisores están diseñados para discutir;
   si un hallazgo no aplica, contestalo (CONTEST) con evidencia legible.
4. **Guardá los documentos aprobados** en `docs/designs/` y usá
   `/egm-drift-report` cada tanto para detectar cuándo el código se alejó del
   diseño.
5. **Reiniciá después de actualizar el plugin** desde GitHub.

## 13. Referencias

- Mapeo técnico al harness: [`docs/dsh.md`](dsh.md)
- Evidencia de instalación y pruebas: [`VERIFICATION.md`](../VERIFICATION.md)
- Proyecto original: https://github.com/google/elephant-goldfish-model
- Plugin publicado: https://github.com/marcelosf80/dsh-elephant-goldfish
