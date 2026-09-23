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
      }),
    );
    expect(client.post).toHaveBeenNthCalledWith(
      2,
      'act_123/adsets',
      expect.objectContaining({
        status: 'PAUSED',
        destination_type: 'WHATSAPP',
        optimization_goal: 'CONVERSATIONS',
        promoted_object: expect.objectContaining({
          whatsapp_phone_number: '56912345678',
        }),
        daily_budget: 10000,
        targeting: expect.objectContaining({
          age_min: 18,
          age_max: 65,
          genders: [2],
          geo_locations: expect.objectContaining({ regions: [{ key: '673' }] }),
          targeting_automation: { advantage_audience: 1 },
        }),
      }),
    );
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
