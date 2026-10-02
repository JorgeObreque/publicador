import { BadRequestException, Injectable } from '@nestjs/common';
import { prisma } from '@publicador/database';
import { Prisma } from '@publicador/database';
import { BusinessContextResolver } from '../../shared/business-context/business-context.resolver';
import type {
  AccountPerformance,
  AdPerformance,
  CampaignPerformance,
  CampaignPerformanceSummary,
  DailyPerformance,
  PerformanceComparison,
  PerformanceRange,
  PerformanceTotals,
} from './performance.types';

interface RawDailyRow {
  date: Date;
  impressions: number;
  clicks: number;
  spend: Prisma.Decimal | number | null;
  leads: number;
}

const toNumber = (value: Prisma.Decimal | number | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  return Number(value.toString());
};

const percentChange = (current: number, previous: number): number | null => {
  if (previous === 0) {
    if (current === 0) return 0;
    return null;
  }
  return ((current - previous) / previous) * 100;
};

const parseDay = (value: string): Date => {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`Fecha inválida: ${value}`);
  }
  return date;
};

const dayKey = (value: Date): string => value.toISOString().slice(0, 10);

@Injectable()
export class PerformanceService {
  constructor(private readonly businessContext: BusinessContextResolver) {}

  private get businessId(): string {
    return this.businessContext.resolve().businessId;
  }

  async getRange(from: string, to: string): Promise<PerformanceRange> {
    if (from > to) throw new BadRequestException('from no puede ser posterior a to');
    const fromDate = parseDay(from);
    const toDate = parseDay(to);
    const days = Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000) + 1;
    const previousToDate = new Date(fromDate.getTime() - 86_400_000);
    const previousFromDate = new Date(previousToDate.getTime() - (days - 1) * 86_400_000);
    return {
      from,
      to,
      previousFrom: dayKey(previousFromDate),
      previousTo: dayKey(previousToDate),
      days,
    };
  }

  async summarize(from: string, to: string): Promise<AccountPerformance> {
    const range = await this.getRange(from, to);
    const campaigns = await prisma.metaRemoteCampaign.findMany({
      where: { businessId: this.businessId },
      orderBy: { name: 'asc' },
    });
    if (campaigns.length === 0) {
      const account = this.fetchAccountFromEnv();
      return this.emptyAccount(range, account);
    }
    const account = this.fetchAccountFromEnv();
    const summaries: CampaignPerformanceSummary[] = [];
    for (const campaign of campaigns) {
      const totals = await this.aggregateTotals(campaign.metaCampaignId, range);
      const previous = await this.aggregateTotals(campaign.metaCampaignId, {
        ...range,
        from: range.previousFrom,
        to: range.previousTo,
      });
      summaries.push({
        metaCampaignId: campaign.metaCampaignId,
        campaignName: campaign.name,
        status: campaign.status,
        effectiveStatus: campaign.effectiveStatus,
        dailyBudget: campaign.dailyBudget,
        lifetimeBudget: campaign.lifetimeBudget,
        totals,
        comparison: this.compare(totals, previous),
        hasResults: totals.impressions + totals.clicks + totals.results > 0,
        missingDailyData: totals.impressions === 0 && totals.clicks === 0 && totals.results === 0,
      });
    }
    const aggregate = await this.aggregateAccountTotals(range, campaigns.map((c) => c.metaCampaignId));
    const previousAccount = await this.aggregateAccountTotals(
      { ...range, from: range.previousFrom, to: range.previousTo },
      campaigns.map((c) => c.metaCampaignId),
    );
    return {
      range,
      account,
      totals: aggregate,
      comparison: this.compare(aggregate, previousAccount),
      campaigns: summaries,
      fetchedAt: new Date().toISOString(),
    };
  }

  async campaignPerformance(metaCampaignId: string, from: string, to: string): Promise<CampaignPerformance> {
    const range = await this.getRange(from, to);
    const campaign = await prisma.metaRemoteCampaign.findFirst({
      where: { businessId: this.businessId, metaCampaignId },
    });
    if (!campaign) {
      throw new BadRequestException(`No se encontró la campaña Meta ${metaCampaignId}`);
    }
    const [totals, previousTotals, daily, ads] = await Promise.all([
      this.aggregateTotals(metaCampaignId, range),
      this.aggregateTotals(metaCampaignId, {
        ...range,
        from: range.previousFrom,
        to: range.previousTo,
      }),
      this.dailyBreakdown(metaCampaignId, range),
      this.adBreakdown(metaCampaignId, range),
    ]);
    return {
      range,
      totals,
      comparison: this.compare(totals, previousTotals),
      daily,
      ads,
      importedAt: new Date().toISOString(),
    };
  }

  private fetchAccountFromEnv() {
    return {
      id: process.env.META_AD_ACCOUNT_ID ? `act_${process.env.META_AD_ACCOUNT_ID}` : 'act_unknown',
      name: process.env.META_AD_ACCOUNT_ID ?? 'Cuenta publicitaria',
      currency: process.env.BUSINESS_CURRENCY ?? 'CLP',
      timezone: process.env.META_AD_ACCOUNT_TIMEZONE ?? 'UTC',
    };
  }

  private emptyAccount(range: PerformanceRange, account: Awaited<ReturnType<PerformanceService['fetchAccountFromEnv']>>): AccountPerformance {
    return {
      range,
      account,
      totals: this.emptyTotals(account.currency),
      comparison: { spendDelta: null, resultsDelta: null, cplDelta: null, ctrDelta: null, cpcDelta: null },
      campaigns: [],
      fetchedAt: new Date().toISOString(),
    };
  }

  private emptyTotals(currency: string): PerformanceTotals {
    return {
      spend: 0,
      impressions: 0,
      clicks: 0,
      results: 0,
      ctr: 0,
      cpc: 0,
      cpl: 0,
      conversionRate: 0,
      currency,
    };
  }

  private async aggregateTotals(metaCampaignId: string, range: PerformanceRange): Promise<PerformanceTotals> {
    const rows = await prisma.metaRemoteMetricDaily.findMany({
      where: {
        businessId: this.businessId,
        metaCampaignId,
        date: {
          gte: parseDay(range.from),
          lte: parseDay(range.to),
        },
      },
      select: { impressions: true, clicks: true, spend: true, leads: true },
    });
    return this.summarizeRows(rows);
  }

  private async aggregateAccountTotals(
    range: PerformanceRange,
    metaCampaignIds: string[],
  ): Promise<PerformanceTotals> {
    if (metaCampaignIds.length === 0) {
      const account = this.fetchAccountFromEnv();
      return this.emptyTotals(account.currency);
    }
    const rows = await prisma.metaRemoteMetricDaily.findMany({
      where: {
        businessId: this.businessId,
        metaCampaignId: { in: metaCampaignIds },
        date: {
          gte: parseDay(range.from),
          lte: parseDay(range.to),
        },
      },
      select: { impressions: true, clicks: true, spend: true, leads: true },
    });
    const account = this.fetchAccountFromEnv();
    return this.summarizeRows(rows, account.currency);
  }

  private summarizeRows(
    rows: Array<{ impressions: number; clicks: number; spend: Prisma.Decimal | number | null; leads: number }>,
    currency: string = 'CLP',
  ): PerformanceTotals {
    const totals = rows.reduce(
      (acc, row) => {
        acc.spend += toNumber(row.spend);
        acc.impressions += row.impressions;
        acc.clicks += row.clicks;
        acc.results += row.leads;
        return acc;
      },
      { spend: 0, impressions: 0, clicks: 0, results: 0 },
    );
    const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
    const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
    const cpl = totals.results > 0 ? totals.spend / totals.results : 0;
    const conversionRate = totals.clicks > 0 ? (totals.results / totals.clicks) * 100 : 0;
    return {
      spend: Math.round(totals.spend),
      impressions: totals.impressions,
      clicks: totals.clicks,
      results: totals.results,
      ctr: Number(ctr.toFixed(2)),
      cpc: Number(cpc.toFixed(2)),
      cpl: Number(cpl.toFixed(2)),
      conversionRate: Number(conversionRate.toFixed(2)),
      currency,
    };
  }

  private compare(current: PerformanceTotals, previous: PerformanceTotals): PerformanceComparison {
    return {
      spendDelta: percentChange(current.spend, previous.spend),
      resultsDelta: percentChange(current.results, previous.results),
      cplDelta: percentChange(current.cpl, previous.cpl),
      ctrDelta: percentChange(current.ctr, previous.ctr),
      cpcDelta: percentChange(current.cpc, previous.cpc),
    };
  }

  private async dailyBreakdown(metaCampaignId: string, range: PerformanceRange): Promise<DailyPerformance[]> {
    const rows = await prisma.metaRemoteMetricDaily.findMany({
      where: {
        businessId: this.businessId,
        metaCampaignId,
        date: {
          gte: parseDay(range.from),
          lte: parseDay(range.to),
        },
      },
      select: { date: true, impressions: true, clicks: true, spend: true, leads: true },
      orderBy: { date: 'asc' },
    });
    return this.collapseDaily(rows);
  }

  private collapseDaily(rows: RawDailyRow[]): DailyPerformance[] {
    const byDay = new Map<string, DailyPerformance>();
    for (const row of rows) {
      const key = dayKey(row.date);
      const existing = byDay.get(key) ?? {
        date: key,
        spend: 0,
        impressions: 0,
        clicks: 0,
        results: 0,
      };
      existing.spend += toNumber(row.spend);
      existing.impressions += row.impressions;
      existing.clicks += row.clicks;
      existing.results += row.leads;
      byDay.set(key, existing);
    }
    return Array.from(byDay.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((entry) => ({ ...entry, spend: Math.round(entry.spend) }));
  }

  private async adBreakdown(metaCampaignId: string, range: PerformanceRange): Promise<AdPerformance[]> {
    const grouped = await prisma.metaRemoteMetricDaily.groupBy({
      by: ['metaAdId', 'metaAdSetId', 'adSetName', 'adName'],
      where: {
        businessId: this.businessId,
        metaCampaignId,
        metaAdId: { not: null },
        date: {
          gte: parseDay(range.from),
          lte: parseDay(range.to),
        },
      },
      _sum: { impressions: true, clicks: true, spend: true, leads: true },
    });
    return grouped
      .filter((entry): entry is typeof entry & { metaAdId: string } => Boolean(entry.metaAdId))
      .map((entry) => this.toAdPerformance(entry))
      .sort((a, b) => b.spend - a.spend);
  }

  private toAdPerformance(entry: {
    metaAdId: string;
    metaAdSetId: string | null;
    adSetName: string | null;
    adName: string | null;
    _sum: { impressions: number | null; clicks: number | null; spend: Prisma.Decimal | null; leads: number | null };
  }): AdPerformance {
    const impressions = entry._sum.impressions ?? 0;
    const clicks = entry._sum.clicks ?? 0;
    const spend = toNumber(entry._sum.spend);
    const results = entry._sum.leads ?? 0;
    const ctr = impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0;
    const cpl = results > 0 ? Number((spend / results).toFixed(2)) : 0;
    return {
      metaAdId: entry.metaAdId,
      metaAdSetId: entry.metaAdSetId,
      adName: entry.adName,
      adSetName: entry.adSetName,
      spend: Math.round(spend),
      impressions,
      clicks,
      results,
      ctr,
      cpl,
    };
  }
}
