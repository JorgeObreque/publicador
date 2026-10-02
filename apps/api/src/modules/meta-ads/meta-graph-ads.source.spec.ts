import { MetaGraphClient } from '../../shared/meta/meta-graph.client';
import { MetaGraphAdsSource } from './meta-graph-ads.source';

describe('MetaGraphAdsSource', () => {
  const settings = {
    accessToken: 'token',
    apiVersion: 'v20.0',
    adAccountId: '123',
    appId: 'app',
    appSecret: 'secret',
    businessId: 'business',
    pageId: 'page',
    instagramAccountId: 'instagram',
    whatsappPhoneNumberId: 'phone-id',
    whatsappNumber: '56912345678',
    accountTimezone: 'Pacific/Easter',
    currency: 'CLP',
  };

  it('creates campaign and ad set only in PAUSED with the approved audience', async () => {
    const client = {
      adAccountId: '123',
      settings,
      get: jest.fn().mockResolvedValue({ data: [] }),
      post: jest
        .fn()
        .mockResolvedValueOnce({ id: 'campaign-1' })
        .mockResolvedValueOnce({ id: 'adset-1' }),
    } as unknown as MetaGraphClient;
    const source = new MetaGraphAdsSource(client);

    await source.ensurePausedCampaign({
      name: 'Campaign',
      objective: 'OUTCOME_ENGAGEMENT',
      dailyBudget: 10000,
    });
    await source.ensurePausedAdSet({
      name: 'Ad set',
      campaignId: 'campaign-1',
      dailyBudget: 10000,
    });

    expect(client.post).toHaveBeenNthCalledWith(
      1,
      'act_123/campaigns',
      expect.objectContaining({
        status: 'PAUSED',
        objective: 'OUTCOME_ENGAGEMENT',
        is_adset_budget_sharing_enabled: false,
        daily_budget: 10000,
      }),
    );
    const adsetPayload = (client.post as jest.Mock).mock.calls[1][1] as Record<string, unknown>;
    expect(adsetPayload).toMatchObject({
      status: 'PAUSED',
      destination_type: 'WHATSAPP',
      optimization_goal: 'CONVERSATIONS',
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      promoted_object: expect.objectContaining({
        whatsapp_phone_number: '56912345678',
      }),
      targeting: expect.objectContaining({
        age_min: 18,
        age_max: 65,
        genders: [2],
        geo_locations: expect.objectContaining({ regions: [{ key: '673' }] }),
        targeting_automation: { advantage_audience: 1 },
      }),
    });
    expect(adsetPayload).not.toHaveProperty('daily_budget');
    expect(adsetPayload).not.toHaveProperty('lifetime_budget');
    expect(adsetPayload).not.toHaveProperty('bid_amount');
  });

  it('uses LOWEST_COST_WITHOUT_CAP and omits bid_amount when draft.bidAmount is undefined', async () => {
    const client = {
      adAccountId: '123',
      settings,
      get: jest.fn().mockResolvedValue({ data: [] }),
      post: jest.fn().mockResolvedValue({ id: 'adset-legacy' }),
    } as unknown as MetaGraphClient;
    const source = new MetaGraphAdsSource(client);

    await source.ensurePausedAdSet({
      name: 'Ad set legacy',
      campaignId: 'campaign-1',
      dailyBudget: 5000,
    });

    const adsetPayload = (client.post as jest.Mock).mock.calls[0][1] as Record<string, unknown>;
    expect(adsetPayload).toMatchObject({
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      optimization_goal: 'CONVERSATIONS',
    });
    expect(adsetPayload).not.toHaveProperty('bid_amount');
  });

  it('uses COST_CAP + integer bid_amount when draft.bidAmount is positive', async () => {
    const client = {
      adAccountId: '123',
      settings,
      get: jest.fn().mockResolvedValue({ data: [] }),
      post: jest.fn().mockResolvedValue({ id: 'adset-cost-cap' }),
    } as unknown as MetaGraphClient;
    const source = new MetaGraphAdsSource(client);

    await source.ensurePausedAdSet({
      name: 'Ad set cost cap',
      campaignId: 'campaign-1',
      dailyBudget: 5000,
      bidAmount: 2000,
    });

    const adsetPayload = (client.post as jest.Mock).mock.calls[0][1] as Record<string, unknown>;
    expect(adsetPayload).toMatchObject({
      bid_strategy: 'COST_CAP',
      bid_amount: 2000,
      optimization_goal: 'CONVERSATIONS',
    });
    expect(Number.isInteger(adsetPayload.bid_amount)).toBe(true);
  });

  it('rounds fractional bid_amount to the nearest integer', async () => {
    const client = {
      adAccountId: '123',
      settings,
      get: jest.fn().mockResolvedValue({ data: [] }),
      post: jest.fn().mockResolvedValue({ id: 'adset-rounded' }),
    } as unknown as MetaGraphClient;
    const source = new MetaGraphAdsSource(client);

    await source.ensurePausedAdSet({
      name: 'Ad set rounded',
      campaignId: 'campaign-1',
      dailyBudget: 5000,
      bidAmount: 1234.7,
    });

    const adsetPayload = (client.post as jest.Mock).mock.calls[0][1] as Record<string, unknown>;
    expect(adsetPayload).toMatchObject({
      bid_strategy: 'COST_CAP',
      bid_amount: 1235,
    });
  });

  it('falls back to LOWEST_COST_WITHOUT_CAP when bidAmount is zero or negative', async () => {
    const client = {
      adAccountId: '123',
      settings,
      get: jest.fn().mockResolvedValue({ data: [] }),
      post: jest.fn().mockResolvedValue({ id: 'adset-fallback' }),
    } as unknown as MetaGraphClient;
    const source = new MetaGraphAdsSource(client);

    await source.ensurePausedAdSet({
      name: 'Ad set zero bid',
      campaignId: 'campaign-1',
      dailyBudget: 5000,
      bidAmount: 0,
    });
    await source.ensurePausedAdSet({
      name: 'Ad set negative bid',
      campaignId: 'campaign-1',
      dailyBudget: 5000,
      bidAmount: -100,
    });

    const zeroPayload = (client.post as jest.Mock).mock.calls[0][1] as Record<string, unknown>;
    const negativePayload = (client.post as jest.Mock).mock.calls[1][1] as Record<string, unknown>;
    expect(zeroPayload).toMatchObject({ bid_strategy: 'LOWEST_COST_WITHOUT_CAP' });
    expect(zeroPayload).not.toHaveProperty('bid_amount');
    expect(negativePayload).toMatchObject({ bid_strategy: 'LOWEST_COST_WITHOUT_CAP' });
    expect(negativePayload).not.toHaveProperty('bid_amount');
  });

  it('rejects an existing active remote object', async () => {
    const client = {
      adAccountId: '123',
      settings,
      get: jest.fn().mockResolvedValue({ id: 'campaign-1', name: 'Campaign', status: 'ACTIVE' }),
    } as unknown as MetaGraphClient;
    const source = new MetaGraphAdsSource(client);

    await expect(
      source.ensurePausedCampaign({
        name: 'Campaign',
        objective: 'OUTCOME_ENGAGEMENT',
        existingId: 'campaign-1',
      }),
    ).rejects.toThrow(/no está en PAUSED/);
  });

  it('uploads the provided image bytes as base64 before creating the creative', async () => {
    const client = {
      adAccountId: '123',
      settings,
      get: jest.fn().mockResolvedValue({ data: [] }),
      post: jest
        .fn()
        .mockResolvedValueOnce({ images: { creative: { hash: 'image-hash' } } })
        .mockResolvedValueOnce({ id: 'creative-1' }),
    } as unknown as MetaGraphClient;
    const source = new MetaGraphAdsSource(client);

    await source.ensureCreative({
      name: 'Creative',
      primaryText: 'Text',
      headline: 'Headline',
      image: { mimeType: 'image/jpeg', bytes: Buffer.from('image-data') },
      attributionCode: 'ADS:CMP-ABC',
    });

    expect(client.post).toHaveBeenNthCalledWith(1, 'act_123/adimages', {
      bytes: Buffer.from('image-data').toString('base64'),
    });
  });

  it('moves the budget to the campaign and clears it from the ad set', async () => {
    const client = {
      adAccountId: '123',
      settings,
      get: jest.fn().mockResolvedValue({ daily_budget: '5000' }),
      post: jest.fn().mockResolvedValue({ success: true }),
    } as unknown as MetaGraphClient;
    const source = new MetaGraphAdsSource(client);

    const result = await source.moveBudgetToCampaign({
      campaignMetaId: 'cmp-1',
      adSetMetaId: 'adset-1',
      dailyBudget: 5000,
    });

    expect(client.post).toHaveBeenNthCalledWith(1, 'adset-1', {
      daily_budget: 0,
      lifetime_budget: 0,
    });
    expect(client.post).toHaveBeenNthCalledWith(2, 'cmp-1', { daily_budget: 5000 });
    expect(result).toMatchObject({
      campaignMetaId: 'cmp-1',
      adSetMetaId: 'adset-1',
      budgetAtCampaign: 5000,
      budgetAtAdSet: null,
      campaignBudgetSharingEnabled: true,
    });
  });

  it('keeps the budget on the ad set when the campaign shares it', async () => {
    const client = {
      adAccountId: '123',
      settings,
      get: jest.fn(),
      post: jest.fn().mockResolvedValue({ success: true }),
    } as unknown as MetaGraphClient;
    const source = new MetaGraphAdsSource(client);

    const result = await source.keepAdSetBudget({
      campaignMetaId: 'cmp-1',
      adSetMetaId: 'adset-1',
      dailyBudget: 5000,
      enableAdSetBudgetSharing: false,
    });

    expect(client.post).toHaveBeenNthCalledWith(1, 'cmp-1', {
      is_adset_budget_sharing_enabled: false,
    });
    expect(client.post).toHaveBeenNthCalledWith(2, 'adset-1', { daily_budget: 5000 });
    expect(result).toMatchObject({
      campaignMetaId: 'cmp-1',
      adSetMetaId: 'adset-1',
      budgetAtCampaign: null,
      budgetAtAdSet: 5000,
      campaignBudgetSharingEnabled: false,
    });
  });

  it('uses the requested Meta civil days and counts conversation starts once', async () => {
    const client = {
      adAccountId: '123',
      settings,
      get: jest.fn().mockResolvedValue({
        data: [
          {
            campaign_id: 'campaign-1',
            ad_id: 'ad-1',
            date_start: '2026-09-10',
            actions: [
              {
                action_type: 'onsite_conversion.messaging_conversation_started_7d',
                value: '4',
              },
              { action_type: 'onsite_conversion.messaging_first_reply', value: '3' },
            ],
          },
        ],
      }),
    } as unknown as MetaGraphClient;
    const source = new MetaGraphAdsSource(client);

    const metrics = await source.fetchMetrics('2026-09-10', '2026-09-12');

    expect(client.get).toHaveBeenCalledWith(
      'act_123/insights',
      expect.objectContaining({
        time_range: JSON.stringify({ since: '2026-09-10', until: '2026-09-12' }),
        time_increment: 1,
      }),
    );
    expect(metrics[0].leads).toBe(4);
  });
});
