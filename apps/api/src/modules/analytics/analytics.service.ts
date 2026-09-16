import { Injectable } from '@nestjs/common';
import { prisma } from '@publicador/database';
import { BusinessContextResolver } from '../../shared/business-context/business-context.resolver';
import { computeMetrics, MetricInputs, MetricResults, VariantResult, compareVariants } from './metrics';

export interface CampaignSummary extends MetricResults {
  campaignId: string;
  name: string;
  attribution: Array<{
    creativeId: string;
    attributionCode: string;
    metrics: MetricResults;
  }>;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly businessContext: BusinessContextResolver) {}

  private get businessId(): string {
    return this.businessContext.resolve().businessId;
  }

  async summarize(campaignId: string): Promise<CampaignSummary> {
    const campaign = await prisma.campaign.findFirst({
      where: { businessId: this.businessId, id: campaignId },
      include: { campaignCreatives: true, metrics: true, conversions: true },
    });
    if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

    const aggregate = aggregateMetrics(campaign.metrics, campaign.conversions);
    const attribution = campaign.campaignCreatives.map((cc) => {
      const creativeMetrics = campaign.metrics.filter((m) => m.campaignCreativeId === cc.id);
      const creativeConversions = campaign.conversions.filter(
        (c) => c.campaignCreativeId === cc.id,
      );
      const metrics = aggregateMetrics(creativeMetrics, creativeConversions);
      return {
        creativeId: cc.creativeId,
        attributionCode: cc.attributionCode,
        metrics,
      };
    });

    return { campaignId: campaign.id, name: campaign.name, attribution, ...aggregate };
  }

  async compareVariants(experimentId: string) {
    const experiment = await prisma.experiment.findFirst({
      where: { businessId: this.businessId, id: experimentId },
      include: { variants: true, campaign: { include: { metrics: true, conversions: true } } },
    });
    if (!experiment) throw new Error(`Experiment ${experimentId} not found`);

    const variants: VariantResult[] = experiment.variants.map((variant) => {
      const metrics = experiment.campaign.metrics.filter(
        (m) => m.campaignCreativeId === variant.campaignCreativeId,
      );
      const conversions = experiment.campaign.conversions.filter(
        (c) => c.campaignCreativeId === variant.campaignCreativeId,
      );
      return {
        variantCode: variant.campaignCreativeId,
        metrics: aggregateMetrics(metrics, conversions),
      };
    });

    return compareVariants(variants);
  }
}

function aggregateMetrics(
  metrics: Array<{ impressions: number; clicks: number; spend: PrismaLike; leads: number }>,
  conversions: Array<{ amount: PrismaLike | null }>,
): MetricResults {
  const totals: MetricInputs = metrics.reduce<MetricInputs>(
    (acc, m) => ({
      impressions: acc.impressions + m.impressions,
      clicks: acc.clicks + m.clicks,
      spend: acc.spend + toNumber(m.spend),
      conversions: acc.conversions + m.leads,
      revenue: acc.revenue ?? 0,
    }),
    { impressions: 0, clicks: 0, spend: 0, conversions: 0, revenue: 0 },
  );

  for (const conversion of conversions) {
    totals.revenue = (totals.revenue ?? 0) + toNumber(conversion.amount);
  }

  const metricResults = computeMetrics(totals);
  return {
    ...metricResults,
    conversions: conversions.length > 0 ? conversions.length : metricResults.conversions,
  };
}

type PrismaLike = number | { toString(): string } | null;

function toNumber(value: PrismaLike): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  return Number(value.toString());
}
