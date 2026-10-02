'use server';

import { analyzeCampaign } from '@/lib/overview/api';

export async function analyzeCampaignAction(metaCampaignId: string, periodDays: 7 | 30 | 90) {
  return analyzeCampaign(metaCampaignId, periodDays);
}