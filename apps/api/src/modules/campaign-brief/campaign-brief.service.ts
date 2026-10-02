import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CampaignBriefStatus, Prisma } from '@prisma/client';
import { prisma } from '@publicador/database';
import { BusinessContextResolver } from '../../shared/business-context/business-context.resolver';
import {
  REQUIRED_APPROVAL_FIELDS,
  type CampaignBriefResponse,
  type CampaignBriefStatusFilter,
  type CampaignExecutionSummary,
  type CreateCampaignBriefInput,
  type UpdateCampaignBriefInput,
} from './dto/campaign-brief.dto';

/**
 * Servicio que gestiona el `CampaignBrief` persistente del negocio
 * configurado en `BUSINESS_ID`. Es el segundo paso del plan publicitario
 * estratégico: define qué quiere conseguir una campaña concreta (objetivo
 * comercial, oferta, KPI, cliente ideal, presupuesto y reglas de decisión)
 * antes de tocar Meta.
 *
 * En esta entrega:
 * - El resto de módulos lo consume **en modo sólo lectura** (vía este
 *   servicio cuando lo necesiten más adelante).
 * - El consumidor HTTP (`CampaignBriefController`) es la única vía para
 *   escribir briefs en esta capa.
 */
type CampaignBriefRecord = Prisma.CampaignBriefGetPayload<object>;

type ExecutionRecord = Prisma.CampaignGetPayload<{
  select: {
    id: true;
    name: true;
    status: true;
    dailyBudget: true;
    lifetimeBudget: true;
    metaPublishStatus: true;
    metaPublishedAt: true;
    startDate: true;
    endDate: true;
    createdAt: true;
    campaignBriefId: true;
  };
}>;

/**
 * Serializa una `Campaign` al resumen compacto `CampaignExecutionSummary`.
 * NO incluye `campaignCreatives` ni métricas: la UI debe pedirlas a
 * `GET /campaigns/:id` si las necesita.
 */
const serializeExecution = (campaign: ExecutionRecord): CampaignExecutionSummary => ({
  id: campaign.id,
  name: campaign.name,
  status: campaign.status,
  dailyBudget:
    campaign.dailyBudget === null ? null : campaign.dailyBudget.toString(),
  lifetimeBudget:
    campaign.lifetimeBudget === null ? null : campaign.lifetimeBudget.toString(),
  metaPublishStatus: campaign.metaPublishStatus,
  metaPublishedAt:
    campaign.metaPublishedAt === null ? null : campaign.metaPublishedAt.toISOString(),
  startDate: campaign.startDate === null ? null : campaign.startDate.toISOString(),
  endDate: campaign.endDate === null ? null : campaign.endDate.toISOString(),
  createdAt: campaign.createdAt.toISOString(),
});

const EXECUTION_SELECT = {
  id: true,
  name: true,
  status: true,
  dailyBudget: true,
  lifetimeBudget: true,
  metaPublishStatus: true,
  metaPublishedAt: true,
  startDate: true,
  endDate: true,
  createdAt: true,
  campaignBriefId: true,
} as const;

/**
 * Devuelve los resúmenes de ejecución de un conjunto de briefs. Sólo trae
 * campañas con `campaignBriefId` no nulo (las huérfanas quedan excluidas
 * automáticamente al filtrar por `in: briefIds`).
 */
const fetchExecutionsByBriefIds = async (
  businessId: string,
  briefIds: string[],
): Promise<Map<string, CampaignExecutionSummary[]>> => {
  if (briefIds.length === 0) return new Map();
  const rows = await prisma.campaign.findMany({
    where: {
      businessId,
      campaignBriefId: { in: briefIds, not: null },
    },
    orderBy: { createdAt: 'desc' },
    select: EXECUTION_SELECT,
  });
  const grouped = new Map<string, CampaignExecutionSummary[]>();
  for (const row of rows) {
    // El filtro `campaignBriefId: { not: null }` ya garantiza `not null`.
    if (row.campaignBriefId === null) continue;
    const list = grouped.get(row.campaignBriefId) ?? [];
    list.push(serializeExecution(row));
    grouped.set(row.campaignBriefId, list);
  }
  return grouped;
};

const serialize = (
  brief: CampaignBriefRecord,
  executions: CampaignExecutionSummary[] = [],
): CampaignBriefResponse => ({
  id: brief.id,
  businessId: brief.businessId,
  serviceId: brief.serviceId,
  title: brief.title,
  status: brief.status,
  businessObjective: brief.businessObjective,
  offer: brief.offer,
  primaryKpi: brief.primaryKpi,
  idealCustomerProfile: brief.idealCustomerProfile,
  qualifyingQuestions: brief.qualifyingQuestions,
  monthlyAcquisitionGoal: brief.monthlyAcquisitionGoal,
  costPerAcquisitionCap:
    brief.costPerAcquisitionCap === null
      ? null
      : brief.costPerAcquisitionCap.toString(),
  lifetimeBudgetCap:
    brief.lifetimeBudgetCap === null
      ? null
      : brief.lifetimeBudgetCap.toString(),
  dailyBudgetCap:
    brief.dailyBudgetCap === null
      ? null
      : brief.dailyBudgetCap.toString(),
  plannedDurationDays: brief.plannedDurationDays,
  constraints: brief.constraints,
  stopIf: brief.stopIf,
  scaleIf: brief.scaleIf,
  approvedAt:
    brief.approvedAt === null ? null : brief.approvedAt.toISOString(),
  approvedBy: brief.approvedBy,
  createdAt: brief.createdAt.toISOString(),
  updatedAt: brief.updatedAt.toISOString(),
  executions,
});

const buildDecimalData = (
  data: Partial<
    Pick<
      CreateCampaignBriefInput,
      'costPerAcquisitionCap' | 'lifetimeBudgetCap' | 'dailyBudgetCap'
    >
  >,
): {
  costPerAcquisitionCap?: Prisma.Decimal | null;
  lifetimeBudgetCap?: Prisma.Decimal | null;
  dailyBudgetCap?: Prisma.Decimal | null;
} => {
  const result: {
    costPerAcquisitionCap?: Prisma.Decimal | null;
    lifetimeBudgetCap?: Prisma.Decimal | null;
    dailyBudgetCap?: Prisma.Decimal | null;
  } = {};
  if (data.costPerAcquisitionCap !== undefined) {
    result.costPerAcquisitionCap =
      data.costPerAcquisitionCap === null
        ? null
        : new Prisma.Decimal(data.costPerAcquisitionCap);
  }
  if (data.lifetimeBudgetCap !== undefined) {
    result.lifetimeBudgetCap =
      data.lifetimeBudgetCap === null
        ? null
        : new Prisma.Decimal(data.lifetimeBudgetCap);
  }
  if (data.dailyBudgetCap !== undefined) {
    result.dailyBudgetCap =
      data.dailyBudgetCap === null
        ? null
        : new Prisma.Decimal(data.dailyBudgetCap);
  }
  return result;
};

@Injectable()
export class CampaignBriefService {
  constructor(private readonly businessContext: BusinessContextResolver) {}

  private get businessId(): string {
    return this.businessContext.resolve().businessId;
  }

  async create(input: CreateCampaignBriefInput): Promise<CampaignBriefResponse> {
    const businessId = this.businessId;
    const service = await this.assertServiceBelongsToBusiness(input.serviceId, businessId);
    void service;
    const brief = await prisma.campaignBrief.create({
      data: {
        businessId,
        serviceId: input.serviceId,
        title: input.title,
        status: CampaignBriefStatus.DRAFT,
        businessObjective: input.businessObjective,
        offer: input.offer,
        primaryKpi: input.primaryKpi,
        idealCustomerProfile: input.idealCustomerProfile ?? null,
        qualifyingQuestions: input.qualifyingQuestions ?? [],
        monthlyAcquisitionGoal: input.monthlyAcquisitionGoal ?? null,
        ...buildDecimalData(input),
        plannedDurationDays: input.plannedDurationDays ?? null,
        constraints: input.constraints ?? [],
        stopIf: input.stopIf ?? null,
        scaleIf: input.scaleIf ?? null,
      },
    });
    return serialize(brief, []);
  }

  /**
   * `getById` valida que el brief pertenezca al negocio activo. Si no
   * existe o pertenece a otro `businessId`, lanza `NotFoundException`
   * (no exponemos la diferencia para no revelar IDs ajenos). Además
   * enriquece la respuesta con el resumen de ejecuciones vinculadas.
   */
  async getById(id: string): Promise<CampaignBriefResponse> {
    const businessId = this.businessId;
    const brief = await prisma.campaignBrief.findFirst({
      where: { id, businessId },
    });
    if (!brief) {
      throw new NotFoundException(`CampaignBrief ${id} no encontrado`);
    }
    const executionsByBrief = await fetchExecutionsByBriefIds(businessId, [id]);
    return serialize(brief, executionsByBrief.get(id) ?? []);
  }

  async list(
    filters: { status?: CampaignBriefStatusFilter } = {},
  ): Promise<CampaignBriefResponse[]> {
    const businessId = this.businessId;
    const briefs = await prisma.campaignBrief.findMany({
      where: {
        businessId,
        ...(filters.status ? { status: filters.status as CampaignBriefStatus } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    const executionsByBrief = await fetchExecutionsByBriefIds(
      businessId,
      briefs.map((b) => b.id),
    );
    return briefs.map((brief) => serialize(brief, executionsByBrief.get(brief.id) ?? []));
  }

  async update(
    id: string,
    input: UpdateCampaignBriefInput,
  ): Promise<CampaignBriefResponse> {
    const businessId = this.businessId;
    const existing = await prisma.campaignBrief.findFirst({
      where: { id, businessId },
    });
    if (!existing) {
      throw new NotFoundException(`CampaignBrief ${id} no encontrado`);
    }
    if (input.serviceId !== undefined) {
      await this.assertServiceBelongsToBusiness(input.serviceId, businessId);
    }
    const data: Prisma.CampaignBriefUpdateInput = {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.businessObjective !== undefined
        ? { businessObjective: input.businessObjective }
        : {}),
      ...(input.offer !== undefined ? { offer: input.offer } : {}),
      ...(input.primaryKpi !== undefined ? { primaryKpi: input.primaryKpi } : {}),
      ...(input.idealCustomerProfile !== undefined
        ? { idealCustomerProfile: input.idealCustomerProfile }
        : {}),
      ...(input.qualifyingQuestions !== undefined
        ? { qualifyingQuestions: input.qualifyingQuestions }
        : {}),
      ...(input.constraints !== undefined
        ? { constraints: input.constraints }
        : {}),
      ...(input.stopIf !== undefined ? { stopIf: input.stopIf } : {}),
      ...(input.scaleIf !== undefined ? { scaleIf: input.scaleIf } : {}),
      ...(input.monthlyAcquisitionGoal !== undefined
        ? { monthlyAcquisitionGoal: input.monthlyAcquisitionGoal }
        : {}),
      ...(input.plannedDurationDays !== undefined
        ? { plannedDurationDays: input.plannedDurationDays }
        : {}),
      ...buildDecimalData(input),
    };
    if (input.serviceId !== undefined) {
      data.service = { connect: { id: input.serviceId } };
    }
    const updated = await prisma.campaignBrief.update({
      where: { id },
      data,
    });
    const executionsByBrief = await fetchExecutionsByBriefIds(businessId, [id]);
    return serialize(updated, executionsByBrief.get(id) ?? []);
  }

  /**
   * Cambia el brief a estado `APPROVED` y setea `approvedAt = new Date()`.
   * Falla con `BadRequestException` si falta alguno de los campos críticos
   * (`title`, `businessObjective`, `offer`, `primaryKpi`, `serviceId`).
   * Esta función es idempotente: aprobar un brief ya aprobado mantiene
   * el `approvedAt` previo (no se sobrescribe).
   */
  async approve(id: string): Promise<CampaignBriefResponse> {
    const businessId = this.businessId;
    const existing = await prisma.campaignBrief.findFirst({
      where: { id, businessId },
    });
    if (!existing) {
      throw new NotFoundException(`CampaignBrief ${id} no encontrado`);
    }
    const missing = REQUIRED_APPROVAL_FIELDS.filter((field) => {
      const value = existing[field as keyof typeof existing];
      if (typeof value === 'string') return value.trim().length === 0;
      if (value === null || value === undefined) return true;
      return false;
    });
    if (missing.length > 0) {
      throw new BadRequestException({
        message: 'Faltan campos obligatorios para aprobar el brief',
        missing,
      });
    }
    const updated =
      existing.status === CampaignBriefStatus.APPROVED && existing.approvedAt
        ? existing
        : await prisma.campaignBrief.update({
            where: { id },
            data: {
              status: CampaignBriefStatus.APPROVED,
              approvedAt: new Date(),
            },
          });
    const executionsByBrief = await fetchExecutionsByBriefIds(businessId, [id]);
    return serialize(updated, executionsByBrief.get(id) ?? []);
  }

  async archive(id: string): Promise<CampaignBriefResponse> {
    const businessId = this.businessId;
    const existing = await prisma.campaignBrief.findFirst({
      where: { id, businessId },
    });
    if (!existing) {
      throw new NotFoundException(`CampaignBrief ${id} no encontrado`);
    }
    const updated = await prisma.campaignBrief.update({
      where: { id },
      data: { status: CampaignBriefStatus.ARCHIVED },
    });
    const executionsByBrief = await fetchExecutionsByBriefIds(businessId, [id]);
    return serialize(updated, executionsByBrief.get(id) ?? []);
  }

  /**
   * Devuelve las ejecuciones (resumen) de un brief validando que el brief
   * pertenezca al negocio activo. Lanza `NotFoundException` si el brief
   * no existe o pertenece a otro negocio. Sólo trae campañas con
   * `campaignBriefId = id` (las huérfanas quedan excluidas por el filtro).
   */
  async listExecutionsByBriefId(briefId: string): Promise<CampaignExecutionSummary[]> {
    const businessId = this.businessId;
    const brief = await prisma.campaignBrief.findFirst({
      where: { id: briefId, businessId },
      select: { id: true },
    });
    if (!brief) {
      throw new NotFoundException(`CampaignBrief ${briefId} no encontrado`);
    }
    const executionsByBrief = await fetchExecutionsByBriefIds(businessId, [briefId]);
    return executionsByBrief.get(briefId) ?? [];
  }

  /**
   * Helper interno: verifica que el `serviceId` pertenezca al `businessId`
   * configurado. Devuelve el servicio (no-op para el caller actual, pero
   * útil en tests) o lanza `BadRequestException`.
   */
  private async assertServiceBelongsToBusiness(
    serviceId: string,
    businessId: string,
  ): Promise<{ id: string }> {
    const service = await prisma.service.findFirst({
      where: { id: serviceId, businessId },
      select: { id: true },
    });
    if (!service) {
      throw new BadRequestException(
        `El servicio ${serviceId} no pertenece al negocio actual`,
      );
    }
    return service;
  }
}
