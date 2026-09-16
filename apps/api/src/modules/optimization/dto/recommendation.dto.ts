import { z } from 'zod';

export const createRecommendationSchema = z.object({
  category: z.string().min(1),
  title: z.string().min(1),
  rationale: z.string().min(1),
  impact: z.string().min(1),
});

export type CreateRecommendationInput = z.infer<typeof createRecommendationSchema>;
