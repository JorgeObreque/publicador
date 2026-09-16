import { z } from 'zod';

export const createCreativeSchema = z.object({
  name: z.string().min(1),
  format: z.string().min(1),
  primaryText: z.string().min(1),
  headline: z.string().min(1),
  description: z.string().optional(),
  callToAction: z.string().min(1),
  imageUrl: z.string().url().optional(),
  isAiGenerated: z.boolean().optional(),
});

export type CreateCreativeInput = z.infer<typeof createCreativeSchema>;

export const attachCreativeSchema = z.object({
  campaignId: z.string().min(1),
  creativeId: z.string().min(1),
  isControl: z.boolean().optional(),
});

export type AttachCreativeInput = z.infer<typeof attachCreativeSchema>;
