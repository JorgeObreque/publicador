import { Injectable, NotFoundException } from '@nestjs/common';
import { CampaignStatus, Prisma } from '@prisma/client';
import { prisma } from '@publicador/database';
import { MetaClientFactory } from '../../shared/meta';
import { BusinessContextResolver } from '../../shared/business-context/business-context.resolver';
import { FixtureMetaAdsSource } from './fixture-meta-ads.source';
import { MetaGraphAdsSource } from './meta-graph-ads.source';
import { MetaAdsSource } from './meta-ads.types';

@Injectable()
export class MetaAdsService {
  private readonly source: MetaAdsSource;

  constructor(
    private readonly factory: MetaClientFactory,
    private readonly businessContext: BusinessContextResolver,
    private readonly fixture: FixtureMetaAdsSource,
  ) {
    if (process.env.NODE_ENV === 'test') {
      this.source = this.fixture;
    } else if (process.env.META_ACCESS_TOKEN && process.env.META_AD_ACCOUNT_ID) {
      this.source = new MetaGraphAdsSource(this.factory.create());
    } else {
      this.source = this.fixture;
    }
  }

  private get businessId(): string {
    return this.businessContext.resolve().businessId;
  }

  loadFixture(data: Parameters<FixtureMetaAdsSource['load']>[0]) {
    this.fixture.load(data);
  }

  async createCampaign(localCampaignId: string) {
    const local = await prisma.campaign.findFirst({
      where: { id: localCampaignId, businessId: this.businessId },
    });
    if (!local) throw new NotFoundException(`Campaign ${localCampaignId} not found`);

    const remote = await this.source.ensurePausedCampaign({
      name: local.name,
      objective: local.objective,
      status: 'PAUSED',
      dailyBudget: local.dailyBudget ? Number(local.dailyBudget.toString()) : undefined,
    });

    return prisma.campaign.update({
      where: { id: local.id },
      data: {
        metaCampaignId: remote.metaCampaignId,
        status: CampaignStatus.PAUSED,
        pausedAt: new Date(),
      },
    });
  }

  async importCampaigns() {
    const remote = await this.source.fetchCampaigns();
    for (const c of remote) {
      const local = await prisma.campaign.findFirst({
        where: { businessId: this.businessId, metaCampaignId: c.metaCampaignId },
      });
      if (!local) continue;
      const remoteStatus = c.status as CampaignStatus;
      await prisma.campaign.update({
        where: { id: local.id },
        data: { status: remoteStatus },
      });
    }
    return remote;
  }

  async importMetrics(from: Date, to: Date) {
    const records = await this.source.fetchMetrics(from, to);
    let upserts = 0;
    for (const record of records) {
      const campaign = await prisma.campaign.findFirst({
        where: { businessId: this.businessId, metaCampaignId: record.metaCampaignId },
      });
      if (!campaign) continue;
      const campaignCreative = record.metaCreativeId
        ? await prisma.campaignCreative.findFirst({
            where: {
              businessId: this.businessId,
              campaignId: campaign.id,
              creative: { metaCreativeId: record.metaCreativeId },
            },
          })
        : null;
      const date = new Date(Date.UTC(record.date.getUTCFullYear(), record.date.getUTCMonth(), record.date.getUTCDate()));
      if (campaignCreative) {
        await prisma.adMetricDaily.upsert({
          where: {
            campaignId_campaignCreativeId_date: {
              campaignId: campaign.id,
              campaignCreativeId: campaignCreative.id,
              date,
            },
          },
          update: {
            impressions: { increment: record.impressions },
            clicks: { increment: record.clicks },
            spend: { increment: new Prisma.Decimal(record.spend) },
            leads: { increment: record.leads },
          },
          create: {
            businessId: this.businessId,
            campaignId: campaign.id,
            campaignCreativeId: campaignCreative.id,
            date,
            impressions: record.impressions,
            clicks: record.clicks,
            spend: new Prisma.Decimal(record.spend),
            leads: record.leads,
          },
        });
      } else {
        const existing = await prisma.adMetricDaily.findFirst({
          where: { campaignId: campaign.id, campaignCreativeId: null, date },
        });
        if (existing) {
          await prisma.adMetricDaily.update({
            where: { id: existing.id },
            data: {
              impressions: { increment: record.impressions },
              clicks: { increment: record.clicks },
              spend: { increment: new Prisma.Decimal(record.spend) },
              leads: { increment: record.leads },
            },
          });
        } else {
          await prisma.adMetricDaily.create({
            data: {
              businessId: this.businessId,
              campaignId: campaign.id,
              date,
              impressions: record.impressions,
              clicks: record.clicks,
              spend: new Prisma.Decimal(record.spend),
              leads: record.leads,
            },
          });
        }
      }
      upserts += 1;
    }
    return { upserts };
  }
}
