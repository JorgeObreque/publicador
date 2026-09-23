import { formatCurrency } from '../format';
import type { CampaignSummary } from './types';

export interface CampaignInsights {
  spendLabel: string;
  clicksLabel: string;
  conversionsLabel: string;
  revenueLabel: string | null;
  averagePerConversion: string | null;
  hasResults: boolean;
  rangeLabel: string;
}

export const summarizeInsights = (summary: CampaignSummary): CampaignInsights => {
  const hasResults = summary.impressions > 0 || summary.clicks > 0 || summary.conversions > 0;
  return {
    spendLabel: formatCurrency(summary.spend),
    clicksLabel: summary.clicks.toLocaleString('es-CL'),
    conversionsLabel: summary.conversions.toLocaleString('es-CL'),
    revenueLabel:
      summary.revenue !== undefined && summary.revenue !== null
        ? formatCurrency(summary.revenue)
        : null,
    averagePerConversion:
      summary.conversions > 0 ? formatCurrency(summary.spend / summary.conversions) : null,
    hasResults,
    rangeLabel: 'Período actual',
  };
};
