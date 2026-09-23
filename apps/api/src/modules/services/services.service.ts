import { Injectable } from '@nestjs/common';
import { prisma } from '@publicador/database';
import { BusinessContextResolver } from '../../shared/business-context/business-context.resolver';

export interface ServiceSummary {
  id: string;
  name: string;
  description: string | null;
  price: string;
  currency: string;
  duration: number | null;
}

@Injectable()
export class ServicesService {
  constructor(private readonly businessContext: BusinessContextResolver) {}

  private get businessId(): string {
    return this.businessContext.resolve().businessId;
  }

  async list(): Promise<ServiceSummary[]> {
    const services = await prisma.service.findMany({
      where: { businessId: this.businessId, isActive: true },
      orderBy: { name: 'asc' },
    });
    return services.map((service) => ({
      id: service.id,
      name: service.name,
      description: service.description,
      price: service.price.toString(),
      currency: service.currency,
      duration: service.duration,
    }));
  }
}
