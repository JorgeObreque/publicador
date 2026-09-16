import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@publicador/database';
import { BusinessContextResolver } from '../../shared/business-context/business-context.resolver';
import {
  AttachCreativeInput,
  CreateCreativeInput,
} from './dto/creative.dto';

const CAMPAIGN_CODE = (campaignId: string) => `CMP-${campaignId.slice(-6).toUpperCase()}`;

@Injectable()
export class CreativesService {
  constructor(private readonly businessContext: BusinessContextResolver) {}

  private get businessId(): string {
    return this.businessContext.resolve().businessId;
  }

  list() {
    return prisma.creative.findMany({
      where: { businessId: this.businessId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const creative = await prisma.creative.findFirst({
      where: { id, businessId: this.businessId },
    });
    if (!creative) throw new NotFoundException(`Creative ${id} not found`);
    return creative;
  }

  create(input: CreateCreativeInput) {
    return prisma.creative.create({
      data: {
        businessId: this.businessId,
        ...input,
      },
    });
  }

  async attachToCampaign(input: AttachCreativeInput) {
    const [campaign, creative] = await Promise.all([
      prisma.campaign.findFirst({
        where: { id: input.campaignId, businessId: this.businessId },
      }),
      prisma.creative.findFirst({
        where: { id: input.creativeId, businessId: this.businessId },
      }),
    ]);
    if (!campaign) throw new NotFoundException(`Campaign ${input.campaignId} not found`);
    if (!creative) throw new NotFoundException(`Creative ${input.creativeId} not found`);

    const existing = await prisma.campaignCreative.findUnique({
      where: {
        campaignId_creativeId: {
          campaignId: campaign.id,
          creativeId: creative.id,
        },
      },
    });
    if (existing) return existing;

    const code = `${CAMPAIGN_CODE(campaign.id)}-${creative.id.slice(-4).toUpperCase()}`;
    return prisma.campaignCreative.create({
      data: {
        businessId: this.businessId,
        campaignId: campaign.id,
        creativeId: creative.id,
        attributionCode: `ADS:${code}`,
        isControl: input.isControl ?? false,
      },
    });
  }

  listForCampaign(campaignId: string) {
    return prisma.campaignCreative.findMany({
      where: { businessId: this.businessId, campaignId },
      include: { creative: true, metrics: true },
    });
  }
}
