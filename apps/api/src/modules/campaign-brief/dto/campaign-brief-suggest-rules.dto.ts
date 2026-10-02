import { z } from 'zod';

/**
 * Esquemas Zod para el módulo "suggest-rules" del `CampaignBrief`.
 *
 * Endpoint: `POST /api/v1/campaign-briefs/:id/suggest-rules`.
 *
 * El servicio no recibe body: el brief se identifica por `:id` en la URL.
 * Este archivo define únicamente el contrato de la RESPUESTA (que el
 * controlador valida con `safeParse` para garantizar el shape que verá el
 * frontend antes de devolverla).
 *
 * Reglas de validación:
 * - `stopIf` / `scaleIf` son strings de máximo 280 caracteres (alineado
 *   con el límite definido en el system prompt del servicio).
 * - `source` marca el origen de la sugerencia: `'AI'` cuando viene del
 *   modelo real y `'FALLBACK'` cuando el servicio de IA no respondió
 *   y se aplicó un fallback determinista.
 */

export const RULE_MAX_LENGTH = 280;

export const suggestRulesSourceSchema = z.enum(['AI', 'FALLBACK']);
export type SuggestRulesSource = z.infer<typeof suggestRulesSourceSchema>;

export const suggestRulesResponseSchema = z.object({
  stopIf: z.string().min(1).max(RULE_MAX_LENGTH),
  scaleIf: z.string().min(1).max(RULE_MAX_LENGTH),
  source: suggestRulesSourceSchema,
});
export type SuggestRulesResponse = z.infer<typeof suggestRulesResponseSchema>;