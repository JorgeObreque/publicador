import { z } from 'zod';

export const trackingEventSchema = z.object({
  eventType: z.enum(['CLICK', 'VISIT', 'WHATSAPP_OPEN', 'FORM_SUBMIT']),
  eventId: z.string().min(1),
  source: z.string().optional(),
  medium: z.string().optional(),
  campaign: z.string().optional(),
  campaignId: z.string().optional(),
  campaignCreativeId: z.string().optional(),
  occurredAt: z.coerce.date().optional(),
  payload: z.record(z.unknown()).optional(),
});

export type TrackingEventInput = z.infer<typeof trackingEventSchema>;
