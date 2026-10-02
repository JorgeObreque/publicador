import { z } from 'zod';

/**
 * Tipos y esquemas Zod para el módulo de análisis con IA.
 *
 * El prompt enviado a OpenAI y la respuesta validada en Node comparten
 * estructura, pero se mantienen en dos esquemas distintos para poder
 * endurecer las validaciones de salida sin tocar la forma del payload.
 */

const nullableNumber = z.number().finite().nullable();

export const performancePromptPayloadSchema = z.object({
  campaign: z.object({
    metaCampaignId: z.string().min(1),
    name: z.string(),
    status: z.string().nullable(),
    dailyBudget: z.number().finite().nullable(),
    lifetimeBudget: z.number().finite().nullable(),
  }),
  period: z.object({
    from: z.string(),
    to: z.string(),
    days: z.number().int().positive(),
  }),
  currency: z.string().min(1),
  totals: z.object({
    spend: z.number().nonnegative(),
    impressions: z.number().int().nonnegative(),
    clicks: z.number().int().nonnegative(),
    results: z.number().int().nonnegative(),
    ctr: z.number().nonnegative(),
    cpc: z.number().nonnegative(),
    cpl: z.number().nonnegative(),
    conversionRate: z.number().nonnegative(),
  }),
  comparison: z.object({
    spendDelta: nullableNumber,
    resultsDelta: nullableNumber,
    cplDelta: nullableNumber,
    ctrDelta: nullableNumber,
    cpcDelta: nullableNumber,
  }),
  daily: z
    .array(
      z.object({
        date: z.string(),
        spend: z.number().nonnegative(),
        impressions: z.number().int().nonnegative(),
        clicks: z.number().int().nonnegative(),
        results: z.number().int().nonnegative(),
      }),
    )
    .max(30),
  hasPreviousPeriod: z.boolean(),
  hasDailyBreakdown: z.boolean(),
});

export type PerformancePromptPayload = z.infer<typeof performancePromptPayloadSchema>;

export const performanceAnalysisActionSchema = z.enum([
  'WAIT',
  'KEEP',
  'CREATE_VARIANT',
  'REVIEW_CONVERSION',
  'NEEDS_MORE_DATA',
]);
export type PerformanceAnalysisAction = z.infer<typeof performanceAnalysisActionSchema>;

export const performanceAnalysisVariableSchema = z.enum([
  'PRIMARY_TEXT',
  'HEADLINE',
  'IMAGE',
  'BUDGET',
  'TARGETING',
  'NONE',
]);
export type PerformanceAnalysisVariable = z.infer<typeof performanceAnalysisVariableSchema>;

export const performanceAnalysisConfidenceSchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);
export type PerformanceAnalysisConfidence = z.infer<typeof performanceAnalysisConfidenceSchema>;

export const performanceAnalysisSchema = z.object({
  summary: z.string().min(1),
  diagnosis: z.string().min(1),
  action: performanceAnalysisActionSchema,
  recommendedVariable: performanceAnalysisVariableSchema,
  confidence: performanceAnalysisConfidenceSchema,
  evidence: z.array(z.string().min(1)).min(3).max(6),
  caveats: z.array(z.string().min(1)).max(3),
  recommendedNextStep: z.string().min(1),
});

export type PerformanceAnalysis = z.infer<typeof performanceAnalysisSchema>;

export const analyzeRunResultSchema = z.object({
  campaignId: z.string().min(1),
  periodFrom: z.string().min(1),
  periodTo: z.string().min(1),
  analysis: performanceAnalysisSchema,
});

export type AnalyzeRunResult = z.infer<typeof analyzeRunResultSchema>;
