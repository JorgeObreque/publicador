import { Injectable } from '@nestjs/common';
import { prisma } from '@publicador/database';
import { BusinessContextResolver } from '../../shared/business-context/business-context.resolver';
import { RecordDecisionInput } from './dto/decision.dto';

@Injectable()
export class DecisionLogService {
  constructor(private readonly businessContext: BusinessContextResolver) {}

  private get businessId(): string {
    return this.businessContext.resolve().businessId;
  }

  record(input: RecordDecisionInput) {
    return prisma.decisionLogEntry.create({
      data: {
        businessId: this.businessId,
        ...input,
      },
    });
  }

  list() {
    return prisma.decisionLogEntry.findMany({
      where: { businessId: this.businessId },
      orderBy: { decidedAt: 'desc' },
    });
  }
}
