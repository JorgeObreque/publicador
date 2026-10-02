import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CampaignBriefStatus, CampaignStatus, MediaAssetStatus, Prisma } from '@prisma/client';
import { prisma } from '@publicador/database';
import { BusinessContextResolver } from '../../shared/business-context/business-context.resolver';
import {
  CreateCampaignInput,
  CreateCampaignWithCreativeInput,
  UpdateCampaignInput,
} from './dto/campaign.dto';

const CAMPAIGN_CODE = (campaignId: string) => `CMP-${campaignId.slice(-6).toUpperCase()}`;

type CampaignLike = {
  dailyBudget: Prisma.Decimal | null;
  lifetimeBudget: Prisma.Decimal | null;
};

const serializeBudgets = <T extends CampaignLike>(campaign: T): T => ({
  ...campaign,
  dailyBudget: campaign.dailyBudget ? campaign.dailyBudget.toString() : null,
  lifetimeBudget: campaign.lifetimeBudget ? campaign.lifetimeBudget.toString() : null,
});

const serializeCampaignRecord = <T extends CampaignLike>(campaign: T | null): T | null =>
  campaign ? serializeBudgets(campaign) : campaign;

@Injectable()
export class CampaignsService {
  constructor(private readonly businessContext: BusinessContextResolver) {}

  private get businessId(): string {
    return this.businessContext.resolve().businessId;
  }

  /**
   * Verifica que `campaignBriefId` (cuando está presente) pertenezca al
   * negocio actual y esté en estado `APPROVED`. Sin esto, una campaña
   * podría vincular un brief de otro negocio o un brief aún en DRAFT.
   * Lanza `BadRequestException` con un mensaje accionable si falla (P1-4).
   */
  private async assertBriefIsOwnedAndApproved(
    campaignBriefId: string | undefined,
  ): Promise<void> {
    if (!campaignBriefId) return;
    const brief = await prisma.campaignBrief.findFirst({
      where: { id: campaignBriefId, businessId: this.businessId },
      select: { id: true, status: true },
    });
    if (!brief) {
      throw new BadRequestException(
        `El brief ${campaignBriefId} no pertenece al negocio actual`,
      );
    }
    if (brief.status !== CampaignBriefStatus.APPROVED) {
      throw new BadRequestException(
        `El brief ${campaignBriefId} aún no está aprobado (estado: ${brief.status})`,
      );
    }
  }

  /**
   * Lista las campañas operativas del negocio. La API pública SOLO
   * expone campañas vinculadas a un brief aprobado
   * (`campaignBriefId: { not: null }`): las huérfanas (briefs borrados,
   * campañas legacy creadas antes de P1-4) quedan ocultas al consumidor
   * HTTP porque ya no son una fuente fiable de verdad publicitaria.
   * Si la UI necesita el detalle de una campaña huérfana puntual puede
   * usar `findOne()` por id (mantenido por compatibilidad interna).
   */
  list() {
    return prisma.campaign
      .findMany({
        where: {
          businessId: this.businessId,
          campaignBriefId: { not: null },
        },
        orderBy: { createdAt: 'desc' },
      })
      .then((rows) => rows.map(serializeBudgets));
  }

  async findOne(id: string) {
    const campaign = await prisma.campaign.findFirst({
      where: { id, businessId: this.businessId },
      include: { campaignCreatives: { include: { creative: true } } },
    });
    if (!campaign) throw new NotFoundException(`Campaign ${id} not found`);
    return serializeBudgets(campaign);
  }

  async create(input: CreateCampaignInput) {
    // Cierra la puerta a campañas huérfanas: toda campaña operativa debe
    // nacer desde un plan (`CampaignBrief`) aprobado. Sin brief no hay
    // objetivo comercial, ni KPI, ni reglas de decisión — sólo presupuesto
    // quemándose en Meta.
    if (!input.campaignBriefId) {
      throw new BadRequestException(
        'Debes iniciar la campaña desde un plan aprobado. Crea o selecciona un CampaignBrief aprobado y vuelve a intentarlo.',
      );
    }
    await this.assertBriefIsOwnedAndApproved(input.campaignBriefId);
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
        campaignBriefId: input.campaignBriefId,
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
    // Igual que en `create`: toda campaña operativa (con o sin creativo)
    // debe partir de un plan aprobado. La UI ya oculta el wizard cuando
    // no hay un brief seleccionado, pero blindamos el backend para que
    // ningún cliente (legacy, tests, integraciones) cree huérfanas.
    if (!input.campaign.campaignBriefId) {
      throw new BadRequestException(
        'Debes iniciar la campaña desde un plan aprobado. Crea o selecciona un CampaignBrief aprobado y vuelve a intentarlo.',
      );
    }
    await this.assertBriefIsOwnedAndApproved(input.campaign.campaignBriefId);
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
          campaignBriefId: input.campaign.campaignBriefId,
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
        campaign: serializeCampaignRecord(
          (await tx.campaign.findFirst({
            where: { id: campaign.id },
            include: {
              campaignCreatives: {
                include: { creative: { include: { mediaAsset: true } } },
              },
            },
          })) as unknown as CampaignLike | null,
        ),
        creative,
        attachment,
      };
    });
  }
}
