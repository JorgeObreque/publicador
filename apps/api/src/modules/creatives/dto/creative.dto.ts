import { z } from 'zod';

export const createCreativeSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    format: z.string().trim().min(1).max(40),
    primaryText: z.string().trim().min(1).max(2000),
    headline: z.string().trim().min(1).max(80),
    description: z.string().trim().max(2000).optional(),
    callToAction: z.string().trim().min(1).max(40),
    imageUrl: z
      .string()
      .trim()
      .url({ message: 'imageUrl debe ser una URL válida' })
      .max(2000)
      .optional(),
    mediaAssetId: z.string().min(1).optional(),
    isAiGenerated: z.boolean().optional(),
  })
  .refine(
    (value) => Boolean(value.imageUrl) !== Boolean(value.mediaAssetId),
    {
      message: 'Debes proporcionar exactamente una fuente de imagen: imageUrl o mediaAssetId',
      path: ['mediaAssetId'],
    },
  );

export type CreateCreativeInput = z.infer<typeof createCreativeSchema>;

export const attachCreativeSchema = z.object({
  campaignId: z.string().min(1),
  creativeId: z.string().min(1),
  isControl: z.boolean().optional(),
});

export type AttachCreativeInput = z.infer<typeof attachCreativeSchema>;
