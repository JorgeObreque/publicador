import { Injectable, Logger } from '@nestjs/common';
import { MetaGraphClient } from '../../shared/meta/meta-graph.client';
import {
  MetaAdDraft,
  MetaAdRecord,
  MetaAdsSource,
  MetaAdSetDraft,
  MetaAdSetRecord,
  MetaBudgetStrategyResult,
  MetaCampaignDraft,
  MetaCampaignRecord,
  MetaCreativeDraft,
  MetaMetricRecord,
  MetaPreflightResult,
  MetaRemoteOverview,
  MetaRemoteRecord,
} from './meta-ads.types';

const BIDASSURANCE_BID_STRATEGY = 'COST_CAP' as const;

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
        ...(draft.dailyBudget !== undefined ? { daily_budget: draft.dailyBudget } : {}),
        ...(draft.lifetimeBudget !== undefined ? { lifetime_budget: draft.lifetimeBudget } : {}),
      },
    );
    this.logger.log(`Campaña Meta creada en PAUSED: ${response.id}`);
    return { id: response.id, name: draft.name, status: 'PAUSED' };
  }

  async ensurePausedAdSet(draft: MetaAdSetDraft): Promise<MetaRemoteRecord> {
    const useBidAmount = draft.bidAmount !== undefined && draft.bidAmount > 0;
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
        bid_amount?: string;
        promoted_object?: { whatsapp_phone_number?: string };
        targeting: {
          genders?: number[];
          geo_locations?: { regions?: Array<{ key: string }> };
        };
      }>(existingId, {
        fields:
          'id,name,status,campaign_id,daily_budget,lifetime_budget,destination_type,optimization_goal,billing_event,bid_strategy,bid_amount,promoted_object,targeting',
      });
      this.requirePaused(existing, 'conjunto de anuncios');
      this.requireName(existing, draft.name);
      if (existing.campaign_id !== draft.campaignId) {
        throw new Error(`El conjunto ${existing.id} pertenece a otra campaña`);
      }
      const expectedBidStrategy = useBidAmount
        ? BIDASSURANCE_BID_STRATEGY
        : 'LOWEST_COST_WITHOUT_CAP';
      if (
        existing.destination_type !== 'WHATSAPP' ||
        existing.optimization_goal !== 'CONVERSATIONS' ||
        existing.billing_event !== 'IMPRESSIONS' ||
        existing.bid_strategy !== expectedBidStrategy
      ) {
        throw new Error(`El conjunto ${existing.id} no es de conversaciones por WhatsApp`);
      }
      if (useBidAmount) {
        const existingBidAmount = existing.bid_amount ? Number(existing.bid_amount) : undefined;
        if (
          existingBidAmount === undefined ||
          existingBidAmount !== Math.round(draft.bidAmount!)
        ) {
          throw new Error(`El conjunto ${existing.id} tiene un importe de puja distinto`);
        }
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
      bid_strategy: useBidAmount ? BIDASSURANCE_BID_STRATEGY : 'LOWEST_COST_WITHOUT_CAP',
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
      ...(useBidAmount ? { bid_amount: Math.round(draft.bidAmount!) } : {}),
    };
    // El presupuesto diario se envía a nivel de campaña para que Meta no active
    // Advantage Campaign Budget sobre un conjunto con presupuesto propio.
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
    return this.fetchOverview().then((overview) =>
      overview.campaigns.map((entry) => entry.campaign),
    );
  }

  async fetchOverview(options: { limit?: number } = {}): Promise<MetaRemoteOverview> {
    const limit = options.limit ?? 200;
    const preflight = await this.validateConfiguration();
    const account = {
      id: preflight.accountId,
      name: preflight.accountName,
      currency: preflight.currency,
      timezone: preflight.timezone,
    };
    const campaignsResponse = await this.fetchAllPages<{
      id: string;
      name: string;
      status: string;
      effective_status?: string;
      objective?: string;
      daily_budget?: string;
      lifetime_budget?: string;
      start_time?: string;
      stop_time?: string;
    }>(`act_${this.client.adAccountId}/campaigns`, {
      fields:
        'id,name,status,effective_status,objective,daily_budget,lifetime_budget,start_time,stop_time',
      limit,
    });

    const result: MetaRemoteOverview = {
      account,
      campaigns: [],
      fetchedAt: new Date().toISOString(),
    };

    for (const remote of campaignsResponse) {
      const campaign: MetaCampaignRecord = {
        metaCampaignId: remote.id,
        name: remote.name,
        status: remote.status,
        effectiveStatus: remote.effective_status,
        objective: remote.objective,
        dailyBudget: remote.daily_budget,
        lifetimeBudget: remote.lifetime_budget,
        startTime: remote.start_time,
        stopTime: remote.stop_time,
        sourceMeta: true,
      };

      const adSetsResponse = await this.fetchAllPages<{
        id: string;
        name: string;
        status: string;
        effective_status?: string;
        daily_budget?: string;
        lifetime_budget?: string;
      }>(`${remote.id}/adsets`, {
        fields: 'id,name,status,effective_status,daily_budget,lifetime_budget',
        limit,
      });

      const adSets: Array<{ adSet: MetaAdSetRecord; ads: MetaAdRecord[] }> = [];
      for (const remoteAdSet of adSetsResponse) {
        const adsResponse = await this.fetchAllPages<{
          id: string;
          name: string;
          status: string;
          effective_status?: string;
          creative?: { id: string };
        }>(`${remoteAdSet.id}/ads`, {
          fields: 'id,name,status,effective_status,creative{id}',
          limit,
        });

        adSets.push({
          adSet: {
            metaAdSetId: remoteAdSet.id,
            campaignMetaId: remote.id,
            name: remoteAdSet.name,
            status: remoteAdSet.status,
            effectiveStatus: remoteAdSet.effective_status,
            dailyBudget: remoteAdSet.daily_budget,
            lifetimeBudget: remoteAdSet.lifetime_budget,
          },
          ads: adsResponse.map((ad) => ({
            metaAdId: ad.id,
            metaAdSetId: remoteAdSet.id,
            name: ad.name,
            status: ad.status,
            effectiveStatus: ad.effective_status,
            creativeId: ad.creative?.id,
          })),
        });
      }

      result.campaigns.push({ campaign, adSets });
    }

    return result;
  }

  private async fetchAllPages<T>(path: string, params: Record<string, unknown>): Promise<T[]> {
    const rows: T[] = [];
    let after: string | undefined;
    const limit = Number(params.limit ?? 200);
    do {
      const response = await this.client.get<{
        data: T[];
        paging?: { cursors?: { after?: string }; next?: string };
      }>(path, {
        ...params,
        ...(after ? { after } : {}),
      });
      rows.push(...response.data);
      after = response.paging?.next ? response.paging.cursors?.after : undefined;
      if (!limit || rows.length >= limit * 50) break;
    } while (after);
    return rows;
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
            metaAdSetId: row.adset_id ? String(row.adset_id) : undefined,
            metaAdId: row.ad_id ? String(row.ad_id) : undefined,
            adSetName: row.adset_name ? String(row.adset_name) : undefined,
            adName: row.ad_name ? String(row.ad_name) : undefined,
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
        fields: 'campaign_id,adset_id,adset_name,ad_id,ad_name,impressions,clicks,spend,actions,date_start',
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

  async moveBudgetToCampaign(input: {
    campaignMetaId: string;
    adSetMetaId: string;
    dailyBudget: number;
  }): Promise<MetaBudgetStrategyResult> {
    const notes: string[] = [];
    const [adSetBefore, campaignBefore] = await Promise.all([
      this.client.get<{
        daily_budget?: string;
        lifetime_budget?: string;
      }>(input.adSetMetaId, { fields: 'daily_budget,lifetime_budget' }),
      this.client.get<{
        daily_budget?: string;
        lifetime_budget?: string;
      }>(input.campaignMetaId, { fields: 'daily_budget,lifetime_budget' }),
    ]);

    // 1. Limpiar primero el presupuesto del conjunto para evitar el error
    //    1487164 ("Se han especificado varios presupuestos") cuando el conjunto
    //    conserva un daily_budget activo.
    if (adSetBefore.daily_budget || adSetBefore.lifetime_budget) {
      await this.client.post<{ success: boolean }>(input.adSetMetaId, {
        daily_budget: 0,
        lifetime_budget: 0,
      });
      notes.push(
        `Conjunto ${input.adSetMetaId} liberó su presupuesto previo (daily=${adSetBefore.daily_budget ?? 0}, lifetime=${adSetBefore.lifetime_budget ?? 0}).`,
      );
    }

    // 2. Limpiar el presupuesto alternativo en la campaña para fijar solo uno.
    if (campaignBefore.lifetime_budget) {
      await this.client.post<{ success: boolean }>(input.campaignMetaId, {
        lifetime_budget: 0,
      });
      notes.push(
        `Campaña ${input.campaignMetaId} tenía lifetime_budget=${campaignBefore.lifetime_budget}; se elimina para fijar solo daily_budget.`,
      );
    }

    // 3. Fijar el presupuesto diario en la campaña.
    await this.client.post<{ success: boolean }>(input.campaignMetaId, {
      daily_budget: input.dailyBudget,
    });
    notes.push(
      `Campaña ${input.campaignMetaId} actualizada con daily_budget=${input.dailyBudget} (CLP).`,
    );

    return {
      campaignMetaId: input.campaignMetaId,
      adSetMetaId: input.adSetMetaId,
      budgetAtCampaign: input.dailyBudget,
      budgetAtAdSet: null,
      campaignBudgetSharingEnabled: true,
      notes,
    };
  }

  async keepAdSetBudget(input: {
    campaignMetaId: string;
    adSetMetaId: string;
    dailyBudget: number;
    enableAdSetBudgetSharing: boolean;
  }): Promise<MetaBudgetStrategyResult> {
    const notes: string[] = [];
    await this.client.post<{ success: boolean }>(input.campaignMetaId, {
      is_adset_budget_sharing_enabled: input.enableAdSetBudgetSharing,
    });
    notes.push(
      `Campaña ${input.campaignMetaId} ahora comparte presupuesto con el conjunto (${input.enableAdSetBudgetSharing ? 'activado' : 'desactivado'}).`,
    );

    await this.client.post<{ success: boolean }>(input.adSetMetaId, {
      daily_budget: input.dailyBudget,
    });
    notes.push(
      `Conjunto ${input.adSetMetaId} mantiene daily_budget=${input.dailyBudget} (CLP).`,
    );

    return {
      campaignMetaId: input.campaignMetaId,
      adSetMetaId: input.adSetMetaId,
      budgetAtCampaign: null,
      budgetAtAdSet: input.dailyBudget,
      campaignBudgetSharingEnabled: input.enableAdSetBudgetSharing,
      notes,
    };
  }
}
