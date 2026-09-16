export interface MetaCampaignDraft {
  name: string;
  objective: string;
  status: 'PAUSED' | 'ACTIVE';
  dailyBudget?: number;
  specialAdCategories?: string[];
}

export interface MetaCampaignRecord {
  metaCampaignId: string;
  name: string;
  status: string;
}

export interface MetaMetricRecord {
  date: Date;
  metaCampaignId: string;
  metaCreativeId?: string;
  impressions: number;
  clicks: number;
  spend: number;
  leads: number;
}

export interface MetaAdsSource {
  ensurePausedCampaign(input: MetaCampaignDraft): Promise<MetaCampaignRecord>;
  fetchCampaigns(): Promise<MetaCampaignRecord[]>;
  fetchMetrics(from: Date, to: Date): Promise<MetaMetricRecord[]>;
}
