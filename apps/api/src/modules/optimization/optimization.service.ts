import { BadRequestException, Injectable } from '@nestjs/common';
import { RecommendationStatus } from '@prisma/client';
import { prisma } from '@publicador/database';
import { BusinessContextResolver } from '../../shared/business-context/business-context.resolver';
import { CreateRecommendationInput } from './dto/recommendation.dto';
import { DecisionLogService } from '../decision-log/decision-log.service';

@Injectable()
export class OptimizationService {
  constructor(
    private readonly businessContext: BusinessContextResolver,
    private readonly decisionLog: DecisionLogService,
  ) {}

  private get businessId(): string {
    return this.businessContext.resolve().businessId;
  }

  list(status?: RecommendationStatus) {
    return prisma.optimizationRecommendation.findMany({
      where: { businessId: this.businessId, status },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(input: CreateRecommendationInput) {
    return prisma.optimizationRecommendation.create({
      data: {
        businessId: this.businessId,
        ...input,
      },
    });
  }

  async accept(id: string) {
    const recommendation = await this.requireRecommendation(id);
    const decision = await this.decisionLog.record({
      title: `Aceptar recomendación ${recommendation.title}`,
      rationale: recommendation.rationale,
      expectedImpact: recommendation.impact,
    });
    return prisma.optimizationRecommendation.update({
      where: { id: recommendation.id },
      data: { status: RecommendationStatus.ACCEPTED, decisionLogId: decision.id },
    });
  }

  async reject(id: string, rationale?: string) {
    const recommendation = await this.requireRecommendation(id);
    const decision = await this.decisionLog.record({
      title: `Rechazar recomendación ${recommendation.title}`,
      rationale: rationale ?? recommendation.rationale,
      expectedImpact: recommendation.impact,
    });
    return prisma.optimizationRecommendation.update({
      where: { id: recommendation.id },
      data: { status: RecommendationStatus.REJECTED, decisionLogId: decision.id },
    });
  }

  private async requireRecommendation(id: string) {
    const recommendation = await prisma.optimizationRecommendation.findFirst({
      where: { id, businessId: this.businessId },
    });
    if (!recommendation) {
      throw new BadRequestException(`Recomendación ${id} no encontrada`);
    }
    return recommendation;
  }
}
