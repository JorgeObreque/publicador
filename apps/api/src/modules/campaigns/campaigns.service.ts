import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CampaignStatus, MediaAssetStatus, Prisma } from '@prisma/client';
import { prisma } from '@publicador/database';
import { BusinessContextResolver } from '../../shared/business-context/business-context.resolver';
import {
  CreateCampaignInput,
  CreateCampaignWithCreativeInput,
  UpdateCampaignInput,
} from './dto/campaign.dto';

const CAMPAIGN_CODE = (campaignId: string) => `CMP-${campaignId.slice(-6).toUpperCase()}`;

@Injectable()
export class CampaignsService {
  constructor(private readonly businessContext: BusinessContextResolver) {}

  private get businessId(): string {
    return this.businessContext.resolve().businessId;
  }

  list() {
    return prisma.campaign.findMany({
      where: { businessId: this.businessId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const campaign = await prisma.campaign.findFirst({
      where: { id, businessId: this.businessId },
      include: { campaignCreatives: { include: { creative: true } } },
    });
    if (!campaign) throw new NotFoundException(`Campaign ${id} not found`);
    return campaign;
  }

  create(input: CreateCampaignInput) {
    return prisma.campaign.create({
      data: {
        businessId: this.businessId,
        name: input.name,
        objective: input.objective,
        serviceId: input.serviceId,
        dailyBudget: input.dailyBudget
          ? new Prisma.Decimal(input.dailyBudget)
          : undefined,
        lifetimeBudget: input.lifetimeBudget
          ? new Prisma.Decimal(input.lifetimeBudget)
          : undefined,
        startDate: input.startDate,
        endDate: input.endDate,
        notes: input.notes,
        status: CampaignStatus.DRAFT,
      },
    });
  }

  async update(id: string, input: UpdateCampaignInput) {
    await this.findOne(id);
    return prisma.campaign.update({
      where: { id },
      data: {
        name: input.name,
        objective: input.objective,
        serviceId: input.serviceId,
        dailyBudget:
          input.dailyBudget !== undefined
            ? new Prisma.Decimal(input.dailyBudget)
            : undefined,
        lifetimeBudget:
          input.lifetimeBudget !== undefined
            ? new Prisma.Decimal(input.lifetimeBudget)
            : undefined,
        startDate: input.startDate,
        endDate: input.endDate,
        notes: input.notes,
      },
    });
  }

  async pause(id: string) {
    await this.findOne(id);
    return prisma.campaign.update({
      where: { id },
      data: { status: CampaignStatus.PAUSED, pausedAt: new Date() },
    });
  }

  async archive(id: string) {
    await this.findOne(id);
    return prisma.campaign.update({
      where: { id },
      data: { status: CampaignStatus.ARCHIVED },
    });
  }

  async createWithCreative(input: CreateCampaignWithCreativeInput) {
    const mediaAsset = await prisma.mediaAsset.findFirst({
      where: {
        id: input.creative.mediaAssetId,
        businessId: this.businessId,
        status: { not: MediaAssetStatus.ARCHIVED },
      },
    });
    if (!mediaAsset) {
      throw new BadRequestException(
        `MediaAsset ${input.creative.mediaAssetId} no disponible para el negocio actual`,
      );
    }
    if (mediaAsset.status === MediaAssetStatus.MISSING) {
      throw new BadRequestException(
        `La imagen ${mediaAsset.name} ya no está disponible en Google Drive`,
      );
    }
    if (mediaAsset.kind !== 'IMAGE') {
      throw new BadRequestException(
        `El recurso ${mediaAsset.name} no es una imagen utilizable`,
      );
    }

    return prisma.$transaction(async (tx) => {
      const campaign = await tx.campaign.create({
        data: {
          businessId: this.businessId,
          name: input.campaign.name,
          objective: input.campaign.objective,
          serviceId: input.campaign.serviceId,
          dailyBudget: input.campaign.dailyBudget
            ? new Prisma.Decimal(input.campaign.dailyBudget)
            : undefined,
          lifetimeBudget: input.campaign.lifetimeBudget
            ? new Prisma.Decimal(input.campaign.lifetimeBudget)
            : undefined,
          startDate: input.campaign.startDate,
          endDate: input.campaign.endDate,
          notes: input.campaign.notes,
          status: CampaignStatus.DRAFT,
        },
      });

      const creative = await tx.creative.create({
        data: {
          businessId: this.businessId,
          name: input.creative.name,
          format: input.creative.format,
          primaryText: input.creative.primaryText,
          headline: input.creative.headline,
          description: input.creative.description,
          callToAction: input.creative.callToAction,
          mediaAssetId: input.creative.mediaAssetId,
        },
      });

      const code = `${CAMPAIGN_CODE(campaign.id)}-${creative.id.slice(-4).toUpperCase()}`;
      const attachment = await tx.campaignCreative.create({
        data: {
          businessId: this.businessId,
          campaignId: campaign.id,
          creativeId: creative.id,
          attributionCode: `ADS:${code}`,
          isControl: input.isControl ?? true,
        },
      });

      return {
        campaign: await tx.campaign.findFirst({
          where: { id: campaign.id },
          include: {
            campaignCreatives: {
              include: { creative: { include: { mediaAsset: true } } },
            },
          },
        }),
        creative,
        attachment,
      };
    });
  }
}
