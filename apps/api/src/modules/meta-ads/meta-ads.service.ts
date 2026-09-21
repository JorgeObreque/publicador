import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CampaignStatus, MetaPublishStatus, Prisma } from '@prisma/client';
import { prisma } from '@publicador/database';
import { createHash, randomUUID } from 'node:crypto';
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
    this.source =
      process.env.NODE_ENV === 'test'
        ? this.fixture
        : new MetaGraphAdsSource(this.factory.create());
  }

  private get businessId(): string {
    return this.businessContext.resolve().businessId;
  }

  loadFixture(data: Parameters<FixtureMetaAdsSource['load']>[0]) {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('Los fixtures de Meta solo están disponibles en NODE_ENV=test');
    }
    this.fixture.load(data);
  }

  async publishPaused(localCampaignId: string) {
    const local = await prisma.campaign.findFirst({
      where: { id: localCampaignId, businessId: this.businessId },
      include: { campaignCreatives: { include: { creative: true } } },
    });
    if (!local) throw new NotFoundException(`Campaign ${localCampaignId} not found`);

    this.validatePublishable(local);
    const campaignFingerprint = this.fingerprint({
      name: local.name,
      objective: 'OUTCOME_ENGAGEMENT',
      dailyBudget: local.dailyBudget?.toString(),
      lifetimeBudget: local.lifetimeBudget?.toString(),
      startDate: local.startDate?.toISOString(),
      endDate: local.endDate?.toISOString(),
      audience: 'women-18-65-region-673-advantage',
    });
    if (
      (local.metaPublishFingerprint && local.metaPublishFingerprint !== campaignFingerprint) ||
      (local.metaAdSetId && !local.metaPublishFingerprint)
    ) {
      throw new BadRequestException(
        'La configuración local cambió después de publicar; cree una nueva campaña o reconcilie los IDs remotos',
      );
    }
    for (const attachment of local.campaignCreatives) {
      const creativeFingerprint = this.creativeFingerprint(attachment);
      if (
        (attachment.metaCreativeId || attachment.metaAdId) &&
        attachment.metaPublishFingerprint !== creativeFingerprint
      ) {
        throw new BadRequestException(
          `El creativo asociado ${attachment.id} cambió después de publicar`,
        );
      }
    }

    const staleBefore = new Date(Date.now() - 30 * 60 * 1000);
    const attemptId = randomUUID();
    const claimed = await prisma.campaign.updateMany({
      where: {
        id: local.id,
        OR: [
          { metaPublishStatus: { not: MetaPublishStatus.PUBLISHING } },
          {
            metaPublishStatus: MetaPublishStatus.PUBLISHING,
            metaPublishStartedAt: { lt: staleBefore },
          },
        ],
      },
      data: {
        metaPublishStatus: MetaPublishStatus.PUBLISHING,
        metaPublishAttemptId: attemptId,
        metaPublishError: null,
        metaPublishStartedAt: new Date(),
      },
    });
    if (claimed.count !== 1) {
      throw new ConflictException('La campaña ya se está publicando');
    }

    try {
      const account = await this.source.validateConfiguration();
      await prisma.metaAdAccount.upsert({
        where: {
          businessId_metaAccountId: {
            businessId: this.businessId,
            metaAccountId: account.accountId,
          },
        },
        update: {
          name: account.accountName,
          currency: account.currency,
          timezone: account.timezone,
        },
        create: {
          businessId: this.businessId,
          metaAccountId: account.accountId,
          name: account.accountName,
          currency: account.currency,
          timezone: account.timezone,
        },
      });

      const remoteCampaign = await this.source.ensurePausedCampaign({
        name: this.remoteName(local.name, local.id, 'campaign'),
        objective: 'OUTCOME_ENGAGEMENT',
        existingId: local.metaCampaignId ?? undefined,
      });
      if (!local.metaCampaignId) {
        await this.updateClaimedCampaign(local.id, attemptId, {
            metaCampaignId: remoteCampaign.id,
            metaPublishFingerprint: campaignFingerprint,
        });
      }

      const remoteAdSet = await this.source.ensurePausedAdSet({
        name: this.remoteName(local.name, local.id, 'adset'),
        campaignId: remoteCampaign.id,
        dailyBudget: local.dailyBudget ? Number(local.dailyBudget) : undefined,
        lifetimeBudget: local.lifetimeBudget ? Number(local.lifetimeBudget) : undefined,
        startTime: local.startDate ?? undefined,
        endTime: local.endDate ?? undefined,
        existingId: local.metaAdSetId ?? undefined,
      });
      await this.updateClaimedCampaign(local.id, attemptId, {
          metaCampaignId: remoteCampaign.id,
          metaAdSetId: remoteAdSet.id,
          metaPublishFingerprint: campaignFingerprint,
      });

      const publishedCreatives = [];
      for (const attachment of local.campaignCreatives) {
        const creativeFingerprint = this.creativeFingerprint(attachment);
        const remoteCreative = await this.source.ensureCreative({
          name: this.remoteName(attachment.creative.name, attachment.id, 'creative'),
          primaryText: attachment.creative.primaryText,
          headline: attachment.creative.headline,
          description: attachment.creative.description ?? undefined,
          imageUrl: attachment.creative.imageUrl!,
          attributionCode: attachment.attributionCode,
          existingId: attachment.metaCreativeId ?? undefined,
        });
        await this.assertLease(local.id, attemptId);
        await prisma.campaignCreative.update({
          where: { id: attachment.id },
          data: {
            metaCreativeId: remoteCreative.id,
            metaPublishFingerprint: creativeFingerprint,
          },
        });

        const remoteAd = await this.source.ensurePausedAd({
          name: this.remoteName(attachment.creative.name, attachment.id, 'ad'),
          adSetId: remoteAdSet.id,
          creativeId: remoteCreative.id,
          existingId: attachment.metaAdId ?? undefined,
        });
        await this.assertLease(local.id, attemptId);
        await prisma.campaignCreative.update({
          where: { id: attachment.id },
          data: {
            metaAdId: remoteAd.id,
            metaPublishFingerprint: creativeFingerprint,
            metaPublishedAt: attachment.metaPublishedAt ?? new Date(),
          },
        });
        publishedCreatives.push({
          campaignCreativeId: attachment.id,
          metaCreativeId: remoteCreative.id,
          metaAdId: remoteAd.id,
          status: remoteAd.status,
        });
      }

      const publishedAt = new Date();
      await this.updateClaimedCampaign(local.id, attemptId, {
          status: CampaignStatus.PAUSED,
          pausedAt: publishedAt,
          metaPublishStatus: MetaPublishStatus.PAUSED,
          metaPublishAttemptId: null,
          metaPublishError: null,
          metaPublishedAt: publishedAt,
      });

      return {
        campaignId: local.id,
        metaCampaignId: remoteCampaign.id,
        metaAdSetId: remoteAdSet.id,
        status: 'PAUSED',
        account,
        creatives: publishedCreatives,
      };
    } catch (error) {
      const message = this.errorMessage(error);
      await prisma.campaign.updateMany({
        where: { id: local.id, metaPublishAttemptId: attemptId },
        data: {
          metaPublishStatus: MetaPublishStatus.FAILED,
          metaPublishAttemptId: null,
          metaPublishError: message.slice(0, 2000),
        },
      });
      throw error;
    }
  }

  async importCampaigns() {
    const remote = await this.source.fetchCampaigns();
    for (const campaign of remote) {
      const local = await prisma.campaign.findFirst({
        where: { businessId: this.businessId, metaCampaignId: campaign.metaCampaignId },
      });
      if (!local) continue;
      const remoteStatus = campaign.status as CampaignStatus;
      if (Object.values(CampaignStatus).includes(remoteStatus)) {
        await prisma.campaign.update({
          where: { id: local.id },
          data: { status: remoteStatus },
        });
      }
    }
    return remote;
  }

  async importMetrics(from: string, to: string) {
    if (from > to) throw new BadRequestException('from no puede ser posterior a to');
    const records = await this.source.fetchMetrics(from, to);
    let upserts = 0;
    let skipped = 0;
    for (const record of records) {
      const campaign = await prisma.campaign.findFirst({
        where: { businessId: this.businessId, metaCampaignId: record.metaCampaignId },
      });
      if (!campaign) {
        skipped += 1;
        continue;
      }
      const campaignCreative = record.metaAdId
        ? await prisma.campaignCreative.findFirst({
            where: {
              businessId: this.businessId,
              campaignId: campaign.id,
              metaAdId: record.metaAdId,
            },
          })
        : null;
      if (record.metaAdId && !campaignCreative) {
        skipped += 1;
        continue;
      }
      const date = this.parseMetaDay(record.date);
      const data = {
        businessId: this.businessId,
        campaignId: campaign.id,
        campaignCreativeId: campaignCreative?.id,
        date,
        impressions: record.impressions,
        clicks: record.clicks,
        spend: new Prisma.Decimal(record.spend),
        leads: record.leads,
      };

      if (campaignCreative) {
        await prisma.adMetricDaily.upsert({
          where: {
            campaignId_campaignCreativeId_date: {
              campaignId: campaign.id,
              campaignCreativeId: campaignCreative.id,
              date,
            },
          },
          update: data,
          create: data,
        });
      } else {
        const existing = await prisma.adMetricDaily.findFirst({
          where: { campaignId: campaign.id, campaignCreativeId: null, date },
        });
        if (existing) {
          await prisma.adMetricDaily.update({ where: { id: existing.id }, data });
        } else {
          await prisma.adMetricDaily.create({ data });
        }
      }
      upserts += 1;
    }
    return { upserts, skipped };
  }

  private validatePublishable(campaign: {
    status: CampaignStatus;
    dailyBudget: Prisma.Decimal | null;
    lifetimeBudget: Prisma.Decimal | null;
    endDate: Date | null;
    campaignCreatives: Array<{
      creative: { imageUrl: string | null; callToAction: string };
    }>;
  }) {
    if (campaign.status !== CampaignStatus.DRAFT && campaign.status !== CampaignStatus.PAUSED) {
      throw new BadRequestException(`No se puede publicar una campaña en estado ${campaign.status}`);
    }
    if (Boolean(campaign.dailyBudget) === Boolean(campaign.lifetimeBudget)) {
      throw new BadRequestException('Se requiere exactamente un tipo de presupuesto');
    }
    const budget = Number(campaign.dailyBudget ?? campaign.lifetimeBudget);
    if (!Number.isSafeInteger(budget) || budget <= 0) {
      throw new BadRequestException('El presupuesto CLP debe ser un entero positivo');
    }
    if (campaign.lifetimeBudget && !campaign.endDate) {
      throw new BadRequestException('El presupuesto total requiere endDate');
    }
    if (campaign.campaignCreatives.length === 0) {
      throw new BadRequestException('La campaña requiere al menos un creativo asociado');
    }
    if (campaign.campaignCreatives.some(({ creative }) => !creative.imageUrl)) {
      throw new BadRequestException('Todos los creativos deben incluir imageUrl');
    }
    if (
      campaign.campaignCreatives.some(
        ({ creative }) => creative.callToAction !== 'WHATSAPP_MESSAGE',
      )
    ) {
      throw new BadRequestException('Todos los creativos deben usar WHATSAPP_MESSAGE');
    }
  }

  private remoteName(name: string, id: string, kind: string) {
    return `${name} [publicador:${kind}:${id}]`;
  }

  private async assertLease(campaignId: string, attemptId: string) {
    const owned = await prisma.campaign.count({
      where: { id: campaignId, metaPublishAttemptId: attemptId },
    });
    if (owned !== 1) throw new ConflictException('Otro proceso retomó la publicación');
  }

  private async updateClaimedCampaign(
    campaignId: string,
    attemptId: string,
    data: Prisma.CampaignUpdateManyMutationInput,
  ) {
    const updated = await prisma.campaign.updateMany({
      where: { id: campaignId, metaPublishAttemptId: attemptId },
      data,
    });
    if (updated.count !== 1) throw new ConflictException('Otro proceso retomó la publicación');
  }

  private creativeFingerprint(attachment: {
    attributionCode: string;
    creative: {
      name: string;
      primaryText: string;
      headline: string;
      description: string | null;
      imageUrl: string | null;
      callToAction: string;
    };
  }) {
    return this.fingerprint({
      name: attachment.creative.name,
      attributionCode: attachment.attributionCode,
      primaryText: attachment.creative.primaryText,
      headline: attachment.creative.headline,
      description: attachment.creative.description,
      imageUrl: attachment.creative.imageUrl,
      callToAction: attachment.creative.callToAction,
    });
  }

  private fingerprint(value: unknown) {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }

  private parseMetaDay(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new Error(`Fecha diaria de Meta inválida: ${value}`);
    }
    return new Date(`${value}T00:00:00.000Z`);
  }

  private errorMessage(error: unknown) {
    if (error instanceof Error) return error.message;
    return String(error);
  }
}
