import { BadRequestException } from '@nestjs/common';
import { BusinessContextResolver } from '../../shared/business-context/business-context.resolver';
import { CampaignBriefService } from './campaign-brief.service';

interface CampaignBriefFixture {
  id: string;
  businessId: string;
  serviceId: string;
  title: string;
  status: 'DRAFT' | 'APPROVED' | 'ARCHIVED';
  businessObjective: string;
  offer: string;
  primaryKpi: string;
  idealCustomerProfile: string | null;
  qualifyingQuestions: string[];
  monthlyAcquisitionGoal: number | null;
  costPerAcquisitionCap: { toString(): string } | null;
  lifetimeBudgetCap: { toString(): string } | null;
  dailyBudgetCap: { toString(): string } | null;
  plannedDurationDays: number | null;
  constraints: string[];
  stopIf: string | null;
  scaleIf: string | null;
  approvedAt: Date | null;
  approvedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const baseFixture = (
  overrides: Partial<CampaignBriefFixture> = {},
): CampaignBriefFixture => ({
  id: 'brief-1',
  businessId: 'test-business',
  serviceId: 'svc-existing',
  title: 'Balayage Q4',
  status: 'DRAFT',
  businessObjective: 'Conseguir 5 evaluaciones de balayage en 14 días',
  offer: 'Evaluación + 20% descuento en la primera sesión',
  primaryKpi: 'Evaluaciones',
  idealCustomerProfile: null,
  qualifyingQuestions: [],
  monthlyAcquisitionGoal: null,
  costPerAcquisitionCap: null,
  lifetimeBudgetCap: null,
  dailyBudgetCap: null,
  plannedDurationDays: null,
  constraints: [],
  stopIf: null,
  scaleIf: null,
  approvedAt: null,
  approvedBy: null,
  createdAt: new Date('2026-09-27T00:00:00Z'),
  updatedAt: new Date('2026-09-27T00:00:00Z'),
  ...overrides,
});

interface PrismaMock {
  campaignBrief: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  campaign: {
    findMany: jest.Mock;
  };
  service: {
    findFirst: jest.Mock;
  };
}

function attachPrismaMock(mock: PrismaMock): void {
  (prisma as unknown as { campaignBrief: PrismaMock['campaignBrief'] }).campaignBrief =
    mock.campaignBrief;
  (prisma as unknown as { campaign: PrismaMock['campaign'] }).campaign = mock.campaign;
  (prisma as unknown as { service: PrismaMock['service'] }).service = mock.service;
}

function buildService(): { service: CampaignBriefService } {
  // Importamos aquí para evitar ruido en el mock -- el service se construye
  // con `new`, igual que en otros specs del módulo.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return { service: new CampaignBriefService(new BusinessContextResolver()) };
}

import { prisma } from '@publicador/database';

describe('CampaignBriefService', () => {
  const originalBusinessId = process.env.BUSINESS_ID;

  beforeEach(() => {
    process.env.BUSINESS_ID = 'test-business';
  });

  afterEach(() => {
    if (originalBusinessId === undefined) {
      delete process.env.BUSINESS_ID;
    } else {
      process.env.BUSINESS_ID = originalBusinessId;
    }
  });

  it('create persiste un brief válido con status DRAFT', async () => {
    const mock: PrismaMock = {
      campaignBrief: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) =>
          baseFixture({
            ...(data as Partial<CampaignBriefFixture>),
            id: 'brief-new',
            status: 'DRAFT',
          }),
        ),
        update: jest.fn(),
      },
      campaign: { findMany: jest.fn(async () => []) },
      service: {
        findFirst: jest.fn(async ({ where }: { where: { id: string } }) =>
          where.id === 'svc-balayage' ? { id: 'svc-balayage' } : null,
        ),
      },
    };
    attachPrismaMock(mock);
    const { service } = buildService();

    const result = await service.create({
      title: 'Balayage Q4',
      businessObjective: 'Conseguir 5 evaluaciones de balayage en 14 días',
      offer: 'Evaluación + 20% descuento en la primera sesión',
      primaryKpi: 'Evaluaciones',
      serviceId: 'svc-balayage',
      qualifyingQuestions: ['¿Cabello tinturado?'],
      constraints: ['No usar antes/después'],
    });

    expect(result.id).toBe('brief-new');
    expect(result.status).toBe('DRAFT');
    expect(result.businessId).toBe('test-business');
    expect(result.qualifyingQuestions).toEqual(['¿Cabello tinturado?']);
    expect(mock.campaignBrief.create).toHaveBeenCalledTimes(1);
    const callArg = mock.campaignBrief.create.mock.calls[0][0];
    expect(callArg.data.businessId).toBe('test-business');
    expect(callArg.data.serviceId).toBe('svc-balayage');
    expect(callArg.data.status).toBe('DRAFT');
    expect(callArg.data.qualifyingQuestions).toEqual(['¿Cabello tinturado?']);
    expect(callArg.data.constraints).toEqual(['No usar antes/después']);
  });

  it('approve lanza BadRequestException si faltan campos críticos', async () => {
    const incomplete = baseFixture({
      id: 'brief-incomplete',
      title: '',
      businessObjective: 'OK',
      offer: 'OK',
      primaryKpi: 'OK',
      serviceId: 'svc-1',
    });
    const mock: PrismaMock = {
      campaignBrief: {
        findFirst: jest.fn(async () => incomplete),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      campaign: { findMany: jest.fn(async () => []) },
      service: { findFirst: jest.fn() },
    };
    attachPrismaMock(mock);
    const { service } = buildService();

    const caught: { value: unknown } = { value: null };
    try {
      await service.approve('brief-incomplete');
      throw new Error('Se esperaba BadRequestException');
    } catch (err) {
      caught.value = err;
    }
    expect(caught.value).toBeInstanceOf(BadRequestException);
    const body = (caught.value as BadRequestException).getResponse() as {
      message: string;
      missing: string[];
    };
    expect(body.message).toBe('Faltan campos obligatorios para aprobar el brief');
    expect(body.missing).toEqual(expect.arrayContaining(['title']));
    expect(mock.campaignBrief.update).not.toHaveBeenCalled();
  });

  it('approve setea approvedAt y status APPROVED cuando todos los campos críticos están completos', async () => {
    const complete = baseFixture({ id: 'brief-complete' });
    const updated = baseFixture({
      ...complete,
      status: 'APPROVED',
      approvedAt: new Date('2026-09-27T05:00:00Z'),
    });
    const mock: PrismaMock = {
      campaignBrief: {
        findFirst: jest.fn(async () => complete),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(async () => updated),
      },
      campaign: { findMany: jest.fn(async () => []) },
      service: { findFirst: jest.fn() },
    };
    attachPrismaMock(mock);
    const { service } = buildService();

    const result = await service.approve('brief-complete');

    expect(result.status).toBe('APPROVED');
    expect(result.approvedAt).toBe('2026-09-27T05:00:00.000Z');
    expect(mock.campaignBrief.update).toHaveBeenCalledTimes(1);
    const updateArgs = mock.campaignBrief.update.mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: 'brief-complete' });
    expect(updateArgs.data.status).toBe('APPROVED');
    expect(updateArgs.data.approvedAt).toBeInstanceOf(Date);
  });

  it('getById valida ownership por businessId (lanza NotFound si pertenece a otro negocio)', async () => {
    const mock: PrismaMock = {
      campaignBrief: {
        findFirst: jest.fn(async ({ where }: { where: { id: string; businessId: string } }) =>
          where.businessId === 'test-business' && where.id === 'brief-1'
            ? baseFixture({ id: 'brief-1' })
            : null,
        ),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      campaign: { findMany: jest.fn(async () => []) },
      service: { findFirst: jest.fn() },
    };
    attachPrismaMock(mock);
    const { service } = buildService();

    // Caso positivo: pertenece al negocio.
    const ok = await service.getById('brief-1');
    expect(ok.id).toBe('brief-1');

    // Caso negativo: pertenece a OTRO negocio → findFirst devuelve null.
    await expect(
      (async () => {
        // Forzamos el escenario "otro negocio" temporalmente.
        const tmp = process.env.BUSINESS_ID;
        process.env.BUSINESS_ID = 'other-business';
        try {
          await service.getById('brief-1');
        } finally {
          process.env.BUSINESS_ID = tmp;
        }
      })(),
    ).rejects.toThrow(/no encontrado/);
  });

  it('list filtra por status cuando se entrega y devuelve los briefs en orden de creación descendente', async () => {
    const all = [
      baseFixture({ id: 'a', createdAt: new Date('2026-09-27T02:00:00Z') }),
      baseFixture({ id: 'b', createdAt: new Date('2026-09-27T01:00:00Z') }),
    ];
    const approved = [baseFixture({ id: 'a', status: 'APPROVED' })];
    const findMany = jest.fn(
      async ({ where }: { where: { businessId: string; status?: string } }) =>
        where.status ? approved : all,
    );
    const mock: PrismaMock = {
      campaignBrief: {
        findFirst: jest.fn(),
        findMany,
        create: jest.fn(),
        update: jest.fn(),
      },
      campaign: { findMany: jest.fn(async () => []) },
      service: { findFirst: jest.fn() },
    };
    attachPrismaMock(mock);
    const { service } = buildService();

    const sinFiltro = await service.list();
    expect(sinFiltro).toHaveLength(2);

    const conAprobados = await service.list({ status: 'APPROVED' });
    expect(conAprobados).toHaveLength(1);
    expect(conAprobados[0].id).toBe('a');

    const findManyCalls = findMany.mock.calls;
    expect(findManyCalls[0][0].where.businessId).toBe('test-business');
    expect(findManyCalls[1][0].where.status).toBe('APPROVED');
    expect(findManyCalls[0][0].orderBy).toEqual({ createdAt: 'desc' });
  });

  it('getById enriquece con ejecuciones del brief', async () => {
    const briefFixture = baseFixture({ id: 'brief-execs' });
    const campaignFindMany = jest.fn(async () => [
      {
        id: 'cmp-x',
        name: 'Ejecución',
        status: 'PAUSED',
        dailyBudget: null,
        lifetimeBudget: null,
        metaPublishStatus: 'PAUSED',
        metaPublishedAt: null,
        startDate: null,
        endDate: null,
        createdAt: new Date('2026-09-27T01:00:00Z'),
        campaignBriefId: 'brief-execs',
      },
    ]);
    const mock: PrismaMock = {
      campaignBrief: {
        findFirst: jest.fn(async () => briefFixture),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      campaign: { findMany: campaignFindMany },
      service: { findFirst: jest.fn() },
    };
    attachPrismaMock(mock);
    const { service } = buildService();

    const result = await service.getById('brief-execs');

    expect(result.executions).toHaveLength(1);
    expect(result.executions[0]).toMatchObject({
      id: 'cmp-x',
      name: 'Ejecución',
      status: 'PAUSED',
    });
    expect(campaignFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          businessId: 'test-business',
          campaignBriefId: { in: ['brief-execs'], not: null },
        }),
      }),
    );
  });

  it('listExecutionsByBriefId valida ownership y filtra huérfanas', async () => {
    const campaignFindMany = jest.fn(async () => [
      {
        id: 'cmp-1',
        name: 'Con brief',
        status: 'DRAFT',
        dailyBudget: null,
        lifetimeBudget: null,
        metaPublishStatus: 'DRAFT',
        metaPublishedAt: null,
        startDate: null,
        endDate: null,
        createdAt: new Date('2026-09-27T01:00:00Z'),
        campaignBriefId: 'brief-1',
      },
    ]);
    const mock: PrismaMock = {
      campaignBrief: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({ id: 'brief-1' })
          .mockResolvedValueOnce(null),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      campaign: { findMany: campaignFindMany },
      service: { findFirst: jest.fn() },
    };
    attachPrismaMock(mock);
    const { service } = buildService();

    // Caso positivo.
    const ok = await service.listExecutionsByBriefId('brief-1');
    expect(ok).toHaveLength(1);
    expect(ok[0].id).toBe('cmp-1');
    expect(
      campaignFindMany.mock.calls[0][0].where.campaignBriefId,
    ).toEqual({ in: ['brief-1'], not: null });

    // Caso negativo: brief pertenece a otro negocio → 404.
    await expect(service.listExecutionsByBriefId('brief-1')).rejects.toThrow(
      /no encontrado/,
    );
  });
});
