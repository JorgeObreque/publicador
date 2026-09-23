import './setup';
import request from 'supertest';
import { buildApp } from './helpers/test-app';
import { EasyAppointmentsService } from '../src/modules/easyappointments/easyappointments.service';
import { MediaAssetService } from '../src/modules/media-asset/media-asset.service';
import { MetaAdsService } from '../src/modules/meta-ads/meta-ads.service';
import { prisma } from '@publicador/database';
import { MediaAssetSource } from '@prisma/client';

describe('Campaign lifecycle (integration)', () => {
  it('runs the full simulated cycle: create campaign, attach creative, publish paused, import metrics, sync appointment, confirm deposit, summarize', async () => {
    const app = await buildApp({ logger: ['error', 'warn'] });

    const metaAds = app.get(MetaAdsService);
    const easyAppointments = app.get(EasyAppointmentsService);
    const mediaAssets = app.get(MediaAssetService);

    const campaign = await request(app.getHttpServer())
      .post('/api/v1/campaigns')
      .send({
        name: 'Balayage Otoño',
        objective: 'whatsapp',
        serviceId: undefined,
        dailyBudget: 5000,
      })
      .expect(201);

    const mediaAsset = await prisma.mediaAsset.create({
      data: {
        businessId: process.env.BUSINESS_ID ?? 'test-business',
        source: MediaAssetSource.GOOGLE_DRIVE,
        kind: 'IMAGE',
        externalFileId: 'fixture-balayage',
        externalFolderId: 'fixture-folder',
        externalFolderKey: 'imagenes',
        name: 'balayage.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 2048,
        checksum: 'fixture-checksum',
        status: 'READY',
      },
    });
    mediaAssets.downloadImageBytes = jest
      .fn()
      .mockResolvedValue({
        name: 'balayage.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from('fixture-image-bytes'),
        status: 'READY',
      });

    const creative = await request(app.getHttpServer())
      .post('/api/v1/creatives')
      .send({
        name: 'Balayage Creativo A',
        format: 'image',
        primaryText: 'Balayage natural',
        headline: 'Reserva tu balayage',
        callToAction: 'WHATSAPP_MESSAGE',
        mediaAssetId: mediaAsset.id,
      })
      .expect(201);

    const attach = await request(app.getHttpServer())
      .post('/api/v1/creatives/attach')
      .send({ campaignId: campaign.body.id, creativeId: creative.body.id, isControl: true })
      .expect(201);
    expect(attach.body.attributionCode).toMatch(/^ADS:CMP-/);

    metaAds.loadFixture({
      campaigns: [
        {
          id: 'cmp-meta-1',
          name: 'Balayage Otoño',
          objective: 'whatsapp',
          status: 'PAUSED',
          dailyBudget: 5000,
        },
      ],
      metrics: [
        {
          date: '2026-09-10',
          campaignId: 'cmp-meta-1',
          adId: 'ad-001',
          impressions: 4200,
          clicks: 380,
          spend: 4500,
          leads: 12,
        },
      ],
    });

    const published = await request(app.getHttpServer())
      .post(`/api/v1/meta-ads/campaigns/${campaign.body.id}/publish-paused`)
      .expect(201);
    expect(published.body).toMatchObject({
      metaCampaignId: 'cmp-meta-1',
      metaAdSetId: 'adset-001',
      status: 'PAUSED',
      creatives: [
        {
          metaCreativeId: 'creative-001',
          metaAdId: 'ad-001',
          status: 'PAUSED',
        },
      ],
    });

    const retried = await request(app.getHttpServer())
      .post(`/api/v1/meta-ads/campaigns/${campaign.body.id}/publish-paused`)
      .expect(201);
    expect(retried.body.metaCampaignId).toBe(published.body.metaCampaignId);
    expect(retried.body.metaAdSetId).toBe(published.body.metaAdSetId);
    expect(retried.body.creatives[0].metaAdId).toBe(published.body.creatives[0].metaAdId);

    const imported = await request(app.getHttpServer())
      .post('/api/v1/meta-ads/metrics/import')
      .send({
        from: '2026-09-10',
        to: '2026-09-12',
      })
      .expect(201);
    expect(imported.body.upserts).toBe(1);

    easyAppointments.loadFixture({
      services: [{ id: 2, name: 'Balayage', duration: 120, price: 95500, currency: '$' }],
      appointments: [
        {
          id: 501,
          book: '2026-09-09 12:12:22',
          start: '2026-09-12 12:00:00',
          end: '2026-09-12 14:00:00',
          serviceId: 2,
          providerId: 6,
          customerId: 290,
          status: 'Agendado',
          notes: `Hola, vengo del anuncio. ${attach.body.attributionCode}`,
        },
      ],
    });

    const sync = await request(app.getHttpServer())
      .post('/api/v1/easyappointments/sync')
      .send({
        from: new Date('2026-09-09T00:00:00Z').toISOString(),
        to: new Date('2026-09-12T23:59:59Z').toISOString(),
      })
      .expect(201);
    expect(sync.body.processed).toBe(1);

    const pending = await request(app.getHttpServer()).get('/api/v1/easyappointments/pending');
    expect(pending.status).toBe(200);
    expect(Array.isArray(pending.body)).toBe(true);
    expect(pending.body.length).toBe(1);
    expect(pending.body[0].attributionCode).toBe(attach.body.attributionCode);

    await request(app.getHttpServer())
      .post(`/api/v1/easyappointments/501/deposit`)
      .send({ amount: 20000 })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/easyappointments/501/outcome`)
      .send({ outcome: 'ATTENDED', finalRevenue: 95500 })
      .expect(201);

    const summary = await request(app.getHttpServer()).get(
      `/api/v1/analytics/campaigns/${campaign.body.id}`,
    );
    expect(summary.status).toBe(200);
    expect(summary.body.name).toBe('Balayage Otoño');
    expect(summary.body.attribution.length).toBe(1);
    expect(summary.body.attribution[0].metrics.conversions).toBe(1);

    await app.close();
  });
});
