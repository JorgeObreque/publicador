import { z } from 'zod';

export const decisionSchema = z.object({
  title: z.string().min(1),
  rationale: z.string().min(1),
  expectedImpact: z.string().optional(),
});

export type RecordDecisionInput = z.infer<typeof decisionSchema>;
