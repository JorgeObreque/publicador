# Backlog del Publicador

## Resumen ejecutivo

Estado del producto al 26 sep 2026: el MVP está operativo de extremo a extremo
para un único negocio (`BUSINESS_ID=blondor`, ver `docs/adr/0003-contexto-negocio-unico-sin-auth.md`),
con publicación siempre pausada (`docs/adr/0004-meta-pausado-aprobacion-explicita.md`),
sincronización por polling desde Meta y Google Drive, y citas atribuidas vía
EasyAppointments. **En esta sesión se entregaron dos superficies nuevas de IA**:
el análisis de rendimiento bajo demanda en `/overview/[metaCampaignId]` (endpoint
`POST /api/v1/meta-ads/campaigns/remote/:metaCampaignId/analyze`) y las
recomendaciones de copy en el wizard `/campaigns/new` (endpoint
`POST /api/v1/creatives/recommendations`). Todo lo entregado sigue el principio
de `docs/adr/0007-creativos-openai.md`: la IA propone, el operador revisa y
edita, nunca se publica sin confirmación humana y nada se persiste todavía.

El backlog restante se centra en cerrar el ciclo de memoria (Insights, historial
de generaciones, decisiones), endurecer invariantes de dominio que el MVP dejó
relajadas y dejar plantadas las mejoras futuras que dependen de decisiones
previas (almacenamiento, autenticación, video).

## Tabla maestra

| ID    | Tarea                                                                       | Prioridad | Estado    |
|-------|-----------------------------------------------------------------------------|-----------|-----------|
| BL-01 | Persistir análisis de rendimiento como `Insight`                            | Alta      | Pendiente |
| BL-02 | Persistir historial de propuestas de copy                                   | Alta      | Pendiente |
| BL-03 | Vincular `OptimizationRecommendation` con campañas/creativos                | Alta      | Pendiente |
| BL-04 | Implementar Versión B para creativos                                       | Media     | Pendiente |
| BL-05 | Edición de copy de creativos ya persistidos (`PATCH`)                       | Media     | Pendiente |
| BL-06 | Persistir decisiones (`DecisionLog`) en todo el flujo IA                    | Alta      | Pendiente |
| BL-07 | Validaciones reforzadas en `PATCH /campaigns/:id`                           | Alta      | Pendiente |
| BL-08 | Búsqueda de `Insight` y `DecisionLog` para `/overview/[metaCampaignId]`     | Media     | Pendiente |
| BL-09 | Generación y almacenamiento de imágenes con IA                              | Baja      | Pendiente |
| BL-10 | Soporte completo de video en el wizard                                      | Baja      | Pendiente |
| BL-11 | Rate limiting en endpoints con costo                                        | Media     | Pendiente |
| BL-12 | Imagen UNCROP automática vía Meta                                           | Baja      | Pendiente |

> Leyenda de estado: **Hecho** = entregado y verificado; **En curso** =
> implementación iniciada; **Pendiente** = aún no se empezó. Ningún ítem está
> hoy en curso; los dos logros de la sesión se documentan arriba y no requieren
> entrada propia en la tabla.

---

## BL-01 — Persistir análisis de rendimiento como `Insight`

- **Prioridad:** Alta
- **Estado:** Pendiente

El endpoint `POST /api/v1/meta-ads/campaigns/remote/:metaCampaignId/analyze` ya
existe y devuelve el diagnóstico generado por OpenAI, pero el servicio no
escribe nada en base de datos: la respuesta se calcula en cada request y se
pierde. Es necesario registrar cada corrida como un `Insight` (modelo Prisma
definido en `packages/database/prisma/schema.prisma`) ligado al `Business` del
contexto, con `category` derivada del `action` del análisis y `severity`
mapeada desde `confidence` (LOW → INFO, MEDIUM → WARNING, HIGH → CRITICAL).

- **Archivos relevantes:**
  - `apps/api/src/modules/analyze/analyze.service.ts` (quitar el comentario
    `TODO: persistir Insight + OptimizationRecommendation + DecisionLog tras aprobación`).
  - `apps/api/src/modules/analyze/analyze.module.ts` (importar `InsightsModule`
    o el repositorio Prisma).
  - `apps/api/src/modules/insights/insights.service.ts` (reutilizar como
    colaborador o referencia de contrato).
  - `packages/database/prisma/schema.prisma` (modelo `Insight` ya tiene los
    campos necesarios; sólo se necesita `experimentId` opcional o crear un
    enlace a `MetaRemoteCampaign` si se quiere navegar desde el overview).
- **Referencias:** `docs/adr/0007-creativos-openai.md`,
  `docs/product/HU-11-resultados.md`, `docs/product/user-stories.md`.

---

## BL-02 — Persistir historial de propuestas de copy

- **Prioridad:** Alta
- **Estado:** Pendiente

El endpoint `POST /api/v1/creatives/recommendations` (`apps/api/src/modules/creative-recommendations/creative-recommendations.controller.ts`)
genera tres propuestas por llamada pero no deja rastro de los prompts enviados,
el modelo usado, los tokens consumidos ni cuál de las tres sugerencias eligió
finalmente el operador. La trazabilidad de IA que exige
`docs/adr/0007-creativos-openai.md` (`isAiGenerated=true`) se pierde en cuanto
se cierra el modal del wizard.

Propuesta: introducir el modelo `CreativeGenerationRun` (negocio, modo,
`serviceId`, `mediaAssetId`, `currentCopy`, prompts completos, modelo,
`promptTokens`, `completionTokens`, `estimatedCostUsd`, sugerencia elegida,
`createdAt`) y guardar cada request más su selección.

- **Archivos relevantes:**
  - `apps/api/src/modules/creative-recommendations/creative-recommendations.service.ts`.
  - `apps/api/src/modules/creative-recommendations/creative-recommendations.types.ts`.
  - `apps/api/src/modules/creative-recommendations/creative-recommendations.prompt.ts`.
  - `packages/database/prisma/schema.prisma` (nuevo modelo + migración DDL
    versionada, según `docs/adr/0002-postgresql-prisma-ddl-versionado.md`).
- **Referencias:** `docs/adr/0007-creativos-openai.md`,
  `docs/product/HU-04-escribir-anuncio.md`.

---

## BL-03 — Vincular `OptimizationRecommendation` con campañas/creativos

- **Prioridad:** Alta
- **Estado:** Pendiente

El modelo Prisma `OptimizationRecommendation`
(`packages/database/prisma/schema.prisma`) existe y el módulo
`apps/api/src/modules/optimization/optimization.controller.ts` lo expone con
`POST`, `GET`, `PATCH .../accept` y `PATCH .../reject`, pero la tabla está
suelta: no tiene FK a `Campaign`, `CampaignCreative` ni `MetaRemoteCampaign`.
Eso impide filtrar "recomendaciones que afectan a la campaña X" o agrupar por
servicio en el overview. La aceptar/rechazar hoy funciona como bitácora plana
y se desacopla de la realidad operativa.

- **Archivos relevantes:**
  - `packages/database/prisma/schema.prisma` (añadir relaciones opcionales con
    `Campaign`, `CampaignCreative`, `MetaRemoteCampaign`; mantener `experimentId`
    sólo si la recomendación nace de un experimento).
  - `apps/api/src/modules/optimization/optimization.service.ts`.
  - `apps/api/src/modules/optimization/dto/recommendation.dto.ts`.
- **Referencias:** `docs/adr/0007-creativos-openai.md`,
  `docs/product/HU-14-registrar-decisiones.md`.

---

## BL-04 — Implementar Versión B para creativos

- **Prioridad:** Media
- **Estado:** Pendiente

`docs/product/HU-05-segunda-version.md` declara "Ninguno. Se reutiliza el
endpoint `POST /api/v1/creatives` con distintos creativos", pero hoy el flujo
de creación exige crear un creativo por separado y adjuntarlo después con
`POST /api/v1/creatives/attach`. El wizard no guía al usuario para etiquetar
las versiones como **A** / **B` ni para cambiar una sola variable a la vez.
Falta una vista dedicada y, opcionalmente, un endpoint que cree la Versión B
copiando el `CampaignCreative` y dejando al operador modificar exactamente un
campo (imagen, texto o título).

- **Archivos relevantes:**
  - `apps/api/src/modules/creatives/creatives.controller.ts`.
  - `apps/api/src/modules/creatives/creatives.service.ts`.
  - `apps/api/src/modules/creatives/dto/creative.dto.ts`.
  - `apps/web/src/app/campaigns/new/` (wizard; añadir paso opcional de versión B).
  - `docs/product/HU-05-segunda-version.md`.
- **Referencias:** `docs/product/HU-12-comparar-ab.md`,
  `docs/product/user-stories.md`.

---

## BL-05 — Edición de copy de creativos ya persistidos

- **Prioridad:** Media
- **Estado:** Pendiente

`apps/api/src/modules/creatives/creatives.controller.ts` expone `GET`,
`GET /:id`, `POST`, `POST /attach` y `GET /by-campaign/:campaignId`. No hay
ningún `PATCH /api/v1/creatives/:id`, por lo que una vez creado un creativo
no se puede corregir el `primaryText`, `headline` o `description` sin
duplicarlo. El frontend tampoco tiene UI de edición. ADR 0007 obliga a que la
versión final enviada a Meta sea la editada por el operador, así que este
hueco bloquea cualquier corrección post-creación.

- **Archivos relevantes:**
  - `apps/api/src/modules/creatives/creatives.controller.ts` (añadir `Patch`).
  - `apps/api/src/modules/creatives/creatives.service.ts`.
  - `apps/api/src/modules/creatives/dto/creative.dto.ts` (nuevo
    `updateCreativeSchema` con `.partial()` y validación de longitudes).
  - `apps/web/src/lib/campaigns/` (cliente que llame al nuevo endpoint).
- **Referencias:** `docs/adr/0007-creativos-openai.md`,
  `docs/product/HU-04-escribir-anuncio.md`.

---

## BL-06 — Persistir decisiones (`DecisionLog`) en todo el flujo IA

- **Prioridad:** Alta
- **Estado:** Pendiente

`apps/api/src/modules/decision-log/decision-log.module.ts` ya está
implementado y `OptimizationService` ya graba entradas al aceptar/rechazar
recomendaciones (`apps/api/src/modules/optimization/optimization.service.ts`),
pero el flujo IA entregado en esta sesión **no** lo usa:

- `POST /api/v1/meta-ads/campaigns/remote/:metaCampaignId/analyze` no graba
  decisión cuando el operador descarta o aplica el diagnóstico.
- `POST /api/v1/creatives/recommendations` no graba qué propuesta eligió el
  usuario (queda ligado a BL-02).

Falta decidir si cada `DecisionLogEntry` se crea al aceptar la sugerencia o
también cuando se descarta, y cómo se encadena con el `Insight` o el
`CreativeGenerationRun` resultante.

- **Archivos relevantes:**
  - `apps/api/src/modules/decision-log/decision-log.service.ts`.
  - `apps/api/src/modules/decision-log/dto/decision.dto.ts`.
  - `apps/api/src/modules/analyze/analyze.service.ts`.
  - `apps/api/src/modules/creative-recommendations/creative-recommendations.service.ts`.
  - `packages/database/prisma/schema.prisma` (`DecisionLogEntry`).
- **Referencias:** `docs/adr/0007-creativos-openai.md`,
  `docs/product/HU-14-registrar-decisiones.md`.

---

## BL-07 — Validaciones reforzadas en `PATCH /campaigns/:id`

- **Prioridad:** Alta
- **Estado:** Pendiente

`apps/api/src/modules/campaigns/dto/campaign.dto.ts` define:

```
export const updateCampaignSchema = z.object(campaignFields).partial();
```

Es decir, el `PATCH /campaigns/:id` actual acepta cualquier subconjunto de
campos sin aplicar las invariantes de creación (presupuesto único entre
`dailyBudget` y `lifetimeBudget`, coherencia `startDate <= endDate`). Un
cliente puede hoy enviar ambos presupuestos en cero y romper la regla de
negocio. Hay que reaplicar las mismas refinements de `createCampaignSchema`
sobre el update, conservando la opcionalidad por campo.

- **Archivos relevantes:**
  - `apps/api/src/modules/campaigns/dto/campaign.dto.ts`.
  - `apps/api/src/modules/campaigns/campaigns.service.ts`.
  - `apps/api/src/modules/campaigns/campaigns.controller.ts`.
  - Tests de campañas en `apps/api/src/modules/campaigns/`.
- **Referencias:** `docs/product/HU-07-validaciones.md`,
  `docs/product/HU-06-presupuesto.md`.

---

## BL-08 — Búsqueda de `Insight` y `DecisionLog` para `/overview/[metaCampaignId]`

- **Prioridad:** Media
- **Estado:** Pendiente`

`apps/web/src/app/overview/[metaCampaignId]/page.tsx` muestra hoy sólo
métricas remotas (`PerformanceService.campaignPerformance`). Una vez que BL-01
y BL-06 estén entregados, la pantalla debe enriquecerse con un timeline que
liste los `Insight` asociados a la campaña y las `DecisionLogEntry` que
recibieron aceptación o rechazo. Implica tanto un endpoint
(`GET /api/v1/meta-ads/campaigns/remote/:metaCampaignId/timeline`) como el
componente de timeline en el frontend.

- **Archivos relevantes:**
  - `apps/web/src/app/overview/[metaCampaignId]/page.tsx`.
  - `apps/web/src/app/overview/actions.ts`.
  - `apps/web/src/lib/overview/`.
  - `apps/api/src/modules/insights/insights.controller.ts`.
  - `apps/api/src/modules/decision-log/decision-log.controller.ts`.
- **Referencias:** `docs/product/HU-10-detalle-campana.md`,
  `docs/product/HU-14-registrar-decisiones.md`.

---

## BL-09 — Generación y almacenamiento de imágenes con IA

- **Prioridad:** Baja
- **Estado:** Pendiente

`docs/adr/0007-creativos-openai.md` menciona generación de imágenes como
parte de la decisión ("OpenAI como proveedor para copy e imágenes") pero hoy
sólo se generan textos. Existe un bloqueo de almacenamiento: Google Drive es
de sólo lectura (`docs/operations/google-drive.md` y diseño actual de
`MediaAsset`) y no se almacenan bytes localmente. Cualquier implementación
tiene que resolver antes dónde se persisten los PNG/JPG resultantes y cómo
se vuelven un `MediaAsset` válido para `creatives.mediaAssetId`.

- **Archivos relevantes:**
  - `apps/api/src/modules/analyze/openai.client.ts` (extender para imágenes).
  - `apps/api/src/modules/media-asset/media-asset.service.ts`.
  - `apps/api/src/modules/google-drive/google-drive.service.ts` (decidir si se
    sube a Drive de escritura o se almacena en otro destino).
  - `packages/database/prisma/schema.prisma` (`MediaAsset`).
- **Referencias:** `docs/adr/0007-creativos-openai.md`,
  `docs/adr/0008-sincronizacion-por-polling.md`,
  `docs/operations/google-drive.md`.

---

## BL-10 — Soporte completo de video en el wizard

- **Prioridad:** Baja
- **Estado:** Pendiente

El wizard `/campaigns/new` permite seleccionar `MediaAsset` con `kind=VIDEO`,
pero el endpoint `POST /campaigns/with-creative` rechaza videos en la
validación (sólo acepta formatos de imagen). El flujo queda roto de cara al
operador: puede elegirlos pero no publicarlos. Aceptar video requiere, además
de relajar la validación, definir cómo se traduce a `creative.format` en Meta
y qué `callToAction` aplica por defecto.

- **Archivos relevantes:**
  - `apps/api/src/modules/campaigns/dto/campaign.dto.ts`
    (`createCampaignWithCreativeSchema`).
  - `apps/api/src/modules/campaigns/campaigns.service.ts`.
  - `apps/api/src/modules/media-asset/media-asset.service.ts` (HEIF converter
    y validaciones de tipo).
  - `apps/web/src/app/campaigns/new/`.
- **Referencias:** `docs/product/HU-03-galeria-drive.md`,
  `docs/product/HU-04-escribir-anuncio.md`.

---

## BL-11 — Rate limiting en endpoints con costo

- **Prioridad:** Media
- **Estado:** Pendiente

Los endpoints `POST /api/v1/meta-ads/campaigns/remote/:metaCampaignId/analyze`
y `POST /api/v1/creatives/recommendations` consumen OpenAI (costo en USD y
tokens) y están expuestos en la red sin protección. `docs/adr/0003-contexto-negocio-unico-sin-auth.md`
acepta la ausencia de autenticación, pero no excusa la ausencia de rate
limiting: cualquier request loop externo multiplica el costo. Implementar un
rate limiter en memoria o por IP en el API Gateway / NestJS
(`@nestjs/throttler`) con cuotas razonables por minuto y por hora.

- **Archivos relevantes:**
  - `apps/api/src/modules/analyze/analyze.controller.ts`.
  - `apps/api/src/modules/creative-recommendations/creative-recommendations.controller.ts`.
  - `apps/api/src/main.ts` o un `AppModule` con `ThrottlerModule`.
  - `apps/api/src/app.module.ts`.
- **Referencias:** `docs/adr/0003-contexto-negocio-unico-sin-auth.md`,
  `docs/adr/0007-creativos-openai.md`.

---

## BL-12 — Imagen UNCROP automática vía Meta

- **Prioridad:** Baja
- **Estado:** Pendiente

Mejora futura ya evaluada y diferida en sesión. La API de Meta permite
solicitar `image_url` adicional y dejar que la plataforma recorte
automáticamente cuando el asset subido no encaja en el formato del placement.
Hoy subimos siempre el recorte hecho a mano por la operadora, lo que implica
más trabajo manual y duplicación de assets en `MediaAsset`. Mantener este
ítem en backlog y revisarlo cuando se aborde BL-09 (almacenamiento) y BL-10
(video).

- **Archivos relevantes:**
  - `apps/api/src/modules/meta-ads/meta-ads.service.ts`.
  - `apps/api/src/modules/meta-ads/meta-graph-ads.source.ts`.
  - `apps/api/src/modules/media-asset/media-asset.service.ts`.
- **Referencias:** `docs/adr/0010-zona-horaria-cuenta-meta.md`,
  `docs/operations/meta-ads.md`.

---

## Notas operativas

- Toda superficie IA listada arriba debe seguir `docs/adr/0007-creativos-openai.md`:
  la IA propone, el operador edita, nada se publica sin confirmación humana y
  las propuestas deben marcarse como `isAiGenerated=true`.
- Los entregables de esta sesión (`/overview/[metaCampaignId]` con análisis IA
  y `/campaigns/new` con recomendaciones de copy) **no** aparecen como tareas
  en la tabla maestra porque ya están cerrados; sí se referencian en los
  ítems BL-01, BL-02 y BL-06 como el origen del trabajo pendiente.
- Los modelos Prisma `Insight`, `OptimizationRecommendation` y
  `DecisionLogEntry` ya existen en `packages/database/prisma/schema.prisma` y
  siguen el versionado DDL de `docs/adr/0002-postgresql-prisma-ddl-versionado.md`;
  los ítems BL-01, BL-02 y BL-03 deberían usarlos en lugar de crear modelos
  paralelos.
- Cualquier cambio de comportamiento en el wizard o en el overview debe venir
  acompañado de tests siguiendo `docs/adr/0009-estrategia-de-testing.md` y de
  una nota en `docs/reviews/` si implica revisar el contrato con el operador.
