import { apiFetch } from '../api';
import type { Campaign, CampaignSummary } from './types';

export const listCampaigns = () =>
  apiFetch<Campaign[]>('/campaigns', undefined, { cache: 'no-store' });

export const getCampaign = (id: string) =>
  apiFetch<Campaign>(`/campaigns/${id}`, undefined, { cache: 'no-store' });

export const summarizeCampaign = (id: string) =>
  apiFetch<CampaignSummary>(`/analytics/campaigns/${id}`, undefined, { cache: 'no-store' });

export interface CreateCampaignInput {
  name: string;
  objective: string;
  serviceId?: string;
  dailyBudget?: number;
  lifetimeBudget?: number;
  startDate?: string;
  endDate?: string;
  notes?: string;
}

export const createCampaign = (input: CreateCampaignInput) =>
  apiFetch<Campaign>('/campaigns', {
    method: 'POST',
    body: JSON.stringify(input),
  });

export interface CampaignWithCreative {
  campaign: Campaign;
  creative: {
    id: string;
    name: string;
    primaryText: string;
    headline: string;
    description: string | null;
    callToAction: string;
    mediaAssetId: string | null;
  };
  attachment: {
    id: string;
    attributionCode: string;
    isControl: boolean;
  };
}

export interface CreateCampaignWithCreativeInput {
  campaign: CreateCampaignInput;
  creative: {
    name: string;
    format: string;
    primaryText: string;
    headline: string;
    description?: string;
    callToAction: string;
    mediaAssetId: string;
  };
  isControl?: boolean;
}

export const createCampaignWithCreative = (input: CreateCampaignWithCreativeInput) =>
  apiFetch<CampaignWithCreative>('/campaigns/with-creative', {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const pauseCampaign = (id: string) =>
  apiFetch<Campaign>(`/campaigns/${id}/pause`, {
    method: 'PATCH',
  });

export const archiveCampaign = (id: string) =>
  apiFetch<Campaign>(`/campaigns/${id}/archive`, {
    method: 'PATCH',
  });

export interface PublishPausedResult {
  campaignId: string;
  metaCampaignId: string;
  metaAdSetId: string;
  status: string;
  creatives: Array<{
    campaignCreativeId: string;
    metaCreativeId: string;
    metaAdId: string;
    status: string;
  }>;
}

export const publishCampaignPaused = (id: string) =>
  apiFetch<PublishPausedResult>(`/meta-ads/campaigns/${id}/publish-paused`, {
    method: 'POST',
  });

export interface ImportMetricsResult {
  upserts: number;
  skipped: number;
}

export const importMetrics = (from: string, to: string) =>
  apiFetch<ImportMetricsResult>('/meta-ads/metrics/import', {
    method: 'POST',
    body: JSON.stringify({ from, to }),
  });
