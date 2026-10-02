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

    // Toda campaña operativa debe partir de un brief aprobado (P1-4).
    const service = await prisma.service.create({
      data: {
        businessId: process.env.BUSINESS_ID ?? 'test-business',
        name: 'Balayage',
        price: 95_500,
        currency: 'CLP',
        duration: 120,
        isActive: true,
      },
    });
    const brief = await request(app.getHttpServer())
      .post('/api/v1/campaign-briefs')
      .send({
        title: 'Balayage Compuesto Brief',
        serviceId: service.id,
        businessObjective: 'Conseguir 5 evaluaciones de balayage en 14 días',
        offer: 'Evaluación + 20% descuento en la primera sesión',
        primaryKpi: 'Evaluaciones',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/campaign-briefs/${brief.body.id}/approve`)
      .expect(201);

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
          campaignBriefId: brief.body.id,
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

  it('sincroniza el presupuesto moviéndolo a la campaña por API', async () => {
    const app = await buildApp({ logger: ['error', 'warn'] });
    const metaAds = app.get(MetaAdsService);
    const mediaAssets = app.get(MediaAssetService);

    // Toda campaña operativa debe partir de un brief aprobado (P1-4).
    const service = await prisma.service.create({
      data: {
        businessId: process.env.BUSINESS_ID ?? 'test-business',
        name: 'Balayage Presupuesto',
        price: 95_500,
        currency: 'CLP',
        duration: 120,
        isActive: true,
      },
    });
    const brief = await request(app.getHttpServer())
      .post('/api/v1/campaign-briefs')
      .send({
        title: 'Presupuesto Campaña Brief',
        serviceId: service.id,
        businessObjective: 'Conseguir 5 evaluaciones en 14 días',
        offer: 'Evaluación + 20% descuento',
        primaryKpi: 'Evaluaciones',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/campaign-briefs/${brief.body.id}/approve`)
      .expect(201);

    const mediaAsset = await prisma.mediaAsset.create({
      data: {
        businessId: process.env.BUSINESS_ID ?? 'test-business',
        source: MediaAssetSource.GOOGLE_DRIVE,
        kind: 'IMAGE',
        externalFileId: 'fixture-budget',
        externalFolderId: 'fixture-folder',
        externalFolderKey: 'imagenes',
        name: 'budget.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 4096,
        checksum: 'budget-checksum',
        status: 'READY',
      },
    });
    mediaAssets.downloadImageBytes = jest.fn().mockResolvedValue({
      name: 'budget.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('budget-bytes'),
      status: 'READY',
    });

    metaAds.loadFixture({
      campaigns: [
        {
          id: 'cmp-budget-1',
          name: 'Presupuesto Campana',
          objective: 'Recibir consultas por WhatsApp',
          status: 'PAUSED',
          dailyBudget: 5000,
        },
      ],
      metrics: [],
    });

    const draft = await request(app.getHttpServer())
      .post('/api/v1/campaigns/with-creative')
      .send({
        campaign: {
          name: 'Presupuesto Campana',
          objective: 'Recibir consultas por WhatsApp',
          dailyBudget: 5000,
          campaignBriefId: brief.body.id,
        },
        creative: {
          name: 'Creativo presupuesto',
          format: 'image',
          primaryText: 'Mensaje con presupuesto',
          headline: 'Reserva con nosotros',
          callToAction: 'WHATSAPP_MESSAGE',
          mediaAssetId: mediaAsset.id,
        },
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/meta-ads/campaigns/${draft.body.campaign.id}/publish-paused`)
      .expect(201);

    const result = await request(app.getHttpServer())
      .post(`/api/v1/meta-ads/campaigns/${draft.body.campaign.id}/sync-budget-strategy`)
      .send({ strategy: 'campaign', dailyBudget: 5000 })
      .expect(201);

    expect(result.body).toMatchObject({
      campaignMetaId: 'cmp-budget-1',
      adSetMetaId: 'adset-001',
      budgetAtCampaign: 5000,
      budgetAtAdSet: null,
      campaignBudgetSharingEnabled: true,
    });
    expect(Array.isArray(result.body.notes)).toBe(true);
    expect(result.body.notes.length).toBeGreaterThan(0);

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

  it('rechaza el endpoint compuesto si falta el campaignBriefId', async () => {
    const app = await buildApp({ logger: ['error', 'warn'] });
    const mediaAsset = await prisma.mediaAsset.create({
      data: {
        businessId: process.env.BUSINESS_ID ?? 'test-business',
        source: MediaAssetSource.GOOGLE_DRIVE,
        kind: 'IMAGE',
        externalFileId: 'fixture-no-brief',
        externalFolderId: 'fixture-folder',
        externalFolderKey: 'imagenes',
        name: 'no-brief.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 4096,
        checksum: 'no-brief-checksum',
        status: 'READY',
      },
    });
    const response = await request(app.getHttpServer())
      .post('/api/v1/campaigns/with-creative')
      .send({
        campaign: {
          name: 'Sin brief',
          objective: 'Recibir consultas',
          dailyBudget: 5000,
        },
        creative: {
          name: 'Creativo sin brief',
          format: 'image',
          primaryText: 'texto',
          headline: 'titulo',
          callToAction: 'WHATSAPP_MESSAGE',
          mediaAssetId: mediaAsset.id,
        },
      });
    expect(response.status).toBe(400);
    const message = JSON.stringify(response.body);
    expect(message).toContain('plan aprobado');
    await app.close();
  });
});
