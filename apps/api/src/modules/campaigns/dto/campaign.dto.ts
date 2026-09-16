import { z } from 'zod';

export const createCampaignSchema = z.object({
  name: z.string().min(1),
  serviceId: z.string().optional(),
  objective: z.string().min(1),
  dailyBudget: z.number().positive().optional(),
  lifetimeBudget: z.number().positive().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  notes: z.string().optional(),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

export const updateCampaignSchema = createCampaignSchema.partial();
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
