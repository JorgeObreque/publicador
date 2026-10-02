import { z } from 'zod';

/**
 * Esquemas Zod para la entrada y salida del módulo `CampaignBrief`.
 *
 * La validación se aplica en el controlador con `parse(...)` y los errores
 * se traducen a `BadRequestException` (mismo patrón que `campaigns`,
 * `creatives` y `business-profile`).
 *
 * Reglas de validación:
 * - `title`, `businessObjective`, `offer`, `primaryKpi` y `serviceId` son
 *   obligatorios: son los campos críticos que `approve()` exige antes de
 *   pasar el brief a estado `APPROVED`.
 * - Los arrays tienen `max(itemCount)` para impedir payloads abusivos.
 * - Los montos monetarios usan `coerce.number()` con `refine` que rechaza
 *   NaN/Infinity pero permite 0 (interpretado como "sin tope"). Se limitan
 *   con `max(1_000_000_000)` para alinearse con `BusinessProfile`.
 */

const TEXT_FIELDS = {
  businessObjective: z.string().trim().min(5).max(1000),
  offer: z.string().trim().min(5).max(1000),
  primaryKpi: z.string().trim().min(1).max(80),
  idealCustomerProfile: z.string().trim().max(2000).optional(),
  stopIf: z.string().trim().max(1000).optional(),
  scaleIf: z.string().trim().max(1000).optional(),
} as const;

const ITEM_FIELDS = {
  qualifyingQuestions: z.array(z.string().trim().min(1).max(400)).max(20).optional(),
  constraints: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
} as const;

const decimalField = (max: number) =>
  z
    .number()
    .refine((n) => Number.isFinite(n) && n > 0, { message: 'Debe ser un número > 0' })
    .refine((n) => n <= max, { message: `Debe ser ≤ ${max}` })
    .optional();

const NUMERIC_FIELDS = {
  monthlyAcquisitionGoal: z.number().int().positive().optional(),
  plannedDurationDays: z.number().int().positive().optional(),
} as const;

const CURRENCY_FIELDS = {
  costPerAcquisitionCap: decimalField(1_000_000_000),
  lifetimeBudgetCap: decimalField(1_000_000_000),
  dailyBudgetCap: decimalField(1_000_000_000),
} as const;

/**
 * Campos compartidos entre `createCampaignBriefSchema` y la versión
 * `partial()` del update. El orden de spread importa porque algunos
 * `refine`s viven en el objeto raíz.
 */
const BASE_FIELDS = {
  title: z.string().trim().min(3).max(120),
  serviceId: z.string().min(1),
  ...TEXT_FIELDS,
  ...ITEM_FIELDS,
  ...NUMERIC_FIELDS,
  ...CURRENCY_FIELDS,
} as const;

export const createCampaignBriefSchema = z.object(BASE_FIELDS).strict();

export type CreateCampaignBriefInput = z.infer<typeof createCampaignBriefSchema>;

export const updateCampaignBriefSchema = z
  .object({
    ...BASE_FIELDS,
  })
  .partial()
  .strict();

export type UpdateCampaignBriefInput = z.infer<typeof updateCampaignBriefSchema>;

export const CAMPAIGN_BRIEF_STATUSES = ['DRAFT', 'APPROVED', 'ARCHIVED'] as const;
export type CampaignBriefStatusFilter = (typeof CAMPAIGN_BRIEF_STATUSES)[number];

export const CAMPAIGN_BRIEF_MAX_ARRAY_ITEMS = {
  qualifyingQuestions: 20,
  constraints: 20,
} as const;

/**
 * Conjunto exacto de campos que `approve()` exige tener no vacíos. Lo
 * compartimos para que las validaciones del servicio (que lanza
 * `BadRequestException` si falta alguno) coincidan con lo que la UI exige
 * en el botón "Crear y aprobar".
 */
export const REQUIRED_APPROVAL_FIELDS = [
  'title',
  'businessObjective',
  'offer',
  'primaryKpi',
  'serviceId',
] as const;

/**
 * Resumen compacto de una campaña ejecutada desde un brief. Lo devuelve
 * `CampaignBriefService.list` y `getById` dentro del campo `executions`
 * para alimentar el panel unificado de "planes comerciales", y se
 * expone también vía `GET /campaign-briefs/:id/executions`.
 *
 * Es deliberadamente liviano: NO incluye `campaignCreatives`, métricas
 * ni `notes` para no inflar la respuesta cuando un brief tiene muchas
 * ejecuciones. Si la UI necesita el detalle completo, debe llamar a
 * `GET /campaigns/:id`.
 */
export const campaignExecutionSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(['DRAFT', 'PAUSED', 'ACTIVE', 'COMPLETED', 'ARCHIVED']),
  dailyBudget: z.string().nullable(),
  lifetimeBudget: z.string().nullable(),
  metaPublishStatus: z.enum(['DRAFT', 'PUBLISHING', 'PAUSED', 'FAILED']),
  metaPublishedAt: z.string().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  createdAt: z.string(),
});

export type CampaignExecutionSummary = z.infer<typeof campaignExecutionSummarySchema>;

export type CampaignBriefResponse = {
  id: string;
  businessId: string;
  serviceId: string;
  title: string;
  status: 'DRAFT' | 'APPROVED' | 'ARCHIVED';
  businessObjective: string;
  offer: string;
  primaryKpi: string;
  idealCustomerProfile: string | null;
  qualifyingQuestions: string[];
  monthlyAcquisitionGoal: number | null;
  costPerAcquisitionCap: string | null;
  lifetimeBudgetCap: string | null;
  dailyBudgetCap: string | null;
  plannedDurationDays: number | null;
  constraints: string[];
  stopIf: string | null;
  scaleIf: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  createdAt: string;
  updatedAt: string;
  /**
   * Ejecuciones (`Campaign`) vinculadas a este brief. Sólo aparece en
   * respuestas de `list()` y `getById()`; las campañas huérfanas
   * (`campaignBriefId = NULL`) nunca se incluyen aquí.
   */
  executions: CampaignExecutionSummary[];
};
