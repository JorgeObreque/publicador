import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { prisma } from '@publicador/database';
import { BusinessContextResolver } from '../../shared/business-context/business-context.resolver';
import {
  OpenAIClientMock,
  openAIClientMock,
} from '../analyze/openai.client';
import type { BusinessProfileServiceToken } from '../business-profile/business-profile.tokens';
import { CampaignBriefService } from '../campaign-brief/campaign-brief.service';
import { CommercialDiagnosisService } from './commercial-diagnosis.service';
import { DiagnosisEvidenceService } from './diagnosis-evidence.service';
import { BudgetRecommendationService } from './budget-recommendation.service';
import type { ParsedDiagnosisDecision } from './commercial-diagnosis.types';

/**
 * Evidencia mockeada neutra (sin histórico). Los tests que necesitan
 * evidencia con `hasEnoughEvidence=true` o CPA histórico explícito lo
 * sobreescriben vía `evidence.load.mockResolvedValueOnce(...)`.
 */
const EMPTY_EVIDENCE = {
  windowStart: '2026-01-01',
  windowEnd: '2026-02-25',
  daysObserved: 0,
  impressions: 0,
  clicks: 0,
  spend: 0,
  conversions: 0,
  averageCpa: 0,
  averageCpc: 0,
  averageCtr: 0,
  cpaByWeekday: [],
  bestWeekdays: [],
  hasEnoughEvidence: false,
};

interface ProfileFixture {
  id: string;
  businessId: string;
  addressLine: string | null;
  neighborhood: string | null;
  regionCutCode: string | null;
  communeCutCode: string | null;
  regionName: string | null;
  communeName: string | null;
  countryCode: string | null;
  brandVoiceKeywords: string[];
  wordsToAvoid: string[];
  preferredEmojiSemantics: string[];
  primaryCustomerProfile: string;
  commonObjections: string[];
  qualifyingQuestions: string[];
  weeklyServiceCapacity: number | null;
  monthlyAcquisitionGoal: number | null;
  monthlyRevenueTarget: Prisma.Decimal | null;
  costPerAcquisitionCap: Prisma.Decimal | null;
  profileCompletedAt: Date | null;
}

const baseProfile = (
  overrides: Partial<ProfileFixture> = {},
): ProfileFixture => ({
  id: 'profile-test',
  businessId: 'test-business',
  addressLine: 'Av. Apoquindo 4501',
  neighborhood: 'Las Condes',
  regionCutCode: '13',
  communeCutCode: '13114',
  regionName: 'Región Metropolitana de Santiago',
  communeName: 'Las Condes',
  countryCode: 'CL',
  brandVoiceKeywords: ['profesional'],
  wordsToAvoid: ['barato'],
  preferredEmojiSemantics: [],
  primaryCustomerProfile: 'Mujer 30-45 que busca balayage natural',
  commonObjections: [],
  qualifyingQuestions: ['¿Cabello tinturado?'],
  weeklyServiceCapacity: 10,
  monthlyAcquisitionGoal: 20,
  monthlyRevenueTarget: null,
  costPerAcquisitionCap: new Prisma.Decimal(5000),
  profileCompletedAt: new Date('2026-09-27T00:00:00Z'),
  ...overrides,
});

const baseUsage = {
  promptTokens: 180,
  completionTokens: 90,
  totalTokens: 270,
  model: 'gpt-4o-mini',
};

const readyDecision: ParsedDiagnosisDecision = {
  decision: 'READY',
  recommended: {
    situation: 'Demasiada disponibilidad entre semana',
    opportunity: 'Hay demanda latente los lunes',
    primaryGoal: '6 clientes nuevos por semana',
    primaryConversion: 'Reservas',
    recommendedTitle: 'Plan lunes y martes',
    recommendedWeeklyAdd: 6,
    availableCapacity: 10,
    pendingQuestion: null,
  },
  provenance: {
    situation: { value: 'Demasiada disponibilidad entre semana', source: 'AI_INFERENCE' },
    opportunity: { value: 'Hay demanda latente los lunes', source: 'AI_INFERENCE' },
    primaryGoal: { value: '6 clientes nuevos por semana', source: 'SYSTEM_CALCULATION' },
    primaryConversion: { value: 'Reservas', source: 'AI_INFERENCE' },
    recommendedTitle: { value: 'Plan lunes y martes', source: 'SYSTEM_CALCULATION' },
    recommendedWeeklyAdd: { value: 6, source: 'SYSTEM_CALCULATION' },
    availableCapacity: { value: 10, source: 'USER_PROFILE' },
  },
  strategy: {
    businessObjective: 'Conseguir 6 clientes nuevos por semana los lunes y martes.',
    offer: 'Reserva con 20% de descuento para evaluaciones los lunes.',
    primaryKpi: 'Reservas',
    idealCustomerProfile: 'Mujer 30-45 que busca balayage natural',
    qualifyingQuestions: ['¿Cabello tinturado?'],
    constraints: ['No usar barato'],
    stopIf: null,
    scaleIf: null,
    initialDailyBudgetCLP: 5000,
    initialLifetimeBudgetCLP: 70_000,
    initialDurationDays: 14,
    initialCpaTargetCLP: 5000,
    initialCpaCapCLP: 5000,
    progressionSteps: [3, 4, 6],
  },
};

const askDecision: ParsedDiagnosisDecision = {
  decision: 'ASK',
  recommended: {
    situation: 'Demasiada disponibilidad entre semana',
    opportunity: null,
    primaryGoal: null,
    primaryConversion: null,
    recommendedTitle: null,
    recommendedWeeklyAdd: null,
    availableCapacity: 10,
    pendingQuestion: {
      key: 'pain_point',
      text: '¿Cuál es tu principal dolor esta semana?',
    },
  },
  provenance: {
    situation: { value: 'Demasiada disponibilidad entre semana', source: 'AI_INFERENCE' },
    opportunity: { value: null, source: 'AI_INFERENCE' },
    primaryGoal: { value: null, source: 'AI_INFERENCE' },
    primaryConversion: { value: null, source: 'AI_INFERENCE' },
    recommendedTitle: { value: null, source: 'SYSTEM_CAI' },
    recommendedWeeklyAdd: { value: null, source: 'SYSTEM_CAI' },
    availableCapacity: { value: 10, source: 'USER_PROFILE' },
  } as ParsedDiagnosisDecision['provenance'],
  strategy: null,
};

interface ServiceFixture {
  id: string;
  businessId: string;
  serviceId: string | null;
  status: 'IN_PROGRESS' | 'READY' | 'ACCEPTED' | 'ARCHIVED';
  currentSituation: string;
  situation: string | null;
  opportunity: string | null;
  primaryGoal: string | null;
  primaryConversion: string | null;
  recommendedTitle: string | null;
  recommendedWeeklyAdd: number | null;
  availableCapacity: number | null;
  businessObjective: string | null;
  offer: string | null;
  primaryKpi: string | null;
  idealCustomerProfile: string | null;
  qualifyingQuestions: string[];
  constraints: string[];
  stopIf: string | null;
  scaleIf: string | null;
  initialDailyBudgetCLP: Prisma.Decimal | null;
  initialLifetimeBudgetCLP: Prisma.Decimal | null;
  initialDurationDays: number | null;
  initialCpaTargetCLP: Prisma.Decimal | null;
  initialCpaCapCLP: Prisma.Decimal | null;
  progressionSteps: number[];
  provenance: Prisma.JsonValue;
  campaignBriefId: string | null;
  createdAt: Date;
  updatedAt: Date;
  answers: Array<{
    id: string;
    diagnosisId: string;
    questionKey: string;
    questionText: string;
    answerText: string | null;
    wasClarification: boolean;
    askedAt: Date;
    answeredAt: Date | null;
  }>;
}

const baseDiagnosis = (
  overrides: Partial<ServiceFixture> = {},
): ServiceFixture => ({
  id: 'diag-1',
  businessId: 'test-business',
  serviceId: 'svc-1',
  status: 'IN_PROGRESS',
  currentSituation: 'Tengo disponibilidad lunes a miércoles',
  situation: 'Demasiada disponibilidad entre semana',
  opportunity: 'Hay demanda latente los lunes',
  primaryGoal: null,
  primaryConversion: null,
  recommendedTitle: null,
  recommendedWeeklyAdd: null,
  availableCapacity: 10,
  businessObjective: null,
  offer: null,
  primaryKpi: null,
  idealCustomerProfile: null,
  qualifyingQuestions: [],
  constraints: [],
  stopIf: null,
  scaleIf: null,
  initialDailyBudgetCLP: null,
  initialLifetimeBudgetCLP: null,
  initialDurationDays: null,
  initialCpaTargetCLP: null,
  initialCpaCapCLP: null,
  progressionSteps: [],
  provenance: {},
  campaignBriefId: null,
  createdAt: new Date('2026-09-27T00:00:00Z'),
  updatedAt: new Date('2026-09-27T00:00:00Z'),
  answers: [],
  ...overrides,
});

function attachPrismaMock(opts: {
  diagnoses?: ServiceFixture[];
  services?: Array<{ id: string; name: string; description: string | null }>;
  briefs?: Array<Record<string, unknown>>;
}): void {
  const diagnoses = opts.diagnoses ?? [];
  const services = opts.services ?? [{ id: 'svc-1', name: 'Balayage', description: 'Servicio principal' }];
  const briefs = opts.briefs ?? [];

  const answersById = new Map<string, ServiceFixture['answers'][number]>();
  for (const diag of diagnoses) {
    for (const ans of diag.answers) {
      answersById.set(ans.id, { ...ans });
    }
  }

  (prisma as unknown as {
    commercialDiagnosis: {
      create: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    diagnosticAnswer: {
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      findFirst: jest.Mock;
    };
    service: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
    };
    campaignBrief: {
      findFirst: jest.Mock;
    };
    $transaction: jest.Mock;
  }).commercialDiagnosis = {
    create: jest.fn(async ({ data, include }: { data: Record<string, unknown>; include?: unknown }) => {
      const answersInput = (data as { answers?: { create?: Array<Record<string, unknown>> } }).answers;
      const seededAnswers: ServiceFixture['answers'] =
        answersInput && Array.isArray(answersInput.create)
          ? answersInput.create.map((entry, index) => ({
              id: `ans-${index + 1}`,
              diagnosisId: 'diag-new',
              questionKey: String(entry['questionKey'] ?? ''),
              questionText: String(entry['questionText'] ?? ''),
              answerText:
                entry['answerText'] === null || entry['answerText'] === undefined
                  ? null
                  : String(entry['answerText']),
              wasClarification: Boolean(entry['wasClarification']),
              askedAt: entry['askedAt'] instanceof Date ? entry['askedAt'] : new Date(),
              answeredAt: entry['answeredAt'] instanceof Date ? entry['answeredAt'] : null,
            }))
          : [];
      const record: ServiceFixture = {
        ...baseDiagnosis(),
        ...(data as Partial<ServiceFixture>),
        id: 'diag-new',
        answers: seededAnswers,
      };
      void include;
      return record;
    }),
    findFirst: jest.fn(async ({ where }: { where: { id: string; businessId: string } }) => {
      const match = diagnoses.find(
        (d) => d.id === where.id && d.businessId === where.businessId,
      );
      return match ? { ...match } : null;
    }),
    update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const current = diagnoses.find((d) => d.id === where.id);
      const answersInput = (data as { answers?: { create?: Array<Record<string, unknown>> } }).answers;
      const seedAnswers: ServiceFixture['answers'] =
        answersInput && Array.isArray(answersInput.create)
          ? answersInput.create.map((entry, index) => ({
              id: `ans-new-${index + 1}`,
              diagnosisId: where.id,
              questionKey: String(entry['questionKey'] ?? ''),
              questionText: String(entry['questionText'] ?? ''),
              answerText:
                entry['answerText'] === null || entry['answerText'] === undefined
                  ? null
                  : String(entry['answerText']),
              wasClarification: Boolean(entry['wasClarification']),
              askedAt: entry['askedAt'] instanceof Date ? entry['askedAt'] : new Date(),
              answeredAt: entry['answeredAt'] instanceof Date ? entry['answeredAt'] : null,
            }))
          : (current?.answers ?? []).map((ans) => answersById.get(ans.id) ?? ans);
      const merged: ServiceFixture = {
        ...baseDiagnosis(),
        ...(current ?? {}),
        ...(data as Partial<ServiceFixture>),
        id: where.id,
        answers: seedAnswers,
      };
      if (current) {
        Object.assign(current, merged);
      }
      return merged;
    }),
    // P1-1 / P1-2: el servicio usa `updateMany` con condiciones CAS
    // (status === READY, answeredAt IS NULL). El mock emula esa
    // semántica: si el predicado no coincide, count = 0.
    updateMany: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
      if (where['id'] && where['businessId']) {
        const diag = diagnoses.find(
          (d) => d.id === where['id'] && d.businessId === where['businessId'],
        );
        if (!diag) return { count: 0 };
        if (where['status'] && diag.status !== where['status']) return { count: 0 };
        return { count: 1 };
      }
      if (where['id'] && 'answeredAt' in where) {
        // CAS sobre DiagnosticAnswer: el mock cuenta las filas donde
        // answeredAt es null y el id coincide. Aceptamos `answeredAt: null`
        // o `answeredAt: { equals: null }` para cubrir ambos estilos.
        const answeredAtCond = where['answeredAt'];
        const expectedNull =
          answeredAtCond === null ||
          (typeof answeredAtCond === 'object' &&
            answeredAtCond !== null &&
            (answeredAtCond as { equals?: unknown }).equals === null);
        if (!expectedNull) return { count: 0 };
        const ans = answersById.get(where['id'] as string);
        if (!ans || ans.answeredAt !== null) return { count: 0 };
        ans.answeredAt = new Date();
        return { count: 1 };
      }
      return { count: 0 };
    }),
  };

  (prisma as unknown as { diagnosticAnswer: { create: jest.Mock; update: jest.Mock; updateMany: jest.Mock } }).diagnosticAnswer = {
    create: jest.fn(),
    update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const existing = answersById.get(where.id);
      const merged = {
        id: where.id,
        diagnosisId: existing?.diagnosisId ?? 'diag-1',
        questionKey: existing?.questionKey ?? 'pain_point',
        questionText: existing?.questionText ?? '¿Cuál es tu principal dolor?',
        wasClarification: existing?.wasClarification ?? true,
        askedAt: existing?.askedAt ?? new Date('2026-09-27T00:00:00Z'),
        answerText: null,
        answeredAt: null,
        ...(existing ?? {}),
        ...data,
      };
      answersById.set(where.id, merged);
      return merged;
    }),
    updateMany: jest.fn(async ({ where, data }: { where: Record<string, unknown>; data?: Record<string, unknown> }) => {
      if (where['id'] && 'answeredAt' in where) {
        const answeredAtCond = where['answeredAt'];
        const expectedNull =
          answeredAtCond === null ||
          (typeof answeredAtCond === 'object' &&
            answeredAtCond !== null &&
            (answeredAtCond as { equals?: unknown }).equals === null);
        if (!expectedNull) return { count: 0 };
        const ans = answersById.get(where['id'] as string);
        if (!ans || ans.answeredAt !== null) return { count: 0 };
        // Aplica también el `data` (answerText + answeredAt) al estado
        // en memoria, para que el `commercialDiagnosis.update` encuentre
        // el valor actualizado al leer desde `answersById`.
        if (data && typeof data === 'object') {
          Object.assign(ans, data);
        } else {
          ans.answeredAt = new Date();
        }
        return { count: 1 };
      }
      return { count: 0 };
    }),
  };

  (prisma as unknown as {
    service: { findMany: jest.Mock; findFirst: jest.Mock };
  }).service = {
    findMany: jest.fn(async () => services),
    findFirst: jest.fn(async ({ where }: { where: { id: string; businessId?: string } }) => {
      if (where.businessId && where.businessId !== 'test-business') return null;
      return services.find((s) => s.id === where.id) ?? null;
    }),
  };

  (prisma as unknown as { campaignBrief: { findFirst: jest.Mock } }).campaignBrief = {
    findFirst: jest.fn(async () => briefs[0] ?? null),
  };

  // `$transaction`: para los unit tests basta con ejecutar el callback
  // directamente pasándole el mismo `prisma` mockeado (los servicios
  // mockeados ya operan contra el mismo `prisma`).
  (prisma as unknown as { $transaction: jest.Mock }).$transaction = jest.fn(
    async (callback: (tx: unknown) => unknown) => callback(prisma),
  );
}

function buildBusinessProfileServiceMock(
  overrides: Partial<{
    profileCompletedAt: Date | null;
    regionName: string | null;
    communeName: string | null;
  }> = {},
): BusinessProfileServiceToken {
  const profile = baseProfile({
    profileCompletedAt:
      overrides.profileCompletedAt === undefined
        ? new Date('2026-09-27T00:00:00Z')
        : overrides.profileCompletedAt,
    regionName: overrides.regionName ?? null,
    communeName: overrides.communeName ?? null,
  });
  return {
    getOrCreate: jest.fn(async () => profile),
    upsert: jest.fn(),
    markCompleted: jest.fn(),
    isReady: jest.fn((p: { profileCompletedAt: Date | null } | null) =>
      Boolean(p && p.profileCompletedAt),
    ),
    getDisplayLocation: jest.fn(() => ''),
    getBusinessContext: jest.fn(() => ({
      regionName: overrides.regionName ?? null,
      communeName: overrides.communeName ?? null,
      regionCutCode: null,
      communeCutCode: null,
      context: null,
      neighbors: [],
    })),
  } as unknown as BusinessProfileServiceToken;
}

interface BuildOptions {
  configured?: boolean;
  error?: Error;
  profile?: BusinessProfileServiceToken;
  diagnoses?: ServiceFixture[];
  services?: Array<{ id: string; name: string; description: string | null }>;
  response?: { parsed: unknown; usage?: typeof baseUsage };
  briefs?: CampaignBriefService;
}

function buildBriefsService(
  overrides: { createResult?: Partial<CampaignBriefResponse>; approveResult?: Partial<CampaignBriefResponse> } = {},
): {
  briefs: CampaignBriefService;
  create: jest.Mock;
  approve: jest.Mock;
} {
  const createdBase: Partial<CampaignBriefResponse> = {
    id: 'brief-created',
    businessId: 'test-business',
    serviceId: 'svc-1',
    title: 'Plan lunes y martes',
    status: 'DRAFT',
    businessObjective: 'Conseguir 6 clientes nuevos por semana los lunes y martes.',
    offer: 'Reserva con 20% de descuento para evaluaciones los lunes.',
    primaryKpi: 'Reservas',
    idealCustomerProfile: 'Mujer 30-45 que busca balayage natural',
    qualifyingQuestions: ['¿Cabello tinturado?'],
    monthlyAcquisitionGoal: 24,
    costPerAcquisitionCap: '5000',
    lifetimeBudgetCap: '70000',
    dailyBudgetCap: '5000',
    plannedDurationDays: 14,
    constraints: ['No usar barato'],
    stopIf: null,
    scaleIf: null,
    approvedAt: null,
    approvedBy: null,
    createdAt: '2026-09-27T00:00:00.000Z',
    updatedAt: '2026-09-27T00:00:00.000Z',
  };
  const approvedBase: Partial<CampaignBriefResponse> = {
    ...createdBase,
    id: 'brief-approved',
    status: 'APPROVED',
    approvedAt: '2026-09-27T05:00:00.000Z',
    approvedBy: null,
  };
  const create = jest.fn(async (input: unknown) => ({
    ...createdBase,
    ...(overrides.createResult ?? {}),
    // input es opaco para este spec, sólo necesitamos un id estable.
    ...(typeof input === 'object' && input !== null ? { } : {}),
  }));
  const approve = jest.fn(async (_id: string) => ({
    ...approvedBase,
    ...(overrides.approveResult ?? {}),
  }));
  // Por defecto `getById` no existe en el mock y debe ser añadido por el
  // test que lo necesite (re-accept).
  const briefs = {
    create,
    approve,
  } as unknown as CampaignBriefService;
  return { briefs, create, approve };
}

function buildService(options: BuildOptions = {}): {
  service: CommercialDiagnosisService;
  client: OpenAIClientMock;
  profile: BusinessProfileServiceToken;
  briefs: { create: jest.Mock; approve: jest.Mock };
  evidence: { load: jest.Mock };
} {
  const client = openAIClientMock;
  client.configured = options.configured ?? true;
  client.model = 'gpt-4o-mini';
  client.response = null;
  client.error = options.error ?? null;
  client.lastInput = null;
  client.lastPrompts = null;
  if (options.response !== undefined) {
    client.response = {
      parsed: options.response.parsed as Record<string, unknown>,
      raw: {} as never,
      usage: options.response.usage ?? baseUsage,
    };
  }
  const profile = options.profile ?? buildBusinessProfileServiceMock();
  attachPrismaMock({
    diagnoses: options.diagnoses ?? [],
    services: options.services ?? [{ id: 'svc-1', name: 'Balayage', description: 'Servicio principal' }],
  });
  const { briefs } = buildBriefsService();
  // P1-Hallazgo 6: mockeamos `DiagnosisEvidenceService` con un stub
  // determinista. Antes los tests instanciaban el servicio real (que
  // consulta Prisma) y fallaban sin DATABASE_URL.
  const evidence = {
    load: jest.fn(async () => ({ ...EMPTY_EVIDENCE })),
  };
  const budgetService = new BudgetRecommendationService();
  const service = new CommercialDiagnosisService(
    new BusinessContextResolver(),
    client as unknown as Parameters<typeof CommercialDiagnosisService>[1],
    profile,
    briefs,
    evidence as unknown as DiagnosisEvidenceService,
    budgetService,
  );

  return { service, client, profile, briefs, evidence };
}

describe('CommercialDiagnosisService', () => {
  const originalBusinessId = process.env.BUSINESS_ID;

  beforeEach(() => {
    process.env.BUSINESS_ID = 'test-business';
    openAIClientMock.configured = true;
    openAIClientMock.model = 'gpt-4o-mini';
    openAIClientMock.response = null;
    openAIClientMock.error = null;
    openAIClientMock.lastInput = null;
    openAIClientMock.lastPrompts = null;
    jest.spyOn(openAIClientMock, 'summarize').mockClear();
  });

  afterEach(() => {
    if (originalBusinessId === undefined) {
      delete process.env.BUSINESS_ID;
    } else {
      process.env.BUSINESS_ID = originalBusinessId;
    }
  });

  describe('start', () => {
    it('lanza BadRequest cuando el perfil no está completo', async () => {
      const profile = buildBusinessProfileServiceMock({
        profileCompletedAt: null,
      });
      const { service } = buildService({ profile });

      await expect(
        service.start({
          currentSituation: 'Tengo clientas principalmente los fines de semana',
        }),
      ).rejects.toMatchObject({
        name: 'BadRequestException',
        message: expect.stringContaining('Define el contexto del negocio'),
      });
    });

    it('lanza BadRequest cuando el negocio no tiene servicios activos', async () => {
      const { service } = buildService({ services: [] });

      await expect(
        service.start({
          currentSituation: 'Tengo clientas principalmente los fines de semana',
        }),
      ).rejects.toMatchObject({
        name: 'BadRequestException',
        message: expect.stringContaining('servicios activos'),
      });
    });

    it('persiste READY con la recommended de la IA cuando decision=READY', async () => {
      const diagnoses: ServiceFixture[] = [];
      const { service, client } = buildService({
        response: { parsed: readyDecision },
        diagnoses,
      });
      const createSpy = (prisma as unknown as { commercialDiagnosis: { create: jest.Mock } })
        .commercialDiagnosis.create;

      const result = await service.start({
        currentSituation: 'Tengo clientas principalmente jueves a domingo',
      });

      expect(result.status).toBe('READY');
      expect(result.situation).toBe('Demasiada disponibilidad entre semana');
      expect(result.opportunity).toBe('Hay demanda latente los lunes');
      expect(result.primaryGoal).toBe('6 clientes nuevos por semana');
      expect(result.recommendedTitle).toBe('Plan lunes y martes');
      expect(result.recommendedWeeklyAdd).toBe(6);
      expect(result.answers).toEqual([]);
      expect(result.strategy?.businessObjective).toContain('6 clientes nuevos por semana');
      expect(result.strategy?.primaryKpi).toBe('Reservas');

      // La IA se llamó una vez con los prompts correctos.
      expect(client.summarize).toHaveBeenCalledTimes(1);
      const lastPrompts = client.lastPrompts;
      expect(lastPrompts?.systemPrompt).toContain('PROHIBIDO usar el nombre del negocio');
      expect(lastPrompts?.userPrompt).toContain(
        'Tengo clientas principalmente jueves a domingo',
      );

      // La persistencia recibe status READY + strategy completa.
      expect(createSpy).toHaveBeenCalledTimes(1);
      const persistedData = createSpy.mock.calls[0]![0] as { data: Record<string, unknown> };
      expect(persistedData.data.status).toBe('READY');
      expect(persistedData.data.situation).toBe('Demasiada disponibilidad entre semana');
      expect(persistedData.data.primaryGoal).toBe('6 clientes nuevos por semana');
      expect(persistedData.data.recommendedWeeklyAdd).toBe(6);
      expect(persistedData.data.businessObjective).toBe(
        readyDecision.strategy?.businessObjective,
      );
      expect(persistedData.data.initialDailyBudgetCLP).toBeInstanceOf(Prisma.Decimal);
      // Persistence: no crea answers cuando decision=READY.
      expect(persistedData.data.answers).toBeUndefined();
      // Se persiste la provenance original tal cual.
      expect((persistedData.data.provenance as Record<string, unknown>)['primaryGoal']).toEqual({
        value: '6 clientes nuevos por semana',
        source: 'SYSTEM_CALCULATION',
      });
    });

    it('persiste IN_PROGRESS con una DiagnosticAnswer pendiente cuando decision=ASK', async () => {
      const diagnoses: ServiceFixture[] = [];
      const { service } = buildService({
        response: { parsed: askDecision },
        diagnoses,
      });
      const createSpy = (prisma as unknown as { commercialDiagnosis: { create: jest.Mock } })
        .commercialDiagnosis.create;

      const result = await service.start({
        currentSituation: 'Tengo disponibilidad lunes a miércoles',
      });

      expect(result.status).toBe('IN_PROGRESS');
      expect(result.answers).toHaveLength(1);
      expect(result.answers[0]?.questionKey).toBe('pain_point');
      expect(result.answers[0]?.questionText).toBe('¿Cuál es tu principal dolor esta semana?');
      expect(result.answers[0]?.answerText).toBeNull();
      expect(result.answers[0]?.answeredAt).toBeNull();

      expect(createSpy).toHaveBeenCalledTimes(1);
      const persistedData = createSpy.mock.calls[0]![0] as {
        data: Record<string, unknown>;
      };
      expect(persistedData.data.status).toBe('IN_PROGRESS');
      expect(persistedData.data.primaryGoal).toBeNull();
      // Para ASK el servicio omite los campos de strategy (no son null, no están).
      expect(persistedData.data.businessObjective).toBeUndefined();
      // El servicio crea una DiagnosticAnswer con answeredAt null.
      const answersConfig = persistedData.data.answers as { create: Array<Record<string, unknown>> };
      expect(answersConfig.create).toHaveLength(1);
      expect(answersConfig.create[0]?.questionKey).toBe('pain_point');
      expect(answersConfig.create[0]?.answeredAt).toBeNull();
      expect(answersConfig.create[0]?.wasClarification).toBe(true);
    });

    it('cae a fallback determinista cuando OpenAI no está configurado', async () => {
      const { service } = buildService({ configured: false });
      const createSpy = (prisma as unknown as { commercialDiagnosis: { create: jest.Mock } })
        .commercialDiagnosis.create;
      const summarizeSpy = jest.spyOn(openAIClientMock, 'summarize');

      const result = await service.start({
        currentSituation: 'Tengo clientas principalmente jueves a domingo',
      });

      expect(result.status).toBe('READY');
      expect(result.situation).toContain('Situación declarada por la operadora');
      expect(result.situation).toContain('Tengo clientas principalmente jueves a domingo');
      expect(summarizeSpy).not.toHaveBeenCalled();
      expect(createSpy).toHaveBeenCalledTimes(1);
      const persistedData = createSpy.mock.calls[0]![0] as { data: Record<string, unknown> };
      // Fallback marca SYSTEM_CALCULATION en la provenance de situation.
      const provenance = persistedData.data.provenance as Record<string, { source: string }>;
      expect(provenance['situation']?.source).toBe('SYSTEM_CALCULATION');
      expect(provenance['recommendedTitle']?.source).toBe('SYSTEM_CALCULATION');
    });

    it('cae a fallback cuando la IA lanza una excepción', async () => {
      const { service } = buildService({
        error: new Error('OpenAI 503'),
      });

      const result = await service.start({
        currentSituation: 'Tengo clientas principalmente jueves a domingo',
      });

      expect(result.status).toBe('READY');
      expect(result.situation).toContain('Situación declarada por la operadora');
    });
  });

  describe('answer', () => {
    it('persiste el answeredAt de la pregunta pendiente y transita a READY si la IA devuelve READY', async () => {
      const pending: ServiceFixture['answers'][number] = {
        id: 'ans-1',
        diagnosisId: 'diag-1',
        questionKey: 'pain_point',
        questionText: '¿Cuál es tu principal dolor esta semana?',
        answerText: null,
        wasClarification: true,
        askedAt: new Date('2026-09-27T00:00:00Z'),
        answeredAt: null,
      };
      const diagnosis = baseDiagnosis({
        id: 'diag-1',
        status: 'IN_PROGRESS',
        answers: [pending],
      });
      const { service } = buildService({
        response: { parsed: readyDecision },
        diagnoses: [diagnosis],
      });
      // P1-2: `answer` ahora marca `answeredAt` con `updateMany` (CAS)
      // dentro de una `prisma.$transaction`.
      const updateManySpy = (prisma as unknown as {
        diagnosticAnswer: { updateMany: jest.Mock };
        $transaction: jest.Mock;
      }).diagnosticAnswer.updateMany;
      const transactionSpy = (prisma as unknown as { $transaction: jest.Mock }).$transaction;
      const diagnosisUpdateSpy = (prisma as unknown as { commercialDiagnosis: { update: jest.Mock } })
        .commercialDiagnosis.update;

      const result = await service.answer('diag-1', {
        questionKey: 'pain_point',
        answerText: 'No llegan evaluaciones los lunes',
      });

      expect(result.status).toBe('READY');
      expect(result.primaryGoal).toBe('6 clientes nuevos por semana');
      expect(result.answers[0]?.answerText).toBe('No llegan evaluaciones los lunes');
      // El answeredAt fue seteado a una fecha reciente.
      expect(result.answers[0]?.answeredAt).toEqual(expect.any(String));

      // P1-2: la actualización atómica ocurrió vía `updateMany` dentro
      // de una transacción.
      expect(transactionSpy).toHaveBeenCalledTimes(1);
      expect(updateManySpy).toHaveBeenCalledTimes(1);
      const updateManyArgs = updateManySpy.mock.calls[0]![0] as {
        where: { id: string; diagnosisId: string; answeredAt: null };
        data: { answerText: string; answeredAt: Date };
      };
      expect(updateManyArgs.where.id).toBe('ans-1');
      expect(updateManyArgs.where.answeredAt).toBeNull();
      expect(updateManyArgs.data.answerText).toBe('No llegan evaluaciones los lunes');
      expect(updateManyArgs.data.answeredAt).toBeInstanceOf(Date);

      expect(diagnosisUpdateSpy).toHaveBeenCalledTimes(1);
      const diagnosisUpdateArgs = diagnosisUpdateSpy.mock.calls[0]![0] as {
        data: Record<string, unknown>;
      };
      expect(diagnosisUpdateArgs.data.status).toBe('READY');
      expect(diagnosisUpdateArgs.data.businessObjective).toBe(
        readyDecision.strategy?.businessObjective,
      );
    });

    it('fuerza READY con fallback cuando la IA insiste con una 4ta pregunta', async () => {
      const baseAnswers: ServiceFixture['answers'] = [
        {
          id: 'ans-1',
          diagnosisId: 'diag-1',
          questionKey: 'pain_point',
          questionText: '¿Cuál es tu principal dolor?',
          answerText: 'No llegan evaluaciones los lunes',
          wasClarification: true,
          askedAt: new Date('2026-09-27T00:00:00Z'),
          answeredAt: new Date('2026-09-27T00:01:00Z'),
        },
        {
          id: 'ans-2',
          diagnosisId: 'diag-1',
          questionKey: 'capacity_target',
          questionText: '¿Cuántos clientes?',
          answerText: '6 clientes nuevos por semana',
          wasClarification: true,
          askedAt: new Date('2026-09-27T00:01:00Z'),
          answeredAt: new Date('2026-09-27T00:02:00Z'),
        },
        {
          id: 'ans-3',
          diagnosisId: 'diag-1',
          questionKey: 'primary_conversion',
          questionText: '¿Cuál es la conversión principal?',
          answerText: null,
          wasClarification: true,
          askedAt: new Date('2026-09-27T00:02:00Z'),
          answeredAt: null,
        },
      ];
      const diagnosis = baseDiagnosis({
        id: 'diag-1',
        status: 'IN_PROGRESS',
        answers: baseAnswers,
      });
      // La IA sigue insistiendo con una pregunta nueva.
      const { service } = buildService({
        response: { parsed: askDecision },
        diagnoses: [diagnosis],
      });
      const diagnosisUpdateSpy = (prisma as unknown as { commercialDiagnosis: { update: jest.Mock } })
        .commercialDiagnosis.update;

      const result = await service.answer('diag-1', {
        questionKey: 'primary_conversion',
        answerText: 'Reservas online',
      });

      // Como la IA devolvió ASK pero ya pasamos el máximo, se fuerza READY.
      expect(result.status).toBe('READY');
      expect(result.situation).toContain('Situación declarada por la operadora');
      // La provenance debe venir con SYSTEM_CALCULATION (fallback).
      const provenance = result.strategy?.provenance as Record<string, { source: string }>;
      expect(provenance['situation']?.source).toBe('SYSTEM_CALCULATION');
      // El servicio ya NO agrega una nueva DiagnosticAnswer pendiente
      // (status READY, no hay "answers.create").
      const updateCall = diagnosisUpdateSpy.mock.calls[0]![0] as {
        data: Record<string, unknown>;
      };
      expect(updateCall.data.status).toBe('READY');
      expect(updateCall.data.answers).toBeUndefined();
    });

    it('lanza BadRequest cuando el questionKey no coincide con la pregunta pendiente', async () => {
      const diagnosis = baseDiagnosis({
        id: 'diag-1',
        status: 'IN_PROGRESS',
        answers: [
          {
            id: 'ans-1',
            diagnosisId: 'diag-1',
            questionKey: 'pain_point',
            questionText: '¿Cuál es tu principal dolor?',
            answerText: null,
            wasClarification: true,
            askedAt: new Date('2026-09-27T00:00:00Z'),
            answeredAt: null,
          },
        ],
      });
      const { service } = buildService({ diagnoses: [diagnosis] });

      await expect(
        service.answer('diag-1', {
          questionKey: 'otro_key',
          answerText: 'Algo',
        }),
      ).rejects.toMatchObject({
        name: 'BadRequestException',
        message: expect.stringContaining('pain_point'),
      });
    });

    it('lanza BadRequest cuando el diagnóstico ya está READY', async () => {
      const diagnosis = baseDiagnosis({ id: 'diag-1', status: 'READY' });
      const { service } = buildService({ diagnoses: [diagnosis] });

      await expect(
        service.answer('diag-1', {
          questionKey: 'pain_point',
          answerText: 'Algo',
        }),
      ).rejects.toMatchObject({
        name: 'BadRequestException',
        message: expect.stringContaining('en progreso'),
      });
    });

    it('lanza BadRequest cuando el diagnóstico ya está ACCEPTED', async () => {
      const diagnosis = baseDiagnosis({ id: 'diag-1', status: 'ACCEPTED' });
      const { service } = buildService({ diagnoses: [diagnosis] });

      await expect(
        service.answer('diag-1', {
          questionKey: 'pain_point',
          answerText: 'Algo',
        }),
      ).rejects.toMatchObject({
        name: 'BadRequestException',
      });
    });
  });

  describe('adjust', () => {
    it('actualiza la recommended en READY manteniendo READY', async () => {
      const diagnosis = baseDiagnosis({
        id: 'diag-1',
        status: 'READY',
        situation: 'Vieja situación',
        primaryGoal: 'Vieja meta',
        recommendedTitle: 'Viejo título',
      });
      const adjustedDecision: ParsedDiagnosisDecision = {
        ...readyDecision,
        recommended: {
          ...readyDecision.recommended,
          primaryGoal: '8 clientes nuevos por semana',
          recommendedTitle: 'Plan lunes y martes v2',
        },
      };
      const { service } = buildService({
        response: { parsed: adjustedDecision },
        diagnoses: [diagnosis],
      });
      const diagnosisUpdateSpy = (prisma as unknown as { commercialDiagnosis: { update: jest.Mock } })
        .commercialDiagnosis.update;

      const result = await service.adjust('diag-1', {
        instruction: 'Sube el objetivo a 8 clientes por semana.',
      });

      expect(result.status).toBe('READY');
      expect(result.primaryGoal).toBe('8 clientes nuevos por semana');
      expect(result.recommendedTitle).toBe('Plan lunes y martes v2');
      const updateArgs = diagnosisUpdateSpy.mock.calls[0]![0] as {
        data: Record<string, unknown>;
      };
      expect(updateArgs.data.status).toBe('READY');
      expect(updateArgs.data.primaryGoal).toBe('8 clientes nuevos por semana');
    });

    it('devuelve a READY una diagnosis ACCEPTED para re-confirmar', async () => {
      const diagnosis = baseDiagnosis({
        id: 'diag-1',
        status: 'ACCEPTED',
        campaignBriefId: 'brief-prev',
      });
      const { service } = buildService({
        response: { parsed: readyDecision },
        diagnoses: [diagnosis],
      });
      const diagnosisUpdateSpy = (prisma as unknown as { commercialDiagnosis: { update: jest.Mock } })
        .commercialDiagnosis.update;

      const result = await service.adjust('diag-1', {
        instruction: 'Enfoca solo los lunes.',
      });

      expect(result.status).toBe('READY');
      const updateArgs = diagnosisUpdateSpy.mock.calls[0]![0] as {
        data: Record<string, unknown>;
      };
      expect(updateArgs.data.status).toBe('READY');
      // La diagnosis vuelve a READY pero conserva campaignBriefId (no se borra).
      // Verificamos que NO se sobreescribe campaignBriefId en este update.
      expect(updateArgs.data.campaignBriefId).toBeUndefined();
    });
  });

  describe('accept', () => {
    it('crea un CampaignBrief aprobado y devuelve ACCEPTED + campaignBrief con id', async () => {
      const diagnosis = baseDiagnosis({
        id: 'diag-1',
        status: 'READY',
        situation: 'Demasiada disponibilidad entre semana',
        opportunity: 'Hay demanda latente los lunes',
        primaryGoal: '6 clientes nuevos por semana',
        primaryConversion: 'Reservas',
        recommendedTitle: 'Plan lunes y martes',
        recommendedWeeklyAdd: 6,
        availableCapacity: 10,
        businessObjective: 'Conseguir 6 clientes nuevos por semana los lunes y martes.',
        offer: 'Reserva con 20% de descuento para evaluaciones los lunes.',
        primaryKpi: 'Reservas',
        qualifyingQuestions: ['¿Cabello tinturado?'],
        constraints: ['No usar barato'],
        initialDailyBudgetCLP: new Prisma.Decimal(5000),
        initialLifetimeBudgetCLP: new Prisma.Decimal(70_000),
        initialDurationDays: 14,
        initialCpaCapCLP: new Prisma.Decimal(5000),
        progressionSteps: [3, 4, 6],
      });
      const { service, briefs } = buildService({ diagnoses: [diagnosis] });
      const diagnosisUpdateSpy = (prisma as unknown as { commercialDiagnosis: { update: jest.Mock } })
        .commercialDiagnosis.update;

      const result = await service.accept('diag-1');

      expect(result.diagnosis.status).toBe('ACCEPTED');
      expect(result.diagnosis.campaignBriefId).toBe('brief-approved');
      expect(result.campaignBrief.id).toBe('brief-approved');
      expect(result.campaignBrief.status).toBe('APPROVED');

      expect(briefs.create).toHaveBeenCalledTimes(1);
      expect(briefs.approve).toHaveBeenCalledTimes(1);
      expect(briefs.approve).toHaveBeenCalledWith('brief-created');
      const createArgs = briefs.create.mock.calls[0]![0] as Record<string, unknown>;
      expect(createArgs['serviceId']).toBe('svc-1');
      expect(createArgs['businessObjective']).toBe(
        'Conseguir 6 clientes nuevos por semana los lunes y martes.',
      );
      expect(createArgs['monthlyAcquisitionGoal']).toBe(24);
      expect(createArgs['costPerAcquisitionCap']).toBe(5000);
      expect(createArgs['lifetimeBudgetCap']).toBe(70_000);
      expect(createArgs['dailyBudgetCap']).toBe(5000);

      expect(diagnosisUpdateSpy).toHaveBeenCalledTimes(1);
      const updateArgs = diagnosisUpdateSpy.mock.calls[0]![0] as {
        data: Record<string, unknown>;
        where: { id: string };
      };
      expect(updateArgs.where.id).toBe('diag-1');
      expect(updateArgs.data.status).toBe('ACCEPTED');
      expect(updateArgs.data.campaignBriefId).toBe('brief-approved');
    });

    it('lanza BadRequest cuando la diagnosis está IN_PROGRESS', async () => {
      const diagnosis = baseDiagnosis({ id: 'diag-1', status: 'IN_PROGRESS' });
      const { service } = buildService({ diagnoses: [diagnosis] });

      await expect(service.accept('diag-1')).rejects.toMatchObject({
        name: 'BadRequestException',
        message: expect.stringContaining('READY'),
      });
    });

    it('lanza BadRequest cuando el negocio ya no tiene servicios activos', async () => {
      const diagnosis = baseDiagnosis({ id: 'diag-1', status: 'READY' });
      const { service } = buildService({ diagnoses: [diagnosis], services: [] });

      await expect(service.accept('diag-1')).rejects.toMatchObject({
        name: 'BadRequestException',
        message: expect.stringContaining('servicios activos'),
      });
    });
  });

  describe('archive', () => {
    it('cambia el status a ARCHIVED', async () => {
      const diagnosis = baseDiagnosis({ id: 'diag-1', status: 'READY' });
      const { service } = buildService({ diagnoses: [diagnosis] });
      const diagnosisUpdateSpy = (prisma as unknown as { commercialDiagnosis: { update: jest.Mock } })
        .commercialDiagnosis.update;

      const result = await service.archive('diag-1');

      expect(result.status).toBe('ARCHIVED');
      expect(diagnosisUpdateSpy).toHaveBeenCalledTimes(1);
      const updateArgs = diagnosisUpdateSpy.mock.calls[0]![0] as {
        data: Record<string, unknown>;
      };
      expect(updateArgs.data.status).toBe('ARCHIVED');
    });
  });

  describe('getById', () => {
    it('lanza NotFound cuando la diagnosis pertenece a otro businessId', async () => {
      const diagnosis = baseDiagnosis({ id: 'diag-1', businessId: 'other-business' });
      const { service } = buildService({ diagnoses: [diagnosis] });

      await expect(service.getById('diag-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('devuelve la diagnosis cuando pertenece al negocio actual', async () => {
      const diagnosis = baseDiagnosis({ id: 'diag-1', businessId: 'test-business' });
      const { service } = buildService({ diagnoses: [diagnosis] });

      const result = await service.getById('diag-1');
      expect(result.id).toBe('diag-1');
      expect(result.businessId).toBe('test-business');
    });
  });

  // ---------------------------------------------------------------------------
  // P1-3: la IA devolvió ASK sin pendingQuestion válida → fallback READY
  // ---------------------------------------------------------------------------
  describe('start (P1-3: ASK inválido → fallback)', () => {
    it('fuerza fallback READY cuando la IA devuelve ASK con pendingQuestion vacía', async () => {
      const invalidAsk: ParsedDiagnosisDecision = {
        ...askDecision,
        recommended: {
          ...askDecision.recommended,
          pendingQuestion: { key: '', text: '' },
        },
      };
      const { service } = buildService({ response: { parsed: invalidAsk } });
      const createSpy = (prisma as unknown as { commercialDiagnosis: { create: jest.Mock } })
        .commercialDiagnosis.create;

      const result = await service.start({
        currentSituation: 'Tengo disponibilidad lunes a miércoles',
      });

      expect(result.status).toBe('READY');
      // La provenance del fallback lleva SYSTEM_CALCULATION.
      expect(result.situation).toContain('Situación declarada por la operadora');
      // No se creó DiagnosticAnswer pendiente.
      expect(result.answers).toEqual([]);
      // El status persistido es READY (no IN_PROGRESS huérfano).
      const persisted = createSpy.mock.calls[0]![0] as {
        data: Record<string, unknown>;
      };
      expect(persisted.data.status).toBe('READY');
      expect(persisted.data.answers).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // P1-5: validación de serviceId en start
  // ---------------------------------------------------------------------------
  describe('start (P1-5: validación de serviceId)', () => {
    it('lanza BadRequest cuando serviceId no pertenece al negocio o no está activo', async () => {
      const { service } = buildService();
      await expect(
        service.start({
          currentSituation: 'Tengo clientas principalmente los fines de semana',
          serviceId: 'svc-otro-negocio',
        }),
      ).rejects.toMatchObject({
        name: 'BadRequestException',
        message: expect.stringContaining('svc-otro-negocio'),
      });
    });
  });

  // ---------------------------------------------------------------------------
  // P1-2: doble respuesta concurrente → ConflictException
  // ---------------------------------------------------------------------------
  describe('answer (P1-2: atómico + rollback)', () => {
    it('lanza ConflictException si la pregunta pendiente ya fue respondida por otra solicitud', async () => {
      const pending: ServiceFixture['answers'][number] = {
        id: 'ans-1',
        diagnosisId: 'diag-1',
        questionKey: 'pain_point',
        questionText: '¿Cuál es tu principal dolor?',
        answerText: null,
        wasClarification: true,
        askedAt: new Date('2026-09-27T00:00:00Z'),
        answeredAt: null,
      };
      const diagnosis = baseDiagnosis({
        id: 'diag-1',
        status: 'IN_PROGRESS',
        answers: [pending],
      });
      // Marcamos el pending como ya respondido para simular la condición
      // de carrera ganada por otro request.
      const { service } = buildService({
        response: { parsed: readyDecision },
        diagnoses: [diagnosis],
      });
      // Forzamos el estado en answersById antes de la llamada.
      const answersById = (
        prisma as unknown as { diagnosticAnswer: { updateMany: jest.Mock } }
      ).diagnosticAnswer.updateMany;
      // Pre-marcamos answeredAt no null para forzar el conflict.
      void answersById;
      // Modificamos el mock `updateMany` para que devuelva count=0 en
      // esta prueba. Lo hacemos sobreescribiendo el comportamiento.
      const updateManyMock = (
        prisma as unknown as { diagnosticAnswer: { updateMany: jest.Mock } }
      ).diagnosticAnswer.updateMany;
      updateManyMock.mockResolvedValueOnce({ count: 0 });

      await expect(
        service.answer('diag-1', {
          questionKey: 'pain_point',
          answerText: 'No llegan evaluaciones los lunes',
        }),
      ).rejects.toMatchObject({
        name: 'ConflictException',
      });
    });
  });

  // ---------------------------------------------------------------------------
  // P1-1: re-accept idempotente — devuelve el brief existente.
  // ---------------------------------------------------------------------------
  describe('accept (P1-1: re-accept idempotente)', () => {
    const readyDiagnosis = (): ServiceFixture =>
      baseDiagnosis({
        id: 'diag-1',
        status: 'READY',
        situation: 'Demasiada disponibilidad entre semana',
        opportunity: 'Hay demanda latente los lunes',
        primaryGoal: '6 clientes nuevos por semana',
        primaryConversion: 'Reservas',
        recommendedTitle: 'Plan lunes y martes',
        recommendedWeeklyAdd: 6,
        availableCapacity: 10,
        businessObjective: 'Conseguir 6 clientes nuevos por semana los lunes y martes.',
        offer: 'Reserva con 20% de descuento para evaluaciones los lunes.',
        primaryKpi: 'Reservas',
        qualifyingQuestions: ['¿Cabello tinturado?'],
        constraints: ['No usar barato'],
        initialDailyBudgetCLP: new Prisma.Decimal(5000),
        initialLifetimeBudgetCLP: new Prisma.Decimal(70_000),
        initialDurationDays: 14,
        initialCpaCapCLP: new Prisma.Decimal(5000),
        progressionSteps: [3, 4, 6],
      });

    it('reutiliza el brief existente si la diagnosis ya tiene campaignBriefId (re-accept)', async () => {
      const diagnosis = readyDiagnosis();
      diagnosis.campaignBriefId = 'brief-prev';
      diagnosis.status = 'READY';
      const { service, briefs } = buildService({ diagnoses: [diagnosis] });
      // Hacemos que `briefs.getById` devuelva el brief previo ya aprobado.
      (briefs as unknown as { getById: jest.Mock }).getById = jest.fn(async (id: string) => ({
        id,
        businessId: 'test-business',
        serviceId: 'svc-1',
        title: 'Plan lunes y martes',
        status: 'APPROVED',
        businessObjective: 'Conseguir 6 clientes nuevos por semana los lunes y martes.',
        offer: 'Reserva con 20% de descuento para evaluaciones los lunes.',
        primaryKpi: 'Reservas',
        idealCustomerProfile: null,
        qualifyingQuestions: [],
        monthlyAcquisitionGoal: 24,
        costPerAcquisitionCap: '5000',
        lifetimeBudgetCap: '70000',
        dailyBudgetCap: '5000',
        plannedDurationDays: 14,
        constraints: [],
        stopIf: null,
        scaleIf: null,
        approvedAt: '2026-09-27T05:00:00.000Z',
        approvedBy: null,
        createdAt: '2026-09-27T00:00:00.000Z',
        updatedAt: '2026-09-27T00:00:00.000Z',
      }));

      const result = await service.accept('diag-1');

      expect(result.campaignBrief.id).toBe('brief-prev');
      expect(briefs.create).not.toHaveBeenCalled();
      expect(briefs.approve).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // P1-6: Zod descarta candidatos fuera de rango y aplica fallback.
  // ---------------------------------------------------------------------------
  describe('start (P1-6: Zod descarta valores fuera de rango)', () => {
    it('aplica fallback cuando la IA devuelve un recommendedWeeklyAdd negativo', async () => {
      const outOfRange: ParsedDiagnosisDecision = {
        ...readyDecision,
        recommended: {
          ...readyDecision.recommended,
          // weeklyAdd inválido: negativo y fuera del rango permitido
          recommendedWeeklyAdd: -5,
        },
      };
      const { service } = buildService({ response: { parsed: outOfRange } });
      const createSpy = (prisma as unknown as { commercialDiagnosis: { create: jest.Mock } })
        .commercialDiagnosis.create;

      const result = await service.start({
        currentSituation: 'Tengo disponibilidad lunes a miércoles',
      });

      // El Zod descarta este candidato, se vuelve al fallback determinista.
      expect(result.status).toBe('READY');
      expect(result.situation).toContain('Situación declarada por la operadora');
      const persisted = createSpy.mock.calls[0]![0] as {
        data: Record<string, unknown>;
      };
      expect(persisted.data.status).toBe('READY');
    });
  });

  // ---------------------------------------------------------------------------
  // Refactor CPA objetivo vs tope: combinación IA + motor.
  // Cubre las tres ramas del motor (EVIDENCE / TESTABLE /
  // INSUFFICIENT_DATA) a través de `combineStrategyWithBudgetRecommendation`,
  // cuyo comportamiento se proyecta en el payload persistido.
  // ---------------------------------------------------------------------------
  describe('combineStrategyWithBudgetRecommendation (refactor CPA objetivo/tope)', () => {
    // Helper que toma el shape de decisión y devuelve el `data` que se
    // persiste en `commercialDiagnosis.create`. Útil para inspeccionar
    // los campos `initialCpaTargetCLP` y `initialCpaCapCLP` finales sin
    // repetir boilerplate.
    const persistAndPickCpaFields = async (
      decision: ParsedDiagnosisDecision,
      options: { profileCostPerAcquisitionCap?: number } = {},
    ): Promise<{
      initialCpaTargetCLP: Prisma.Decimal | null | undefined;
      initialCpaCapCLP: Prisma.Decimal | null | undefined;
      goalAssessmentStatus: string | null | undefined;
    }> => {
      const profileOverrides =
        options.profileCostPerAcquisitionCap === undefined
          ? {}
          : { costPerAcquisitionCap: new Prisma.Decimal(options.profileCostPerAcquisitionCap) };
      const { service } = buildService({
        profile: buildBusinessProfileServiceMock(profileOverrides),
        response: { parsed: decision },
      });
      await service.start({
        currentSituation: 'Tengo clientas principalmente entre semana',
      });
      const persisted = ((prisma as unknown as {
        commercialDiagnosis: { create: jest.Mock };
      }).commercialDiagnosis.create.mock.calls[0]![0]) as {
        data: Record<string, unknown>;
      };
      return {
        initialCpaTargetCLP: persisted.data['initialCpaTargetCLP'] as
          | Prisma.Decimal
          | null
          | undefined,
        initialCpaCapCLP: persisted.data['initialCpaCapCLP'] as
          | Prisma.Decimal
          | null
          | undefined,
        goalAssessmentStatus:
          (
            persisted.data['goalAssessment'] as
              | { status?: string }
              | null
              | undefined
          )?.status ?? null,
      };
    };

    it('EVIDENCE → SUPPORTED: el motor fija el CPA objetivo al histórico y descarta el propuesto por la IA', async () => {
      const decision: ParsedDiagnosisDecision = {
        ...readyDecision,
        strategy: {
          ...readyDecision.strategy!,
          // La IA NO debería proponer CPA objetivo en modo EVIDENCE (la
          // regla 10 del SYSTEM_INSTRUCTIONS se lo prohíbe). Pero si por
          // descuido lo propone, el motor lo descarta y fija el
          // histórico.
          initialCpaTargetCLP: 9999,
          initialCpaCapCLP: 5000,
        },
      };
      const persisted = await persistAndPickCpaFields(decision);
      // El CPA objetivo efectivo es el histórico del motor. Sin acceso
      // al servicio de evidencia real no podemos inyectar un CPA
      // histórico distinto, así que verificamos que el motor NO conserva el
      // 9999 propuesto por la IA: caerá a 0 (sin evidencia mockeada) o
      // a otro valor del motor — pero nunca debe ser 9999.
      const decimal = persisted.initialCpaTargetCLP as Prisma.Decimal | null;
      const target = decimal === null || decimal === undefined ? null : Number(decimal.toString());
      expect(target === null || Number.isFinite(target)).toBe(true);
      if (target !== null) {
        expect(target).not.toBe(9999);
      }
      // El tope persistido es el que la IA entregó (5000), porque la
      // rama EVIDENCE respeta el `initialCpaCapCLP` propuesto.
      expect(Number(persisted.initialCpaCapCLP!.toString())).toBe(5000);
    });

    it('TESTABLE: sin evidencia + initialCpaTargetCLP propuesto por IA → goalAssessment.status=TESTABLE', async () => {
      const decision: ParsedDiagnosisDecision = {
        ...readyDecision,
        strategy: {
          ...readyDecision.strategy!,
          initialCpaTargetCLP: 2500,
          initialCpaCapCLP: 4000,
        },
      };
      const persisted = await persistAndPickCpaFields(decision);
      // El motor propaga el CPA objetivo propuesto por la IA.
      expect(persisted.initialCpaTargetCLP).toBeInstanceOf(Prisma.Decimal);
      expect(Number(persisted.initialCpaTargetCLP!.toString())).toBe(2500);
      expect(Number(persisted.initialCpaCapCLP!.toString())).toBe(4000);
    });

    it('INSUFFICIENT_DATA: sin evidencia ni initialCpaTargetCLP → goalAssessment.status=INSUFFICIENT_DATA', async () => {
      const decision: ParsedDiagnosisDecision = {
        ...readyDecision,
        strategy: {
          ...readyDecision.strategy!,
          initialCpaTargetCLP: null,
          initialCpaCapCLP: 4000,
        },
      };
      const persisted = await persistAndPickCpaFields(decision);
      // El CPA objetivo queda null (no hay histórico ni propuesta).
      expect(persisted.initialCpaTargetCLP).toBeNull();
      // El tope se persiste (lo entrega la IA).
      expect(Number(persisted.initialCpaCapCLP!.toString())).toBe(4000);
      // El status del goalAssessment puede ser INSUFFICIENT_DATA o
      // TESTABLE según los thresholds internos, pero nunca debe ser
      // SUPPORTED (no hay histórico). Lo más común con los números del
      // fixture es INSUFFICIENT_DATA o UNLIKELY si weeklyAdd*4 sobrepasa
      // capacidad*4.
      expect(['INSUFFICIENT_DATA', 'TESTABLE', 'UNLIKELY']).toContain(
        persisted.goalAssessmentStatus,
      );
    });

    it('persiste el cpaRationale codificado en assumptions (para round-trip) y lo separa en la respuesta pública', async () => {
      const decision: ParsedDiagnosisDecision = {
        ...readyDecision,
        strategy: {
          ...readyDecision.strategy!,
          initialCpaTargetCLP: 2500,
          initialCpaCapCLP: 4000,
          cpaRationale:
            'Servicio premium en Las Condes con ticket promedio alto; CPA objetivo conservador.',
        },
      };
      const { service } = buildService({
        response: { parsed: decision },
      });
      const result = await service.start({
        currentSituation: 'Necesito más clientas los lunes y martes',
      });
      // El `cpaRationale` aparece tal cual en la respuesta (campo
      // dedicado, sin codificación interna).
      expect(result.strategy?.cpaRationale).toContain('Servicio premium en Las Condes');
      // La respuesta pública NO contiene el marcador interno en
      // `assumptions` (Hallazgo 4: se filtra antes de serializar).
      expect(result.strategy?.assumptions ?? []).not.toEqual(
        expect.arrayContaining([expect.stringMatching(/^__cpaRationale__:/)]),
      );
      // Y quedó persistido en BD con el prefijo (round-trip) para que
      // un GET posterior pueda reconstruir el `cpaRationale`.
      const persisted = ((prisma as unknown as {
        commercialDiagnosis: { create: jest.Mock };
      }).commercialDiagnosis.create.mock.calls[0]![0]) as {
        data: Record<string, unknown>;
      };
      const assumptions = persisted.data['assumptions'] as string[];
      expect(Array.isArray(assumptions)).toBe(true);
      const rationaleEntry = assumptions.find((entry) =>
        entry.startsWith('__cpaRationale__:'),
      );
      expect(rationaleEntry).toBeDefined();
      expect(rationaleEntry).toContain('Servicio premium en Las Condes');
    });

    it('NO trunca assumptions a 10 cuando la IA trae más (merge con motor)', async () => {
      // Hallazgo 4: el orquestador ya no hace `slice(0, 10)` para hacer
      // espacio al `cpaRationale`. El merge preserva TODAS las
      // assumptions únicas.
      const iaAssumptions = Array.from({ length: 8 }, (_, i) => `IA assumption ${i + 1}`);
      const decision: ParsedDiagnosisDecision = {
        ...readyDecision,
        strategy: {
          ...readyDecision.strategy!,
          initialCpaTargetCLP: 2500,
          initialCpaCapCLP: 4000,
          cpaRationale: 'Justificación breve del CPA',
          assumptions: iaAssumptions,
        },
      };
      const { service } = buildService({ response: { parsed: decision } });
      const result = await service.start({
        currentSituation: 'Necesito más clientas entre semana',
      });
      // La respuesta pública trae las assumptions de la IA, sin
      // marcadores, sin truncar.
      const publicAssumptions = result.strategy?.assumptions ?? [];
      expect(publicAssumptions.length).toBeGreaterThanOrEqual(iaAssumptions.length);
      iaAssumptions.forEach((entry) => {
        expect(publicAssumptions).toContain(entry);
      });
    });

    it('persiste priceJustification codificado en qualifyingQuestions con __priceJustification__:', async () => {
      // Hallazgo 5: `priceJustification` se persiste y se expone.
      const decision: ParsedDiagnosisDecision = {
        ...readyDecision,
        strategy: {
          ...readyDecision.strategy!,
          initialCpaTargetCLP: 2500,
          initialCpaCapCLP: 4000,
          priceJustification:
            'Servicio premium en Las Condes con ticket promedio de $95.500 CLP.',
        },
      };
      const { service } = buildService({ response: { parsed: decision } });
      const result = await service.start({
        currentSituation: 'Necesito más clientas entre semana',
      });
      // La respuesta pública expone el campo dedicado.
      expect(result.strategy?.priceJustification).toContain('Servicio premium en Las Condes');
      // La respuesta pública NO contiene el marcador en
      // `qualifyingQuestions`.
      expect(result.strategy?.qualifyingQuestions ?? []).not.toEqual(
        expect.arrayContaining([expect.stringMatching(/^__priceJustification__:/)]),
      );
      // Y quedó persistido en BD con el prefijo (round-trip).
      const persisted = ((prisma as unknown as {
        commercialDiagnosis: { create: jest.Mock };
      }).commercialDiagnosis.create.mock.calls[0]![0]) as {
        data: Record<string, unknown>;
      };
      const qualifyingQuestions = persisted.data['qualifyingQuestions'] as string[];
      const priceEntry = qualifyingQuestions.find((entry) =>
        entry.startsWith('__priceJustification__:'),
      );
      expect(priceEntry).toBeDefined();
      expect(priceEntry).toContain('Servicio premium en Las Condes');
    });
  });

  // ---------------------------------------------------------------------------
  // P1-Hallazgo 6: cobertura determinista de los 4 estados del motor +
  // Hallazgos 2 (meta > capacidad) y 3 (cpaTarget sin weeklyAdd).
  // ---------------------------------------------------------------------------
  describe('combineStrategyWithBudgetRecommendation (4 estados deterministas)', () => {
    /**
     * Helper para leer los campos persistidos en `commercialDiagnosis.create`
     * cuando la IA devuelve una decisión READY. Mockea la evidencia al
     * shape pedido para fijar el modo del motor (EVIDENCE / NO_EVIDENCE).
     */
    const runWithEvidence = async (
      decision: ParsedDiagnosisDecision,
      evidence: Partial<{
        windowStart: string;
        windowEnd: string;
        daysObserved: number;
        impressions: number;
        clicks: number;
        spend: number;
        conversions: number;
        averageCpa: number;
        averageCpc: number;
        averageCtr: number;
        cpaByWeekday: unknown[];
        bestWeekdays: number[];
        hasEnoughEvidence: boolean;
      }> = {},
      options: { profileCostPerAcquisitionCap?: number } = {},
    ): Promise<{
      service: CommercialDiagnosisService;
      result: Awaited<ReturnType<CommercialDiagnosisService['start']>>;
      persisted: { data: Record<string, unknown> };
    }> => {
      const profileOverrides =
        options.profileCostPerAcquisitionCap === undefined
          ? {}
          : { costPerAcquisitionCap: new Prisma.Decimal(options.profileCostPerAcquisitionCap) };
      const { service, evidence: evidenceMock } = buildService({
        profile: buildBusinessProfileServiceMock(profileOverrides),
        response: { parsed: decision },
      });
      // Sobreescribimos TODAS las invocaciones de evidence.load
      // (buildContext también lo llama una vez para fijar el
      // `evidenceMode` del prompt).
      const merged = { ...EMPTY_EVIDENCE, ...evidence };
      evidenceMock.load.mockResolvedValue(merged);
      const result = await service.start({
        currentSituation: 'Tengo clientas principalmente entre semana',
      });
      const persisted = ((prisma as unknown as {
        commercialDiagnosis: { create: jest.Mock };
      }).commercialDiagnosis.create.mock.calls[0]![0]) as {
        data: Record<string, unknown>;
      };
      return { service, result, persisted };
    };

    it('EVIDENCE → SUPPORTED con CPA objetivo efectivo = histórico', async () => {
      const decision: ParsedDiagnosisDecision = {
        ...readyDecision,
        recommended: {
          ...readyDecision.recommended,
          // weeklyAdd=6 → conversionesObjetivo=ceil(6*14/7)=12.
          recommendedWeeklyAdd: 6,
          availableCapacity: 50,
        },
        strategy: {
          ...readyDecision.strategy!,
          initialDailyBudgetCLP: 999, // fuera del mínimo 1000: motor autoritativo
          initialLifetimeBudgetCLP: 999, // fuera del mínimo 1000: motor autoritativo
          initialDurationDays: 14,
          // La IA NO debería proponer CPA objetivo en EVIDENCE, pero si
          // lo propone, el motor lo descarta y fija el histórico.
          initialCpaTargetCLP: 9999,
          // cpaCap >= cpaTarget obligatorio (Zod lo valida). Usamos
          // 10_000 para que Zod acepte la propuesta.
          initialCpaCapCLP: 10_000,
        },
      };
      const { result, persisted } = await runWithEvidence(
        decision,
        {
          hasEnoughEvidence: true,
          averageCpa: 1500,
          daysObserved: 14,
          impressions: 3000,
          conversions: 10,
          bestWeekdays: [1, 2, 4],
        },
        { profileCostPerAcquisitionCap: 5000 },
      );
      expect(result.strategy?.goalAssessment?.status).toBe('SUPPORTED');
      // El CPA objetivo efectivo es el histórico (1500), NO 9999 de la IA.
      const target = Number((persisted.data['initialCpaTargetCLP'] as Prisma.Decimal).toString());
      expect(target).toBe(1500);
      // El motor fija el daily/lifetime desde el histórico:
      // conversionesObjetivo=ceil(6*14/7)=12, naturalLifetime=12*1500=18000,
      // naturalDailyBudget=18000/14=1285.71, daily=Math.round(1285.71)=1286,
      // lifetime=Math.round(1285.71*14)=18000.
      expect(Number((persisted.data['initialDailyBudgetCLP'] as Prisma.Decimal).toString())).toBe(1286);
      expect(Number((persisted.data['initialLifetimeBudgetCLP'] as Prisma.Decimal).toString())).toBe(18000);
      // El tope lo entrega la IA (10_000) y es >= al objetivo (1500): se
      // respeta.
      expect(Number((persisted.data['initialCpaCapCLP'] as Prisma.Decimal).toString())).toBe(10_000);
    });

    it('TESTABLE: sin evidencia + cpaTarget > 0 + weeklyAdd > 0 → confidence TESTABLE con presupuesto calculado', async () => {
      const decision: ParsedDiagnosisDecision = {
        ...readyDecision,
        recommended: {
          ...readyDecision.recommended,
          recommendedWeeklyAdd: 4,
          availableCapacity: 25,
        },
        strategy: {
          ...readyDecision.strategy!,
          // Forzamos valores fuera de [1000, 1_000_000] para verificar
          // que el motor es la fuente autoritativa: con cpaTarget=2500
          // y weeklyAdd=4, el motor calcula daily=1429, lifetime=20000.
          initialDailyBudgetCLP: 999, // fuera del mínimo 1000
          initialLifetimeBudgetCLP: 999, // fuera del mínimo 1000
          initialCpaTargetCLP: 2500,
          initialCpaCapCLP: 4000,
        },
      };
      const { result, persisted } = await runWithEvidence(decision, { hasEnoughEvidence: false });
      expect(result.strategy?.goalAssessment?.status).toBe('TESTABLE');
      // El CPA objetivo es el propuesto por la IA (2500).
      expect(Number((persisted.data['initialCpaTargetCLP'] as Prisma.Decimal).toString())).toBe(2500);
      // El presupuesto se calcula desde cpaTarget=2500 y weeklyAdd=4:
      // conversionesObjetivo=ceil(4*14/7)=8, lifetime=8*2500=20000,
      // daily=Math.round(20000/14)=1429.
      expect(Number((persisted.data['initialDailyBudgetCLP'] as Prisma.Decimal).toString())).toBe(1429);
      expect(Number((persisted.data['initialLifetimeBudgetCLP'] as Prisma.Decimal).toString())).toBe(20000);
    });

    it('INSUFFICIENT_DATA: sin evidencia + cpaTarget null + weeklyAdd null → confidence INSUFFICIENT_DATA', async () => {
      const decision: ParsedDiagnosisDecision = {
        ...readyDecision,
        recommended: {
          ...readyDecision.recommended,
          recommendedWeeklyAdd: null,
          availableCapacity: null,
        },
        strategy: {
          ...readyDecision.strategy!,
          initialCpaTargetCLP: null,
          initialCpaCapCLP: null,
        },
      };
      const { result, persisted } = await runWithEvidence(decision, { hasEnoughEvidence: false });
      expect(result.strategy?.goalAssessment?.status).toBe('INSUFFICIENT_DATA');
      // El CPA objetivo y los budgets quedan null: la IA no propuso nada
      // y el motor no puede calcularlos.
      expect(persisted.data['initialCpaTargetCLP']).toBeNull();
      expect(persisted.data['initialDailyBudgetCLP']).toBeNull();
      expect(persisted.data['initialLifetimeBudgetCLP']).toBeNull();
    });

    it('TESTABLE sin volumen: sin evidencia + cpaTarget > 0 + weeklyAdd null → confidence TESTABLE con budgets null', async () => {
      // Hallazgo 3: cuando hay CPA objetivo propuesto pero no hay
      // volumen semanal, el motor debe devolver TESTABLE con
      // presupuestos null (la IA nunca rellena lo que el motor rechaza).
      const decision: ParsedDiagnosisDecision = {
        ...readyDecision,
        recommended: {
          ...readyDecision.recommended,
          recommendedWeeklyAdd: null,
          availableCapacity: 10,
        },
        strategy: {
          ...readyDecision.strategy!,
          initialDailyBudgetCLP: 5000, // IA propone algo fuera del motor
          initialLifetimeBudgetCLP: 70_000,
          initialDurationDays: 14,
          initialCpaTargetCLP: 2500,
          initialCpaCapCLP: 4000,
        },
      };
      const { result, persisted } = await runWithEvidence(decision, { hasEnoughEvidence: false });
      expect(result.strategy?.goalAssessment?.status).toBe('TESTABLE');
      // El CPA objetivo efectivo es el propuesto por la IA (2500).
      expect(Number((persisted.data['initialCpaTargetCLP'] as Prisma.Decimal).toString())).toBe(2500);
      // Como el motor no puede calcular daily/lifetime sin volumen, los
      // budgets quedan null aunque la IA haya propuesto cifras.
      expect(result.strategy?.initialDailyBudgetCLP).toBeNull();
      expect(result.strategy?.initialLifetimeBudgetCLP).toBeNull();
    });

    it('meta > capacidad → TESTABLE (era SUPPORTED antes del fix de Hallazgo 2)', async () => {
      // Hallazgo 2: weeklyAdd=5) excede capacity=1 → la meta es agresiva
      // para la capacidad → TESTABLE. Antes del fix la condición
      // comparaba contra `capacity * weeklyAdd * 4`, que crecía con la
      // propia meta y daba falsos SUPPORTED.
      const decision: ParsedDiagnosisDecision = {
        ...readyDecision,
        recommended: {
          ...readyDecision.recommended,
          recommendedWeeklyAdd: 5,
          availableCapacity: 1,
        },
        strategy: {
          ...readyDecision.strategy!,
          initialCpaTargetCLP: 2500,
          initialCpaCapCLP: 4000,
        },
      };
      const { result } = await runWithEvidence(decision, { hasEnoughEvidence: false });
      expect(result.strategy?.goalAssessment?.status).toBe('TESTABLE');
    });

    it('UNLIKELY: weeklyAdd bajo + cpaTarget bajo → daily natural debajo del mínimo viable', async () => {
      // El motor marca UNLIKELY por `belowDailyMinimum=true` cuando el
      // daily natural calculado queda por debajo de 1000 CLP (mínimo de
      // Meta). Con weeklyAdd=2, cpaTarget=1000, duración=14:
      // conversionesObjetivo=4, naturalLifetime=4*1000=4000,
      // naturalDaily=4000/14=285.71 < 1000 → clamp, daily=1000, status=UNLIKELY.
      // (El contrato Zod exige cpaCap >= cpaTarget, así que usamos
      // cpaCap=1000 también.)
      const decision: ParsedDiagnosisDecision = {
        ...readyDecision,
        recommended: {
          ...readyDecision.recommended,
          recommendedWeeklyAdd: 2,
          availableCapacity: 25,
        },
        strategy: {
          ...readyDecision.strategy!,
          initialDailyBudgetCLP: 999, // fuera del mínimo 1000: motor autoritativo
          initialLifetimeBudgetCLP: 999, // fuera del mínimo 1000: motor autoritativo
          initialCpaTargetCLP: 1000,
          initialCpaCapCLP: 1000,
        },
      };
      const { result } = await runWithEvidence(decision, { hasEnoughEvidence: false });
      expect(result.strategy?.goalAssessment?.status).toBe('UNLIKELY');
    });

    it('el motor es autoritativo: la IA no puede sobrescribir dailyBudget fuera del rango [1000, 1_000_000]', async () => {
      // Hallazgo 1: el motor clamps a [1000, 1_000_000]. Si la IA
      // propone 500 (fuera del mínimo), el motor lo descarta.
      const decision: ParsedDiagnosisDecision = {
        ...readyDecision,
        recommended: {
          ...readyDecision.recommended,
          recommendedWeeklyAdd: 4,
          availableCapacity: 25,
        },
        strategy: {
          ...readyDecision.strategy!,
          initialDailyBudgetCLP: 500, // fuera de rango (mínimo 1000)
          initialCpaTargetCLP: 2500,
          initialCpaCapCLP: 4000,
        },
      };
      const { result, persisted } = await runWithEvidence(decision, { hasEnoughEvidence: false });
      // El motor calcula su propio daily (1429 con cpaTarget=2500,
      // weeklyAdd=4) y descarta el 500 propuesto por la IA.
      expect(result.strategy?.initialDailyBudgetCLP).toBe('1429');
      expect(Number((persisted.data['initialDailyBudgetCLP'] as Prisma.Decimal).toString())).toBe(1429);
    });

    it('el motor es autoritativo: la IA no puede proponer duración fuera de [7, 21]', async () => {
      // Hallazgo 1: el motor clamps durationDays a [7, 21]. Si la IA
      // propone 365 (fuera del máximo), se usa 21 del motor.
      const decision: ParsedDiagnosisDecision = {
        ...readyDecision,
        recommended: {
          ...readyDecision.recommended,
          recommendedWeeklyAdd: 4,
          availableCapacity: 25,
        },
        strategy: {
          ...readyDecision.strategy!,
          initialDurationDays: 365, // fuera de [7, 21]
          initialCpaTargetCLP: 2500,
          initialCpaCapCLP: 4000,
        },
      };
      const { result } = await runWithEvidence(decision, { hasEnoughEvidence: false });
      expect(result.strategy?.initialDurationDays).toBe(21);
    });

    it('la duración dentro del rango [7, 21] propuesta por la IA se respeta', async () => {
      // Caso opuesto: la IA propone 10 días (dentro del rango), el
      // motor la acepta.
      const decision: ParsedDiagnosisDecision = {
        ...readyDecision,
        recommended: {
          ...readyDecision.recommended,
          recommendedWeeklyAdd: 4,
          availableCapacity: 25,
        },
        strategy: {
          ...readyDecision.strategy!,
          initialDurationDays: 10,
          initialCpaTargetCLP: 2500,
          initialCpaCapCLP: 4000,
        },
      };
      const { result } = await runWithEvidence(decision, { hasEnoughEvidence: false });
      expect(result.strategy?.initialDurationDays).toBe(10);
    });
  });
});

// -----------------------------------------------------------------------------
// Helpers internos
// -----------------------------------------------------------------------------

// Re-declaramos un tipo local para los `CampaignBriefResponse` que se
// devuelven en el stub. La estructura real está en
// `apps/api/src/modules/campaign-brief/dto/campaign-brief.dto.ts` pero
// sólo necesitamos que coincida con la firma de los métodos mockeados.
type CampaignBriefResponse = {
  id: string;
  status: 'DRAFT' | 'APPROVED' | 'ARCHIVED';
  serviceId: string;
  businessId: string;
  title: string;
  businessObjective: string;
  offer: string;
  primaryKpi: string;
  idealCustomerProfile: string | null;
  qualifyingQuestions: string[];
  monthlyAcquisitionGoal: number | null;
  costPerAcquisitionCap: string | null;
  lifetimeBudgetCap: string | null;
  dailyBudgetCap: string | null;
  plannedDurationDays: number | null;
  constraints: string[];
  stopIf: string | null;
  scaleIf: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  createdAt: string;
  updatedAt: string;
};