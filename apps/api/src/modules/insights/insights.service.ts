import { Injectable } from '@nestjs/common';
import { InsightSeverity, Prisma } from '@prisma/client';
import { prisma } from '@publicador/database';
import { BusinessContextResolver } from '../../shared/business-context/business-context.resolver';

export interface GenerateInsightInput {
  experimentId?: string;
  category: string;
  severity: InsightSeverity;
  title: string;
  description: string;
  evidence?: Prisma.JsonObject;
}

@Injectable()
export class InsightsService {
  constructor(private readonly businessContext: BusinessContextResolver) {}

  private get businessId(): string {
    return this.businessContext.resolve().businessId;
  }

  list() {
    return prisma.insight.findMany({
      where: { businessId: this.businessId },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(input: GenerateInsightInput) {
    return prisma.insight.create({
      data: {
        businessId: this.businessId,
        experimentId: input.experimentId,
        category: input.category,
        severity: input.severity,
        title: input.title,
        description: input.description,
        evidence: input.evidence ?? Prisma.JsonNull,
      },
    });
  }
}
