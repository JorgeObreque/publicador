export interface MetaCampaignDraft {
  name: string;
  objective: 'OUTCOME_ENGAGEMENT';
  existingId?: string;
}

export interface MetaAdSetDraft {
  name: string;
  campaignId: string;
  dailyBudget?: number;
  lifetimeBudget?: number;
  startTime?: Date;
  endTime?: Date;
  existingId?: string;
}

export interface MetaCreativeDraft {
  name: string;
  primaryText: string;
  headline: string;
  description?: string;
  imageUrl: string;
  attributionCode: string;
  existingId?: string;
}

export interface MetaAdDraft {
  name: string;
  adSetId: string;
  creativeId: string;
  existingId?: string;
}

export interface MetaRemoteRecord {
  id: string;
  name: string;
  status?: string;
}

export interface MetaCampaignRecord {
  metaCampaignId: string;
  name: string;
  status: string;
}

export interface MetaMetricRecord {
  date: string;
  metaCampaignId: string;
  metaAdId?: string;
  impressions: number;
  clicks: number;
  spend: number;
  leads: number;
}

export interface MetaPreflightResult {
  accountId: string;
  accountName: string;
  currency: string;
  timezone: string;
}

export interface MetaAdsSource {
  validateConfiguration(): Promise<MetaPreflightResult>;
  ensurePausedCampaign(input: MetaCampaignDraft): Promise<MetaRemoteRecord>;
  ensurePausedAdSet(input: MetaAdSetDraft): Promise<MetaRemoteRecord>;
  ensureCreative(input: MetaCreativeDraft): Promise<MetaRemoteRecord>;
  ensurePausedAd(input: MetaAdDraft): Promise<MetaRemoteRecord>;
  fetchCampaigns(): Promise<MetaCampaignRecord[]>;
  fetchMetrics(from: string, to: string): Promise<MetaMetricRecord[]>;
}
