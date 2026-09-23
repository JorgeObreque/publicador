export type CampaignStatus =
  | 'DRAFT'
  | 'PAUSED'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'ARCHIVED';

export type MetaPublishStatus = 'DRAFT' | 'PUBLISHING' | 'PAUSED' | 'FAILED';

export interface Campaign {
  id: string;
  name: string;
  objective: string;
  status: CampaignStatus;
  serviceId: string | null;
  dailyBudget: string | null;
  lifetimeBudget: string | null;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  metaCampaignId: string | null;
  metaAdSetId: string | null;
  metaPublishStatus: MetaPublishStatus;
  metaPublishError: string | null;
  metaPublishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  campaignCreatives?: Array<{
    id: string;
    attributionCode: string;
    isControl: boolean;
    metaCreativeId: string | null;
    metaAdId: string | null;
    creative: {
      id: string;
      name: string;
      primaryText: string;
      headline: string;
      description: string | null;
      callToAction: string;
      mediaAssetId: string | null;
      imageUrl: string | null;
    };
  }>;
}

export interface CampaignMetricResult {
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  revenue?: number;
  ctr: number;
  cpc: number;
  cvr: number;
  cpl: number;
  roas?: number;
}

export interface CampaignSummary {
  campaignId: string;
  name: string;
  attribution: Array<{
    creativeId: string;
    attributionCode: string;
    metrics: CampaignMetricResult;
  }>;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  revenue?: number;
  ctr: number;
  cpc: number;
  cvr: number;
  cpl: number;
  roas?: number;
}
