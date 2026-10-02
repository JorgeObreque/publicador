import { z } from 'zod';

/**
 * Tipos y esquemas Zod para el módulo de recomendaciones de copy.
 *
 * El endpoint `POST /creatives/recommendations` consume un cuerpo validado
 * por Zod y devuelve un set de 3 propuestas (texto y título) generadas por
 * OpenAI. Estos esquemas se usan tanto en el controlador como en el
 * servicio para garantizar el contrato con el frontend y para validar la
 * respuesta del modelo antes de devolverla al usuario.
 */

// === Límites del dominio ====================================================

export const PRIMARY_TEXT_MIN = 1;
export const PRIMARY_TEXT_MAX = 2000;
export const HEADLINE_MIN = 1;
export const HEADLINE_MAX = 80;
export const SUGGESTIONS_LENGTH = 3;

// === Enums ==================================================================

export const recommendationModeSchema = z.enum([
  'INITIAL',
  'REGENERATE_PRIMARY_TEXT',
  'REGENERATE_HEADLINE',
]);
export type RecommendationMode = z.infer<typeof recommendationModeSchema>;

// === Cuerpo de la request ===================================================

/**
 * Copia actual del anuncio. Se usa como referencia en `REGENERATE_*` para
 * mantener el resto de los campos estables mientras se modifica solo el
 * campo solicitado.
 */
export const currentCopySchema = z
  .object({
    primaryText: z.string().trim().max(PRIMARY_TEXT_MAX).optional(),
    headline: z.string().trim().max(HEADLINE_MAX).optional(),
  })
  .strict();
export type CurrentCopy = z.infer<typeof currentCopySchema>;

/**
 * Snapshot opcional del `CampaignBrief` aprobado por el diagnóstico
 * comercial. Permite inyectar al prompt la estrategia aprobada (objetivo,
 * oferta, KPI, cliente ideal, reglas stop/scale, etc.) para que el copy
 * generado la respete en lugar de inventar su propia dirección.
 *
 * Todos los campos son opcionales/nullable para mantener compatibilidad
 * con los flujos legacy que aún no viajan desde el wizard con un brief.
 */
export const briefContextSchema = z
  .object({
    businessObjective: z.string().trim().optional(),
    offer: z.string().trim().optional(),
    primaryKpi: z.string().trim().optional(),
    idealCustomerProfile: z.string().trim().nullable().optional(),
    qualifyingQuestions: z.array(z.string()).optional(),
    constraints: z.array(z.string()).optional(),
    stopIf: z.string().trim().nullable().optional(),
    scaleIf: z.string().trim().nullable().optional(),
    primaryConversion: z.string().trim().nullable().optional(),
    recommendedWeeklyAdd: z.number().int().nullable().optional(),
    primaryGoal: z.string().trim().nullable().optional(),
  })
  .strict();
export type BriefContext = z.infer<typeof briefContextSchema>;

/**
 * Contexto opcional provisto por el operador (notas de campaña,
 * instrucciones adicionales, etc.).
 */
export const recommendationContextSchema = z
  .object({
    campaignNotes: z.string().trim().max(2000).optional(),
    briefContext: briefContextSchema.optional(),
  })
  .strict();
export type RecommendationContext = z.infer<typeof recommendationContextSchema>;

export const recommendationRequestSchema = z
  .object({
    mode: recommendationModeSchema,
    serviceId: z.string().trim().min(1),
    mediaAssetId: z.string().trim().min(1),
    currentCopy: currentCopySchema.optional(),
    context: recommendationContextSchema.optional(),
    briefContext: briefContextSchema.optional(),
  })
  .strict();
export type RecommendationRequest = z.infer<typeof recommendationRequestSchema>;

// === Sugerencias ============================================================

export const recommendationSuggestionSchema = z.object({
  primaryText: z.string().min(PRIMARY_TEXT_MIN).max(PRIMARY_TEXT_MAX),
  headline: z.string().min(HEADLINE_MIN).max(HEADLINE_MAX),
});
export type RecommendationSuggestion = z.infer<typeof recommendationSuggestionSchema>;

export const recommendationSuggestionsSchema = z
  .array(recommendationSuggestionSchema)
  .length(SUGGESTIONS_LENGTH);
export type RecommendationSuggestions = z.infer<typeof recommendationSuggestionsSchema>;

// === Respuesta final ========================================================

export const recommendationResponseSchema = z.object({
  mode: recommendationModeSchema,
  suggestions: recommendationSuggestionsSchema,
});
export type RecommendationResponse = z.infer<typeof recommendationResponseSchema>;

// === Payload interno que se adjunta al prompt (para trazabilidad) ===========

/**
 * Snapshot del `BusinessProfile` que se pasa al prompt builder. Es opcional
 * porque si el operador aún no ha inicializado el perfil, los consumidores
 * siguen funcionando con valores por defecto (ubicación fallback, sin
 * restricciones de emojis, sin objeciones, etc.).
 *
 * Tras el corte territorial SUBDERE 2018 los campos libres `city/region/country`
 * se reemplazaron por códigos oficiales (`regionCutCode/communeCutCode/countryCode`).
 * Mantenemos `city/country` como opcionales y nullable para no romper a los
 * consumidores que aún los esperan (la snapshot es interna al prompt builder).
 */
export const businessProfileSnapshotSchema = z.object({
  addressLine: z.string().nullable().optional(),
  neighborhood: z.string().nullable().optional(),
  regionCutCode: z.string().nullable().optional(),
  communeCutCode: z.string().nullable().optional(),
  regionName: z.string().nullable().optional(),
  communeName: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  countryCode: z.string().nullable().optional(),
  brandVoiceKeywords: z.array(z.string()),
  wordsToAvoid: z.array(z.string()),
  preferredEmojiSemantics: z.array(z.string()),
  primaryCustomerProfile: z.string(),
  commonObjections: z.array(z.string()),
  ready: z.boolean(),
});
export type BusinessProfileSnapshot = z.infer<typeof businessProfileSnapshotSchema>;

export const recommendationPayloadSchema = z.object({
  mode: recommendationModeSchema,
  business: z.object({
    id: z.string().min(1),
    name: z.string(),
    description: z.string().nullable().optional(),
  }),
  service: z.object({
    id: z.string().min(1),
    name: z.string(),
    description: z.string().nullable(),
    price: z.number().nonnegative().nullable(),
    currency: z.string().min(1).optional(),
    duration: z.number().int().nullable(),
  }),
  mediaAsset: z.object({
    id: z.string().min(1),
    name: z.string(),
    mimeType: z.string(),
    kind: z.string(),
  }),
  currentCopy: currentCopySchema,
  context: recommendationContextSchema,
  briefContext: briefContextSchema.optional(),
  businessLocationNote: z.string().min(1),
  businessProfile: businessProfileSnapshotSchema.optional(),
});
export type RecommendationPayload = z.infer<typeof recommendationPayloadSchema>;
