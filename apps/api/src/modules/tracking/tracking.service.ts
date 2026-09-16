import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { prisma } from '@publicador/database';
import { BusinessContextResolver } from '../../shared/business-context/business-context.resolver';
import { TrackingEventInput } from './dto/tracking.dto';

@Injectable()
export class TrackingService {
  constructor(private readonly businessContext: BusinessContextResolver) {}

  private get businessId(): string {
    return this.businessContext.resolve().businessId;
  }

  async record(input: TrackingEventInput) {
    const payload = input.payload
      ? (input.payload as Prisma.InputJsonValue)
      : Prisma.JsonNull;
    return prisma.trackingEvent.upsert({
      where: {
        businessId_eventType_eventId: {
          businessId: this.businessId,
          eventType: input.eventType,
          eventId: input.eventId,
        },
      },
      update: {
        source: input.source,
        medium: input.medium,
        campaign: input.campaign,
        utmCampaignId: input.campaignId,
        utmCampaignCreativeId: input.campaignCreativeId,
        payload,
      },
      create: {
        businessId: this.businessId,
        eventType: input.eventType,
        eventId: input.eventId,
        source: input.source,
        medium: input.medium,
        campaign: input.campaign,
        utmCampaignId: input.campaignId,
        utmCampaignCreativeId: input.campaignCreativeId,
        occurredAt: input.occurredAt ?? new Date(),
        payload,
      },
    });
  }

  list(limit = 100) {
    return prisma.trackingEvent.findMany({
      where: { businessId: this.businessId },
      orderBy: { occurredAt: 'desc' },
      take: limit,
    });
  }
}
