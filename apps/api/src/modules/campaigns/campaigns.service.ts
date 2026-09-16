import { Injectable, NotFoundException } from '@nestjs/common';
import { CampaignStatus, Prisma } from '@prisma/client';
import { prisma } from '@publicador/database';
import { BusinessContextResolver } from '../../shared/business-context/business-context.resolver';
import { CreateCampaignInput, UpdateCampaignInput } from './dto/campaign.dto';

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
}
