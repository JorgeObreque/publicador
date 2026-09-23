import './setup';
import request from 'supertest';
import { buildApp } from './helpers/test-app';
import { MediaAssetService } from '../src/modules/media-asset/media-asset.service';
import { MetaAdsService } from '../src/modules/meta-ads/meta-ads.service';
import { prisma } from '@publicador/database';
import { MediaAssetSource } from '@prisma/client';

describe('Campaign + creative flow (integration)', () => {
  it('crea campaña, creativo y asociación atómicamente, y permite reintentar publicación', async () => {
    const app = await buildApp({ logger: ['error', 'warn'] });
    const metaAds = app.get(MetaAdsService);
    const mediaAssets = app.get(MediaAssetService);

    const mediaAsset = await prisma.mediaAsset.create({
      data: {
        businessId: process.env.BUSINESS_ID ?? 'test-business',
        source: MediaAssetSource.GOOGLE_DRIVE,
        kind: 'IMAGE',
        externalFileId: 'fixture-composite',
        externalFolderId: 'fixture-folder',
        externalFolderKey: 'imagenes',
        name: 'composite.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 4096,
        checksum: 'composite-checksum',
        status: 'READY',
      },
    });
    mediaAssets.downloadImageBytes = jest.fn().mockResolvedValue({
      name: 'composite.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('composite-bytes'),
      status: 'READY',
    });

    const draft = await request(app.getHttpServer())
      .post('/api/v1/campaigns/with-creative')
      .send({
        campaign: {
          name: 'Balayage Compuesto',
          objective: 'Recibir consultas por WhatsApp',
          dailyBudget: 5000,
        },
        creative: {
          name: 'Balayage Creativo Compuesto',
          format: 'image',
          primaryText: 'Balayage natural con profesionales.',
          headline: 'Reserva tu balayage',
          callToAction: 'WHATSAPP_MESSAGE',
          mediaAssetId: mediaAsset.id,
        },
      })
      .expect(201);

    expect(draft.body.campaign.status).toBe('DRAFT');
    expect(draft.body.attachment.attributionCode).toMatch(/^ADS:CMP-/);
    expect(draft.body.creative.mediaAssetId).toBe(mediaAsset.id);

    const beforeCampaign = await request(app.getHttpServer())
      .get(`/api/v1/campaigns/${draft.body.campaign.id}`)
      .expect(200);
    expect(beforeCampaign.body.campaignCreatives).toHaveLength(1);

    metaAds.loadFixture({
      campaigns: [
        {
          id: 'cmp-composite-1',
          name: 'Balayage Compuesto',
          objective: 'Recibir consultas por WhatsApp',
          status: 'PAUSED',
          dailyBudget: 5000,
        },
      ],
      metrics: [],
    });

    const published = await request(app.getHttpServer())
      .post(`/api/v1/meta-ads/campaigns/${draft.body.campaign.id}/publish-paused`)
      .expect(201);
    expect(published.body).toMatchObject({
      metaCampaignId: 'cmp-composite-1',
      metaAdSetId: 'adset-001',
      status: 'PAUSED',
    });
    expect(published.body.creatives[0].status).toBe('PAUSED');

    const retried = await request(app.getHttpServer())
      .post(`/api/v1/meta-ads/campaigns/${draft.body.campaign.id}/publish-paused`)
      .expect(201);
    expect(retried.body.metaCampaignId).toBe(published.body.metaCampaignId);
    expect(retried.body.creatives[0].metaAdId).toBe(published.body.creatives[0].metaAdId);

    await app.close();
  });

  it('rechaza el endpoint compuesto si falta el mediaAssetId', async () => {
    const app = await buildApp({ logger: ['error', 'warn'] });
    const response = await request(app.getHttpServer())
      .post('/api/v1/campaigns/with-creative')
      .send({
        campaign: { name: 'Sin imagen', objective: 'whatsapp', dailyBudget: 5000 },
        creative: {
          name: 'Creativo sin imagen',
          format: 'image',
          primaryText: 'texto',
          headline: 'titulo',
          callToAction: 'WHATSAPP_MESSAGE',
        },
      });
    expect(response.status).toBe(400);
    await app.close();
  });
});
