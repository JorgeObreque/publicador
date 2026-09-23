import { z } from 'zod';

const positiveAmount = z
  .number()
  .refine((n) => Number.isFinite(n) && n > 0, { message: 'Debe ser un número positivo' })
  .optional();

const campaignFields = {
  name: z.string().trim().min(1).max(120),
  serviceId: z.string().min(1).optional(),
  objective: z.string().trim().min(1).max(60),
  dailyBudget: positiveAmount,
  lifetimeBudget: positiveAmount,
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  notes: z.string().max(2000).optional(),
} as const;

export const createCampaignSchema = z
  .object(campaignFields)
  .refine(
    (v) => !(v.startDate && v.endDate) || v.startDate <= v.endDate,
    { message: 'startDate no puede ser posterior a endDate' },
  )
  .refine(
    (v) => !(v.dailyBudget && v.lifetimeBudget),
    { message: 'Solo se admite un tipo de presupuesto por campaña' },
  );

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

export const updateCampaignSchema = z.object(campaignFields).partial();
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;

export const createCampaignWithCreativeSchema = z
  .object({
    campaign: createCampaignSchema,
    creative: z.object({
      name: z.string().trim().min(1).max(120),
      format: z.string().trim().min(1).max(40),
      primaryText: z.string().trim().min(1).max(2000),
      headline: z.string().trim().min(1).max(80),
      description: z.string().trim().max(2000).optional(),
      callToAction: z.string().trim().min(1).max(40),
      mediaAssetId: z.string().min(1),
    }),
    isControl: z.boolean().optional(),
  })
  .refine(
    (v) => Boolean(v.campaign.dailyBudget) !== Boolean(v.campaign.lifetimeBudget),
    { message: 'Solo se admite un tipo de presupuesto por campaña', path: ['campaign', 'dailyBudget'] },
  );

export type CreateCampaignWithCreativeInput = z.infer<typeof createCampaignWithCreativeSchema>;
