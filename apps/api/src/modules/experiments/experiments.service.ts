import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ExperimentStatus } from '@prisma/client';
import { prisma } from '@publicador/database';
import { BusinessContextResolver } from '../../shared/business-context/business-context.resolver';
import { CreateExperimentInput } from './dto/experiment.dto';

@Injectable()
export class ExperimentsService {
  constructor(private readonly businessContext: BusinessContextResolver) {}

  private get businessId(): string {
    return this.businessContext.resolve().businessId;
  }

  list() {
    return prisma.experiment.findMany({
      where: { businessId: this.businessId },
      include: { variants: { include: { campaignCreative: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const experiment = await prisma.experiment.findFirst({
      where: { id, businessId: this.businessId },
      include: { variants: { include: { campaignCreative: true } } },
    });
    if (!experiment) throw new NotFoundException(`Experiment ${id} not found`);
    return experiment;
  }

  async create(input: CreateExperimentInput) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: input.campaignId, businessId: this.businessId },
      include: { campaignCreatives: true },
    });
    if (!campaign) throw new NotFoundException(`Campaign ${input.campaignId} not found`);

    const validVariants = campaign.campaignCreatives.filter((cc) =>
      input.variantIds.includes(cc.id),
    );
    if (validVariants.length !== input.variantIds.length) {
      throw new BadRequestException('Algunas variantes no pertenecen a la campaña.');
    }

    const controlIndex = input.controlIndex ?? 0;
    return prisma.experiment.create({
      data: {
        businessId: this.businessId,
        campaignId: campaign.id,
        name: input.name,
        hypothesis: input.hypothesis,
        primaryKpi: input.primaryKpi,
        status: ExperimentStatus.RUNNING,
        variants: {
          create: validVariants.map((cc, idx) => ({
            campaignCreativeId: cc.id,
            creativeId: cc.creativeId,
            isControl: idx === controlIndex,
          })),
        },
      },
      include: { variants: true },
    });
  }

  async complete(id: string, outcome?: string) {
    const experiment = await this.findOne(id);
    return prisma.experiment.update({
      where: { id: experiment.id },
      data: {
        status: ExperimentStatus.COMPLETED,
        endedAt: new Date(),
      },
    });
  }
}
