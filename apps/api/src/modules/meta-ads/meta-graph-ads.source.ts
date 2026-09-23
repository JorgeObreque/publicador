import { Injectable, Logger } from '@nestjs/common';
import { MetaGraphClient } from '../../shared/meta/meta-graph.client';
import {
  MetaAdDraft,
  MetaAdsSource,
  MetaAdSetDraft,
  MetaCampaignDraft,
  MetaCampaignRecord,
  MetaCreativeDraft,
  MetaMetricRecord,
  MetaPreflightResult,
  MetaRemoteRecord,
} from './meta-ads.types';

@Injectable()
export class MetaGraphAdsSource implements MetaAdsSource {
  private readonly logger = new Logger(MetaGraphAdsSource.name);

  constructor(private readonly client: MetaGraphClient) {}

  async validateConfiguration(): Promise<MetaPreflightResult> {
    const config = this.client.settings;
    const required: Array<[string, string | undefined]> = [
      ['META_APP_ID', config.appId],
      ['META_APP_SECRET', config.appSecret],
      ['META_BUSINESS_ID', config.businessId],
      ['META_PAGE_ID', config.pageId],
      ['META_INSTAGRAM_ACCOUNT_ID', config.instagramAccountId],
      ['META_WHATSAPP_PHONE_NUMBER_ID', config.whatsappPhoneNumberId],
      ['META_WHATSAPP_NUMBER', config.whatsappNumber],
    ];
    const missing = required.filter(([, value]) => !value).map(([name]) => name);
    if (missing.length > 0) {
      throw new Error(`Configuración Meta incompleta: ${missing.join(', ')}`);
    }

    const account = await this.client.get<{
      id: string;
      name: string;
      account_status: number;
      currency: string;
      timezone_name: string;
      business?: { id: string };
    }>(`act_${this.client.adAccountId}`, {
      fields: 'id,name,account_status,currency,timezone_name,business',
    });

    if (account.account_status !== 1) {
      throw new Error(`La cuenta publicitaria no está activa (estado ${account.account_status})`);
    }
    if (account.currency !== config.currency) {
      throw new Error(`Moneda Meta inesperada: ${account.currency}; se esperaba ${config.currency}`);
    }
    if (account.timezone_name !== config.accountTimezone) {
      throw new Error(
        `Zona horaria Meta inesperada: ${account.timezone_name}; se esperaba ${config.accountTimezone}`,
      );
    }
    if (account.business?.id && account.business.id !== config.businessId) {
      throw new Error(`La cuenta publicitaria pertenece a otro negocio (${account.business.id})`);
    }

    return {
      accountId: account.id,
      accountName: account.name,
      currency: account.currency,
      timezone: account.timezone_name,
    };
  }

  async ensurePausedCampaign(draft: MetaCampaignDraft): Promise<MetaRemoteRecord> {
    const existingId =
      draft.existingId ?? (await this.findByName('campaigns', draft.name))?.id;
    if (existingId) {
      const existing = await this.client.get<{
        id: string;
        name?: string;
        status: string;
        objective: string;
        account_id: string;
      }>(existingId, { fields: 'id,name,status,objective,account_id' });
      this.requirePaused(existing, 'campaña');
      this.requireName(existing, draft.name);
      if (existing.account_id !== this.client.adAccountId) {
        throw new Error(`La campaña ${existing.id} pertenece a otra cuenta publicitaria`);
      }
      if (existing.objective !== draft.objective) {
        throw new Error(`La campaña ${existing.id} tiene objetivo ${existing.objective}`);
      }
      return { id: existing.id, name: existing.name ?? draft.name, status: existing.status };
    }
    const response = await this.client.post<{ id: string }>(
      `act_${this.client.adAccountId}/campaigns`,
      {
        name: draft.name,
        objective: draft.objective,
        buying_type: 'AUCTION',
        is_adset_budget_sharing_enabled: false,
        status: 'PAUSED',
        special_ad_categories: [],
      },
    );
    this.logger.log(`Campaña Meta creada en PAUSED: ${response.id}`);
    return { id: response.id, name: draft.name, status: 'PAUSED' };
  }

  async ensurePausedAdSet(draft: MetaAdSetDraft): Promise<MetaRemoteRecord> {
    const existingId = draft.existingId ?? (await this.findByName('adsets', draft.name))?.id;
    if (existingId) {
      const existing = await this.client.get<{
        id: string;
        name?: string;
        status: string;
        campaign_id: string;
        daily_budget?: string;
        lifetime_budget?: string;
        destination_type: string;
        optimization_goal: string;
        billing_event: string;
        bid_strategy: string;
        promoted_object?: { whatsapp_phone_number?: string };
        targeting: {
          genders?: number[];
          geo_locations?: { regions?: Array<{ key: string }> };
        };
      }>(existingId, {
        fields:
          'id,name,status,campaign_id,daily_budget,lifetime_budget,destination_type,optimization_goal,billing_event,bid_strategy,promoted_object,targeting',
      });
      this.requirePaused(existing, 'conjunto de anuncios');
      this.requireName(existing, draft.name);
      if (existing.campaign_id !== draft.campaignId) {
        throw new Error(`El conjunto ${existing.id} pertenece a otra campaña`);
      }
      if (
        existing.destination_type !== 'WHATSAPP' ||
        existing.optimization_goal !== 'CONVERSATIONS' ||
        existing.billing_event !== 'IMPRESSIONS' ||
        existing.bid_strategy !== 'LOWEST_COST_WITHOUT_CAP'
      ) {
        throw new Error(`El conjunto ${existing.id} no es de conversaciones por WhatsApp`);
      }
      if (
        existing.promoted_object?.whatsapp_phone_number !== this.client.settings.whatsappNumber
      ) {
        throw new Error(`El conjunto ${existing.id} usa otro teléfono de WhatsApp`);
      }
      const regions = existing.targeting.geo_locations?.regions?.map((region) => region.key) ?? [];
      if (!existing.targeting.genders?.includes(2) || !regions.includes('673')) {
        throw new Error(`El conjunto ${existing.id} usa otra audiencia`);
      }
      const expectedBudget = draft.dailyBudget ?? draft.lifetimeBudget;
      const actualBudget = Number(existing.daily_budget ?? existing.lifetime_budget);
      if (actualBudget !== expectedBudget) {
        throw new Error(`El conjunto ${existing.id} tiene un presupuesto distinto`);
      }
      return { id: existing.id, name: existing.name ?? draft.name, status: existing.status };
    }
    const config = this.client.settings;
    const body: Record<string, unknown> = {
      name: draft.name,
      campaign_id: draft.campaignId,
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'CONVERSATIONS',
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      destination_type: 'WHATSAPP',
      promoted_object: {
        page_id: config.pageId,
        whatsapp_phone_number: config.whatsappNumber,
      },
      targeting: {
        age_min: 18,
        age_max: 65,
        genders: [2],
        geo_locations: {
          regions: [{ key: '673' }],
          location_types: ['frequently_in', 'home', 'recent'],
        },
        targeting_automation: { advantage_audience: 1 },
      },
      status: 'PAUSED',
    };
    if (draft.dailyBudget !== undefined) body.daily_budget = draft.dailyBudget;
    if (draft.lifetimeBudget !== undefined) body.lifetime_budget = draft.lifetimeBudget;
    if (draft.startTime) body.start_time = draft.startTime.toISOString();
    if (draft.endTime) body.end_time = draft.endTime.toISOString();

    const response = await this.client.post<{ id: string }>(
      `act_${this.client.adAccountId}/adsets`,
      body,
    );
    this.logger.log(`Conjunto de anuncios Meta creado en PAUSED: ${response.id}`);
    return { id: response.id, name: draft.name, status: 'PAUSED' };
  }

  async ensureCreative(draft: MetaCreativeDraft): Promise<MetaRemoteRecord> {
    const existingId =
      draft.existingId ?? (await this.findByName('adcreatives', draft.name))?.id;
    if (existingId) {
      const existing = await this.client.get<{ id: string; name?: string; account_id: string }>(
        existingId,
        { fields: 'id,name,account_id' },
      );
      if (!draft.existingId) {
        this.requireName(existing, draft.name);
      }
      if (existing.account_id !== this.client.adAccountId) {
        throw new Error(`El creativo ${existing.id} pertenece a otra cuenta publicitaria`);
      }
      return { id: existing.id, name: existing.name ?? draft.name };
    }

    const imageHash = await this.uploadImageBytes(draft.image.bytes, draft.image.mimeType);
    const config = this.client.settings;
    const message = `Hola, quiero reservar una hora. ${draft.attributionCode}`;
    const whatsappLink = `https://api.whatsapp.com/send?phone=${config.whatsappNumber}&text=${encodeURIComponent(message)}`;
    const response = await this.client.post<{ id: string }>(
      `act_${this.client.adAccountId}/adcreatives`,
      {
        name: draft.name,
        object_story_spec: {
          page_id: config.pageId,
          instagram_user_id: config.instagramAccountId,
          link_data: {
            link: whatsappLink,
            image_hash: imageHash,
            message: draft.primaryText,
            name: draft.headline,
            description: draft.description,
            call_to_action: {
              type: 'WHATSAPP_MESSAGE',
              value: { app_destination: 'WHATSAPP', link: whatsappLink },
            },
          },
        },
      },
    );
    this.logger.log(`Creativo Meta creado: ${response.id}`);
    return { id: response.id, name: draft.name };
  }

  async ensurePausedAd(draft: MetaAdDraft): Promise<MetaRemoteRecord> {
    const existingId = draft.existingId ?? (await this.findByName('ads', draft.name))?.id;
    if (existingId) {
      const existing = await this.client.get<{
        id: string;
        name?: string;
        status: string;
        adset_id: string;
        creative: { id: string };
      }>(existingId, { fields: 'id,name,status,adset_id,creative{id}' });
      this.requirePaused(existing, 'anuncio');
      this.requireName(existing, draft.name);
      if (existing.adset_id !== draft.adSetId || existing.creative.id !== draft.creativeId) {
        throw new Error(`El anuncio ${existing.id} pertenece a otra jerarquía`);
      }
      return { id: existing.id, name: existing.name ?? draft.name, status: existing.status };
    }
    const response = await this.client.post<{ id: string }>(`act_${this.client.adAccountId}/ads`, {
      name: draft.name,
      adset_id: draft.adSetId,
      creative: { creative_id: draft.creativeId },
      status: 'PAUSED',
    });
    this.logger.log(`Anuncio Meta creado en PAUSED: ${response.id}`);
    return { id: response.id, name: draft.name, status: 'PAUSED' };
  }

  fetchCampaigns(): Promise<MetaCampaignRecord[]> {
    return this.client
      .get<{ data: Array<{ id: string; name: string; status: string }> }>(
        `act_${this.client.adAccountId}/campaigns`,
        { fields: 'id,name,status' },
      )
      .then((res) =>
        res.data.map((campaign) => ({
          metaCampaignId: campaign.id,
          name: campaign.name,
          status: campaign.status,
        })),
      );
  }

  fetchMetrics(from: string, to: string): Promise<MetaMetricRecord[]> {
    return this.fetchInsightPages(from, to).then((rows) =>
        rows.map((row) => {
          const actions = Array.isArray(row.actions)
            ? (row.actions as Array<{ action_type: string; value: string }>)
            : [];
          const actionTypes = [
            'lead',
            'onsite_conversion.messaging_conversation_started_7d',
            'onsite_conversion.messaging_first_reply',
          ];
          const selectedType = actionTypes.find((type) =>
            actions.some((action) => action.action_type === type),
          );
          const selectedActions = actions.filter(
            (action) => action.action_type === selectedType,
          );
          const leads = selectedActions.reduce(
            (sum, action) => sum + Number(action.value || 0),
            0,
          );
          return {
            date: String(row.date_start),
            metaCampaignId: String(row.campaign_id),
            metaAdId: row.ad_id ? String(row.ad_id) : undefined,
            impressions: Number(row.impressions || 0),
            clicks: Number(row.clicks || 0),
            spend: Number(row.spend || 0),
            leads,
          };
        }),
      );
  }

  private requirePaused(existing: { id: string; status: string }, entity: string) {
    if (existing.status !== 'PAUSED') {
      throw new Error(`El ${entity} ${existing.id} no está en PAUSED (${existing.status})`);
    }
  }

  private requireName(existing: { id: string; name?: string }, expected: string) {
    if (existing.name && existing.name !== expected) {
      throw new Error(`El objeto Meta ${existing.id} tiene un nombre inesperado`);
    }
  }

  private async findByName(edge: string, name: string) {
    const matches: Array<{ id: string; name: string }> = [];
    let after: string | undefined;
    do {
      const response = await this.client.get<{
        data: Array<{ id: string; name: string }>;
        paging?: { cursors?: { after?: string }; next?: string };
      }>(`act_${this.client.adAccountId}/${edge}`, {
        fields: 'id,name',
        limit: 500,
        ...(after ? { after } : {}),
      });
      matches.push(...response.data.filter((record) => record.name === name));
      if (matches.length > 1) break;
      after = response.paging?.next ? response.paging.cursors?.after : undefined;
    } while (after);
    if (matches.length > 1) throw new Error(`Hay más de un objeto Meta llamado ${name}`);
    return matches[0];
  }

  private async fetchInsightPages(from: string, to: string) {
    const rows: Array<Record<string, unknown>> = [];
    let after: string | undefined;
    do {
      const response = await this.client.get<{
        data: Array<Record<string, unknown>>;
        paging?: { cursors?: { after?: string }; next?: string };
      }>(`act_${this.client.adAccountId}/insights`, {
        fields: 'campaign_id,ad_id,impressions,clicks,spend,actions,date_start',
        time_range: JSON.stringify({ since: from, until: to }),
        time_increment: 1,
        level: 'ad',
        limit: 500,
        ...(after ? { after } : {}),
      });
      rows.push(...response.data);
      after = response.paging?.next ? response.paging.cursors?.after : undefined;
    } while (after);
    return rows;
  }

  private async uploadImageBytes(bytes: Buffer, mimeType: string): Promise<string> {
    if (!this.isSupportedImageMime(mimeType)) {
      throw new Error(`Tipo de imagen no soportado para Meta: ${mimeType}`);
    }
    const uploaded = await this.client.post<{
      images: Record<string, { hash: string }>;
    }>(`act_${this.client.adAccountId}/adimages`, {
      bytes: bytes.toString('base64'),
    });
    const image = Object.values(uploaded.images)[0];
    if (!image?.hash) throw new Error('Meta no devolvió el hash de la imagen subida');
    return image.hash;
  }

  private isSupportedImageMime(mime: string): boolean {
    return ['image/jpeg', 'image/png', 'image/webp'].includes(mime.toLowerCase());
  }
}
