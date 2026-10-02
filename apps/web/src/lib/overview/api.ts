import { apiFetch } from '../api';

export interface RemoteCampaign {
  id: string;
  businessId: string;
  metaCampaignId: string;
  name: string;
  status: string;
  effectiveStatus: string | null;
  objective: string | null;
  dailyBudget: string | null;
  lifetimeBudget: string | null;
  startTime: string | null;
  stopTime: string | null;
  fetchedAt: string;
}

export interface RemoteOverview {
  account: { id: string; name: string; currency: string; timezone: string };
  campaigns: Array<{
    campaign: {
      metaCampaignId: string;
      name: string;
      status: string;
      effectiveStatus?: string;
      objective?: string;
      dailyBudget?: string;
      lifetimeBudget?: string;
      startTime?: string;
      stopTime?: string;
    };
    adSets: Array<{
      adSet: {
        metaAdSetId: string;
        campaignMetaId: string;
        name: string;
        status: string;
        effectiveStatus?: string;
        dailyBudget?: string;
        lifetimeBudget?: string;
      };
      ads: Array<{
        metaAdId: string;
        metaAdSetId: string;
        name: string;
        status: string;
        effectiveStatus?: string;
        creativeId?: string;
      }>;
    }>;
  }>;
  fetchedAt: string;
}

export interface OverviewResult {
  upserts: number;
  account: RemoteOverview['account'];
  fetchedAt: string;
}

export interface PerformanceRange {
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
  days: number;
}

export interface PerformanceTotals {
  spend: number;
  impressions: number;
  clicks: number;
  results: number;
  ctr: number;
  cpc: number;
  cpl: number;
  conversionRate: number;
  currency: string;
}

export interface PerformanceComparison {
  spendDelta: number | null;
  resultsDelta: number | null;
  cplDelta: number | null;
  ctrDelta: number | null;
  cpcDelta: number | null;
}

export interface CampaignPerformanceSummary {
  metaCampaignId: string;
  campaignName: string;
  status: string | null;
  effectiveStatus: string | null;
  dailyBudget: string | null;
  lifetimeBudget: string | null;
  totals: PerformanceTotals;
  comparison: PerformanceComparison;
  hasResults: boolean;
  missingDailyData: boolean;
}

export interface AccountPerformance {
  range: PerformanceRange;
  account: RemoteOverview['account'];
  totals: PerformanceTotals;
  comparison: PerformanceComparison;
  campaigns: CampaignPerformanceSummary[];
  fetchedAt: string;
}

export interface DailyPerformance {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  results: number;
}

export interface AdPerformance {
  metaAdId: string;
  metaAdSetId: string | null;
  adName: string | null;
  adSetName: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  results: number;
  ctr: number;
  cpl: number;
}

export interface CampaignPerformance {
  range: PerformanceRange;
  totals: PerformanceTotals;
  comparison: PerformanceComparison;
  daily: DailyPerformance[];
  ads: AdPerformance[];
  importedAt: string;
}

export const importRemoteCampaigns = (limit?: number) =>
  apiFetch<OverviewResult>('/meta-ads/campaigns/remote/import', {
    method: 'POST',
    body: JSON.stringify({ limit: limit ?? 50 }),
  });

export const listRemoteCampaigns = () =>
  apiFetch<RemoteCampaign[]>('/meta-ads/campaigns/remote', undefined, { cache: 'no-store' });

export const fetchOverview = (limit = 50) =>
  apiFetch<RemoteOverview>(`/meta-ads/overview?limit=${limit}`, undefined, { cache: 'no-store' });

export const fetchAccountPerformance = (from: string, to: string) =>
  apiFetch<AccountPerformance>(`/meta-ads/performance?from=${from}&to=${to}`, undefined, {
    cache: 'no-store',
  });

export const fetchCampaignPerformance = (metaCampaignId: string, from: string, to: string) =>
  apiFetch<CampaignPerformance>(
    `/meta-ads/campaigns/remote/${metaCampaignId}/performance?from=${from}&to=${to}`,
    undefined,
    { cache: 'no-store' },
  );

export const importMetrics = (from: string, to: string) =>
  apiFetch<{ upserts: number; skipped: number; remoteUpserts: number }>(
    '/meta-ads/metrics/import',
    {
      method: 'POST',
      body: JSON.stringify({ from, to }),
    },
  );

export interface PerformanceAnalysis {
  summary: string;
  diagnosis: string;
  action: 'WAIT' | 'KEEP' | 'CREATE_VARIANT' | 'REVIEW_CONVERSION' | 'NEEDS_MORE_DATA';
  recommendedVariable: 'PRIMARY_TEXT' | 'HEADLINE' | 'IMAGE' | 'BUDGET' | 'TARGETING' | 'NONE';
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  evidence: string[];
  caveats: string[];
  recommendedNextStep: string;
}

export interface AnalyzeRunResult {
  campaignId: string;
  periodFrom: string;
  periodTo: string;
  analysis: PerformanceAnalysis;
}

export const analyzeCampaign = (metaCampaignId: string, periodDays: 7 | 30 | 90 = 30) =>
  apiFetch<AnalyzeRunResult>(
    `/meta-ads/campaigns/remote/${metaCampaignId}/analyze`,
    { method: 'POST', body: JSON.stringify({ periodDays }) },
    { cache: 'no-store' },
  );

export const computeRange = (days: number): { from: string; to: string } => {
  const today = new Date();
  const to = today.toISOString().slice(0, 10);
  const fromDate = new Date(today.getTime() - (days - 1) * 86_400_000);
  return { from: fromDate.toISOString().slice(0, 10), to };
};
