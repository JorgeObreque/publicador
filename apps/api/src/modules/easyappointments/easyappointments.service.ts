import { Injectable, Logger } from '@nestjs/common';
import { ConversionStatus, Prisma } from '@prisma/client';
import { prisma } from '@publicador/database';
import { BusinessContextResolver } from '../../shared/business-context/business-context.resolver';
import { extractAttributionCode } from '../../shared/attribution/attribution-code';
import { EasyAppointmentsHttpClient } from './easyappointments-http.client';
import { FixtureEasyAppointmentsClient } from './fixture-easyappointments.client';
import {
  EasyAppointmentsAppointment,
  EasyAppointmentsClient,
} from './easyappointments.types';

@Injectable()
export class EasyAppointmentsService {
  private readonly logger = new Logger(EasyAppointmentsService.name);
  private client: EasyAppointmentsClient;

  constructor(
    private readonly businessContext: BusinessContextResolver,
    fixture: FixtureEasyAppointmentsClient,
  ) {
    if (process.env.NODE_ENV === 'test') {
      this.client = fixture;
      return;
    }
    const baseURL = process.env.EASYAPPOINTMENTS_BASE_URL ?? '';
    const username = process.env.EASYAPPOINTMENTS_USERNAME ?? '';
    const password = process.env.EASYAPPOINTMENTS_PASSWORD ?? '';
    if (baseURL && username && password) {
      this.client = new EasyAppointmentsHttpClient(baseURL, username, password);
    } else {
      this.client = fixture;
    }
  }

  loadFixture(data: Parameters<FixtureEasyAppointmentsClient['load']>[0]) {
    if (this.client instanceof FixtureEasyAppointmentsClient) {
      this.client.load(data);
    } else {
      throw new Error('No se puede cargar fixtures cuando el cliente HTTP está activo.');
    }
  }

  private get businessId(): string {
    return this.businessContext.resolve().businessId;
  }

  async syncAppointments(from: Date, to: Date) {
    const remote = await this.client.fetchAppointments(from, to);
    let processed = 0;
    for (const appt of remote) {
      await this.upsertAppointment(appt);
      processed += 1;
    }
    return { processed };
  }

  async listPending() {
    return prisma.externalAppointment.findMany({
      where: {
        businessId: this.businessId,
        attributionCode: { not: null },
        depositConfirmed: false,
      },
      orderBy: { scheduledStart: 'asc' },
    });
  }

  async confirmDeposit(externalAppointmentId: string, amount?: number) {
    const appointment = await prisma.externalAppointment.findFirst({
      where: { businessId: this.businessId, externalAppointmentId: BigInt(externalAppointmentId) },
    });
    if (!appointment) {
      throw new Error(`Cita ${externalAppointmentId} no encontrada`);
    }
    const updated = await prisma.externalAppointment.update({
      where: { id: appointment.id },
      data: {
        depositConfirmed: true,
        depositAmount: amount ? new Prisma.Decimal(amount) : appointment.depositAmount,
        outcome: ConversionStatus.DEPOSIT_CONFIRMED,
      },
    });
    await this.upsertConversion(updated);
    return updated;
  }

  async recordOutcome(externalAppointmentId: string, outcome: ConversionStatus, finalRevenue?: number) {
    const appointment = await prisma.externalAppointment.findFirst({
      where: { businessId: this.businessId, externalAppointmentId: BigInt(externalAppointmentId) },
    });
    if (!appointment) {
      throw new Error(`Cita ${externalAppointmentId} no encontrada`);
    }
    const updated = await prisma.externalAppointment.update({
      where: { id: appointment.id },
      data: {
        outcome,
        finalRevenue: finalRevenue ? new Prisma.Decimal(finalRevenue) : appointment.finalRevenue,
      },
    });
    await this.upsertConversion(updated);
    return updated;
  }

  private async upsertAppointment(appt: EasyAppointmentsAppointment) {
    const code = extractAttributionCode(appt.notes);
    const serviceMap = await prisma.easyAppointmentsServiceMap.findFirst({
      where: { businessId: this.businessId, externalServiceId: appt.serviceId },
    });
    const campaignCreative = code
      ? await prisma.campaignCreative.findFirst({
          where: { businessId: this.businessId, attributionCode: code },
        })
      : null;

    const existing = await prisma.externalAppointment.findFirst({
      where: {
        businessId: this.businessId,
        externalAppointmentId: BigInt(appt.id),
      },
    });

    return prisma.externalAppointment.upsert({
      where: {
        businessId_externalAppointmentId: {
          businessId: this.businessId,
          externalAppointmentId: BigInt(appt.id),
        },
      },
      update: {
        appointmentStatus: appt.status,
        notesRaw: appt.notes,
        attributionCode: code,
        campaignId: campaignCreative?.campaignId,
        creativeId: campaignCreative?.creativeId,
        campaignCreativeId: campaignCreative?.id,
        serviceId: serviceMap?.serviceId,
        externalCustomerId: BigInt(appt.customerId),
        providerId: appt.providerId,
        scheduledStart: new Date(appt.start.replace(' ', 'T')),
        scheduledEnd: new Date(appt.end.replace(' ', 'T')),
        rawPayload: appt as unknown as Prisma.JsonObject,
      },
      create: {
        businessId: this.businessId,
        externalAppointmentId: BigInt(appt.id),
        externalCustomerId: BigInt(appt.customerId),
        providerId: appt.providerId,
        serviceId: serviceMap?.serviceId,
        scheduledStart: new Date(appt.start.replace(' ', 'T')),
        scheduledEnd: new Date(appt.end.replace(' ', 'T')),
        appointmentStatus: appt.status,
        notesRaw: appt.notes,
        attributionCode: code,
        campaignId: campaignCreative?.campaignId,
        creativeId: campaignCreative?.creativeId,
        campaignCreativeId: campaignCreative?.id,
        rawPayload: appt as unknown as Prisma.JsonObject,
      },
    });
  }

  private async upsertConversion(appointment: Awaited<ReturnType<typeof prisma.externalAppointment.findUnique>>) {
    if (!appointment) return;
    await prisma.conversion.upsert({
      where: {
        businessId_externalAppointmentId: {
          businessId: this.businessId,
          externalAppointmentId: appointment.id,
        },
      },
      update: {
        status: appointment.outcome ?? undefined,
        attributionCode: appointment.attributionCode ?? undefined,
        campaignId: appointment.campaignId,
        creativeId: appointment.creativeId,
        campaignCreativeId: appointment.campaignCreativeId,
        serviceId: appointment.serviceId,
        amount: appointment.finalRevenue ?? appointment.depositAmount ?? undefined,
      },
      create: {
        businessId: this.businessId,
        externalAppointmentId: appointment.id,
        attributionCode: appointment.attributionCode ?? undefined,
        campaignId: appointment.campaignId,
        creativeId: appointment.creativeId,
        campaignCreativeId: appointment.campaignCreativeId,
        serviceId: appointment.serviceId,
        status: appointment.outcome ?? ConversionStatus.PENDING,
        amount: appointment.finalRevenue ?? appointment.depositAmount ?? undefined,
        currency: appointment.finalRevenueCurrency ?? appointment.depositCurrency ?? 'CLP',
        occurredAt: appointment.scheduledStart,
      },
    });
  }
}
