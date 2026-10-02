export interface MetaCampaignDraft {
  name: string;
  objective: 'OUTCOME_ENGAGEMENT';
  existingId?: string;
  dailyBudget?: number;
  lifetimeBudget?: number;
}

export interface MetaAdSetDraft {
  name: string;
  campaignId: string;
  dailyBudget?: number;
  lifetimeBudget?: number;
  startTime?: Date;
  endTime?: Date;
  existingId?: string;
  /** Importe de puja por conversación (CLP). Cuando está presente, el backend
   *  envía `bid_strategy: COST_CAP` + `bid_amount` a Meta. Cuando no, mantiene
   *  `LOWEST_COST_WITHOUT_CAP` (legado). */
  bidAmount?: number;
}

export interface MetaCreativeDraft {
  name: string;
  primaryText: string;
  headline: string;
  description?: string;
  image: {
    mimeType: string;
    bytes: Buffer;
  };
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
  objective?: string;
  dailyBudget?: string;
  lifetimeBudget?: string;
  effectiveStatus?: string;
  startTime?: string;
  stopTime?: string;
  sourceMeta?: boolean;
}

export interface MetaAdSetRecord {
  metaAdSetId: string;
  campaignMetaId: string;
  name: string;
  status: string;
  effectiveStatus?: string;
  dailyBudget?: string;
  lifetimeBudget?: string;
}

export interface MetaAdRecord {
  metaAdId: string;
  metaAdSetId: string;
  name: string;
  status: string;
  effectiveStatus?: string;
  creativeId?: string;
}

export interface MetaRemoteOverview {
  account: { id: string; name: string; currency: string; timezone: string };
  campaigns: Array<{
    campaign: MetaCampaignRecord;
    adSets: Array<{ adSet: MetaAdSetRecord; ads: MetaAdRecord[] }>;
  }>;
  fetchedAt: string;
}

export interface MetaMetricRecord {
  date: string;
  metaCampaignId: string;
  metaAdSetId?: string;
  metaAdId?: string;
  adSetName?: string;
  adName?: string;
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

export interface MetaBudgetStrategyResult {
  campaignMetaId: string;
  adSetMetaId: string;
  budgetAtCampaign: number | null;
  budgetAtAdSet: number | null;
  campaignBudgetSharingEnabled: boolean | null;
  notes: string[];
}

export interface MetaAdsSource {
  validateConfiguration(): Promise<MetaPreflightResult>;
  ensurePausedCampaign(input: MetaCampaignDraft): Promise<MetaRemoteRecord>;
  ensurePausedAdSet(input: MetaAdSetDraft): Promise<MetaRemoteRecord>;
  ensureCreative(input: MetaCreativeDraft): Promise<MetaRemoteRecord>;
  ensurePausedAd(input: MetaAdDraft): Promise<MetaRemoteRecord>;
  fetchCampaigns(): Promise<MetaCampaignRecord[]>;
  fetchOverview(options?: { limit?: number }): Promise<MetaRemoteOverview>;
  fetchMetrics(from: string, to: string): Promise<MetaMetricRecord[]>;
  moveBudgetToCampaign(input: {
    campaignMetaId: string;
    adSetMetaId: string;
    dailyBudget: number;
  }): Promise<MetaBudgetStrategyResult>;
  keepAdSetBudget(input: {
    campaignMetaId: string;
    adSetMetaId: string;
    dailyBudget: number;
    enableAdSetBudgetSharing: boolean;
  }): Promise<MetaBudgetStrategyResult>;
}
