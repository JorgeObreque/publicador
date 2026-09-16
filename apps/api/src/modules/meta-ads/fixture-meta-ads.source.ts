import { Injectable } from '@nestjs/common';
import {
  MetaAdsSource,
  MetaCampaignDraft,
  MetaCampaignRecord,
  MetaMetricRecord,
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

  load(input: { campaigns?: FixtureCampaign[]; metrics?: FixtureMetric[] } = {}) {
    this.campaigns = input.campaigns ?? [];
    this.metrics = input.metrics ?? [];
  }

  async ensurePausedCampaign(draft: MetaCampaignDraft): Promise<MetaCampaignRecord> {
    if (draft.status !== 'PAUSED') {
      throw new Error('FixtureMetaAdsSource solo crea campañas en PAUSED');
    }
    const existing = this.campaigns.find((c) => c.name === draft.name);
    if (existing) {
      return { metaCampaignId: existing.id, name: existing.name, status: existing.status };
    }
    const created: FixtureCampaign = {
      id: `cmp-${(this.campaigns.length + 1).toString().padStart(3, '0')}`,
      name: draft.name,
      objective: draft.objective,
      status: 'PAUSED',
      dailyBudget: draft.dailyBudget ?? 0,
    };
    this.campaigns.push(created);
    return { metaCampaignId: created.id, name: created.name, status: created.status };
  }

  fetchCampaigns(): Promise<MetaCampaignRecord[]> {
    return Promise.resolve(
      this.campaigns.map((c) => ({
        metaCampaignId: c.id,
        name: c.name,
        status: c.status,
      })),
    );
  }

  fetchMetrics(_from: Date, _to: Date): Promise<MetaMetricRecord[]> {
    return Promise.resolve(
      this.metrics.map((m) => ({
        date: new Date(m.date),
        metaCampaignId: m.campaignId,
        metaCreativeId: m.adId,
        impressions: m.impressions,
        clicks: m.clicks,
        spend: m.spend,
        leads: m.leads,
      })),
    );
  }
}
