import { z } from 'zod';

export const createExperimentSchema = z.object({
  campaignId: z.string().min(1),
  name: z.string().min(1),
  hypothesis: z.string().min(1),
  primaryKpi: z.string().min(1),
  variantIds: z.array(z.string()).min(2),
  controlIndex: z.number().int().nonnegative().optional(),
});

export type CreateExperimentInput = z.infer<typeof createExperimentSchema>;

export const completeExperimentSchema = z.object({
  outcome: z.string().optional(),
});
