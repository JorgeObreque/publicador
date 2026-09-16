import { Injectable, Logger } from '@nestjs/common';
import { MetaGraphClient } from '../../shared/meta/meta-graph.client';
import {
  MetaAdsSource,
  MetaCampaignDraft,
  MetaCampaignRecord,
  MetaMetricRecord,
} from './meta-ads.types';

@Injectable()
export class MetaGraphAdsSource implements MetaAdsSource {
  private readonly logger = new Logger(MetaGraphAdsSource.name);

  constructor(private readonly client: MetaGraphClient) {}

  async ensurePausedCampaign(draft: MetaCampaignDraft): Promise<MetaCampaignRecord> {
    if (draft.status !== 'PAUSED') {
      throw new Error('Solo se permite crear campañas en estado PAUSED.');
    }
    const body = {
      name: draft.name,
      objective: draft.objective,
      status: 'PAUSED',
      special_ad_categories: draft.specialAdCategories ?? [],
    };
    const response = await this.client.post<{ id: string; name: string; status: string }>(
      `act_${this.client.adAccountId}/campaigns`,
      body,
    );
    this.logger.log(`Campaña Meta creada en PAUSED: ${response.id}`);
    return { metaCampaignId: response.id, name: response.name, status: response.status };
  }

  fetchCampaigns(): Promise<MetaCampaignRecord[]> {
    return this.client
      .get<{ data: Array<{ id: string; name: string; status: string }> }>(
        `act_${this.client.adAccountId}/campaigns`,
        { fields: 'id,name,status' },
      )
      .then((res) =>
        res.data.map((c) => ({ metaCampaignId: c.id, name: c.name, status: c.status })),
      );
  }

  fetchMetrics(from: Date, to: Date): Promise<MetaMetricRecord[]> {
    return this.client
      .get<{ data: Array<Record<string, unknown>> }>(
        `act_${this.client.adAccountId}/insights`,
        {
          fields: 'campaign_id,ad_id,impressions,clicks,spend,actions,date_start',
          time_range: JSON.stringify({
            since: from.toISOString().slice(0, 10),
            until: to.toISOString().slice(0, 10),
          }),
          level: 'ad',
        },
      )
      .then((res) =>
        res.data.map((row) => {
          const leads = Array.isArray(row.actions)
            ? (row.actions as Array<{ action_type: string; value: string }>)
                .filter((a) => a.action_type === 'lead')
                .reduce((sum, a) => sum + Number(a.value || 0), 0)
            : 0;
          return {
            date: new Date(String(row.date_start)),
            metaCampaignId: String(row.campaign_id),
            metaCreativeId: row.ad_id ? String(row.ad_id) : undefined,
            impressions: Number(row.impressions || 0),
            clicks: Number(row.clicks || 0),
            spend: Number(row.spend || 0),
            leads,
          };
        }),
      );
  }
}
