'use server';

import {
  approveCampaignBrief,
  archiveCampaignBrief,
  createCampaignBrief,
  getCampaignBrief,
  listCampaignBriefs,
  suggestCampaignBriefRules,
  updateCampaignBrief,
  type CampaignBriefPayload,
  type SuggestRulesResponse,
} from '@/lib/campaign-brief/api';

export async function listCampaignBriefsAction() {
  return listCampaignBriefs();
}

export async function getCampaignBriefAction(id: string) {
  return getCampaignBrief(id);
}

export async function createCampaignBriefAction(payload: CampaignBriefPayload) {
  return createCampaignBrief(payload);
}

export async function updateCampaignBriefAction(
  id: string,
  payload: Partial<CampaignBriefPayload>,
) {
  return updateCampaignBrief(id, payload);
}

export async function approveCampaignBriefAction(id: string) {
  return approveCampaignBrief(id);
}

export async function archiveCampaignBriefAction(id: string) {
  return archiveCampaignBrief(id);
}

export async function suggestRulesAction(
  briefId: string,
): Promise<SuggestRulesResponse> {
  return suggestCampaignBriefRules(briefId);
}
