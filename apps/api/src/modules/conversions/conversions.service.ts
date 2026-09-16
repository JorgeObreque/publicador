import { Injectable } from '@nestjs/common';
import { ConversionStatus, Prisma } from '@prisma/client';
import { prisma } from '@publicador/database';
import { BusinessContextResolver } from '../../shared/business-context/business-context.resolver';

@Injectable()
export class ConversionsService {
  constructor(private readonly businessContext: BusinessContextResolver) {}

  private get businessId(): string {
    return this.businessContext.resolve().businessId;
  }

  list(filters: { campaignId?: string; status?: ConversionStatus } = {}) {
    return prisma.conversion.findMany({
      where: {
        businessId: this.businessId,
        campaignId: filters.campaignId,
        status: filters.status,
      },
      orderBy: { occurredAt: 'desc' },
    });
  }

  async createManual(input: {
    campaignId?: string;
    creativeId?: string;
    serviceId?: string;
    attributionCode?: string;
    amount?: number;
    currency?: string;
    contactRef?: string;
    notes?: string;
  }) {
    const created = await prisma.conversion.create({
      data: {
        businessId: this.businessId,
        campaignId: input.campaignId,
        creativeId: input.creativeId,
        serviceId: input.serviceId,
        attributionCode: input.attributionCode,
        status: ConversionStatus.PENDING,
        amount: input.amount ? new Prisma.Decimal(input.amount) : undefined,
        currency: input.currency ?? 'CLP',
        contactRef: input.contactRef,
        notes: input.notes,
      },
    });
    return created;
  }
}
