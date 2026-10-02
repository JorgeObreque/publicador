import { Injectable } from '@nestjs/common';
import {
  MetaAdDraft,
  MetaAdsSource,
  MetaAdSetDraft,
  MetaBudgetStrategyResult,
  MetaCampaignDraft,
  MetaCampaignRecord,
  MetaCreativeDraft,
  MetaMetricRecord,
  MetaPreflightResult,
  MetaRemoteOverview,
  MetaRemoteRecord,
} from './meta-ads.types';

export interface FixtureMetric {
  date: string;
  campaignId: string;
  adId: string;
  impressions: number;
  clicks: number;
  spend: number;
  leads: number;
}

export interface FixtureCampaign {
  id: string;
  name: string;
  objective: string;
  status: 'PAUSED' | 'ACTIVE';
  dailyBudget: number;
}

@Injectable()
export class FixtureMetaAdsSource implements MetaAdsSource {
  private campaigns: FixtureCampaign[] = [];
  private metrics: FixtureMetric[] = [];
  private adSets: MetaRemoteRecord[] = [];
  private creatives: MetaRemoteRecord[] = [];
  private ads: MetaRemoteRecord[] = [];

  load(input: { campaigns?: FixtureCampaign[]; metrics?: FixtureMetric[] } = {}) {
    this.campaigns = input.campaigns ?? [];
    this.metrics = input.metrics ?? [];
    this.adSets = [];
    this.creatives = [];
    this.ads = [];
  }

  validateConfiguration(): Promise<MetaPreflightResult> {
    return Promise.resolve({
      accountId: 'act-fixture',
      accountName: 'Fixture account',
      currency: 'CLP',
      timezone: 'Pacific/Easter',
    });
  }

  async ensurePausedCampaign(draft: MetaCampaignDraft): Promise<MetaRemoteRecord> {
    const existing = draft.existingId
      ? this.campaigns.find((campaign) => campaign.id === draft.existingId)
      : this.campaigns.find(
          (campaign) =>
            campaign.name === draft.name || draft.name.startsWith(`${campaign.name} [publicador:`),
        );
    if (existing) {
      if (existing.status !== 'PAUSED') throw new Error(`Campaign ${existing.id} is not PAUSED`);
      return { id: existing.id, name: existing.name, status: existing.status };
    }
    const created: FixtureCampaign = {
      id: `cmp-${(this.campaigns.length + 1).toString().padStart(3, '0')}`,
      name: draft.name,
      objective: draft.objective,
      status: 'PAUSED',
      dailyBudget: 0,
    };
    this.campaigns.push(created);
    return { id: created.id, name: created.name, status: created.status };
  }

  ensurePausedAdSet(draft: MetaAdSetDraft): Promise<MetaRemoteRecord> {
    return Promise.resolve(this.ensureRecord(this.adSets, 'adset', draft.name, draft.existingId, true));
  }

  ensureCreative(draft: MetaCreativeDraft): Promise<MetaRemoteRecord> {
    return Promise.resolve(
      this.ensureRecord(this.creatives, 'creative', draft.name, draft.existingId, false),
    );
  }

  ensurePausedAd(draft: MetaAdDraft): Promise<MetaRemoteRecord> {
    return Promise.resolve(this.ensureRecord(this.ads, 'ad', draft.name, draft.existingId, true));
  }

  fetchCampaigns(): Promise<MetaCampaignRecord[]> {
    return Promise.resolve(
      this.campaigns.map((campaign) => ({
        metaCampaignId: campaign.id,
        name: campaign.name,
        status: campaign.status,
      })),
    );
  }

  fetchOverview(): Promise<MetaRemoteOverview> {
    return Promise.resolve({
      account: { id: 'act-fixture', name: 'Fixture account', currency: 'CLP', timezone: 'Pacific/Easter' },
      campaigns: this.campaigns.map((campaign) => ({
        campaign: {
          metaCampaignId: campaign.id,
          name: campaign.name,
          status: campaign.status,
          objective: campaign.objective,
          dailyBudget: String(campaign.dailyBudget || ''),
          sourceMeta: false,
        },
        adSets: this.adSets
          .filter((adSet) => adSet.id.startsWith('adset-') || adSet.id.includes('-'))
          .map((adSet) => ({
            adSet: {
              metaAdSetId: adSet.id,
              campaignMetaId: campaign.id,
              name: adSet.name,
              status: adSet.status ?? 'PAUSED',
            },
            ads: this.ads
              .filter((ad) => ad.id.startsWith(`${adSet.id.split('-')[0]}-`))
              .map((ad) => ({
                metaAdId: ad.id,
                metaAdSetId: adSet.id,
                name: ad.name,
                status: ad.status ?? 'PAUSED',
              })),
          })),
      })),
      fetchedAt: new Date().toISOString(),
    });
  }

  fetchMetrics(_from: string, _to: string): Promise<MetaMetricRecord[]> {
    return Promise.resolve(
      this.metrics.map((metric) => ({
        date: metric.date,
        metaCampaignId: metric.campaignId,
        metaAdId: metric.adId,
        impressions: metric.impressions,
        clicks: metric.clicks,
        spend: metric.spend,
        leads: metric.leads,
      })),
    );
  }

  moveBudgetToCampaign(input: {
    campaignMetaId: string;
    adSetMetaId: string;
    dailyBudget: number;
  }): Promise<MetaBudgetStrategyResult> {
    return Promise.resolve({
      campaignMetaId: input.campaignMetaId,
      adSetMetaId: input.adSetMetaId,
      budgetAtCampaign: input.dailyBudget,
      budgetAtAdSet: null,
      campaignBudgetSharingEnabled: true,
      notes: [
        `[fixture] Campaña ${input.campaignMetaId} recibió daily_budget=${input.dailyBudget}.`,
        `[fixture] Conjunto ${input.adSetMetaId} cedió su presupuesto a la campaña.`,
      ],
    });
  }

  keepAdSetBudget(input: {
    campaignMetaId: string;
    adSetMetaId: string;
    dailyBudget: number;
    enableAdSetBudgetSharing: boolean;
  }): Promise<MetaBudgetStrategyResult> {
    return Promise.resolve({
      campaignMetaId: input.campaignMetaId,
      adSetMetaId: input.adSetMetaId,
      budgetAtCampaign: null,
      budgetAtAdSet: input.dailyBudget,
      campaignBudgetSharingEnabled: input.enableAdSetBudgetSharing,
      notes: [
        `[fixture] Campaña ${input.campaignMetaId} comparte presupuesto=${input.enableAdSetBudgetSharing}.`,
        `[fixture] Conjunto ${input.adSetMetaId} mantiene daily_budget=${input.dailyBudget}.`,
      ],
    });
  }

  private ensureRecord(
    records: MetaRemoteRecord[],
    prefix: string,
    name: string,
    existingId: string | undefined,
    paused: boolean,
  ) {
    const existing = existingId
      ? records.find((record) => record.id === existingId)
      : records.find((record) => record.name === name);
    if (existing) return existing;
    const created = {
      id: `${prefix}-${(records.length + 1).toString().padStart(3, '0')}`,
      name,
      status: paused ? 'PAUSED' : undefined,
    };
    records.push(created);
    return created;
  }
}
