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
  account: { id: string; name: string; currency: string; timezone: string };
  totals: PerformanceTotals;
  comparison: PerformanceComparison;
  campaigns: CampaignPerformanceSummary[];
  fetchedAt: string;
}
