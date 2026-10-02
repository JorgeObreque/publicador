import './setup';
import request from 'supertest';
import { Test, type TestingModule } from '@nestjs/testing';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { prisma } from '@publicador/database';
import { AppModule } from '../src/app.module';
import { OPENAI_CLIENT } from '../src/modules/analyze/analyze.tokens';
import { BUSINESS_PROFILE_SERVICE } from '../src/modules/business-profile/business-profile.tokens';
import type {
  OpenAISummaryPrompt,
  OpenAISummaryResult,
  OpenAISummarizer,
} from '../src/modules/analyze/openai.client';

/**
 * Smoke E2E manual para los hallazgos de la revisión CPA contextual.
 *
 * Cubre los escenarios del enunciado:
 *   - Sin evidencia + cpaTarget=2500 → goalAssessment.status=TESTABLE,
 *     initialCpaTargetCLP=2500, initialCpaCapCLP>2500, cpaRationale
 *     poblado, dailyBudget coherente, sin `__cpaRationale__:` en
 *     assumptions.
 *   - Sin evidencia con meta > capacidad → goalAssessment.status=TESTABLE
 *     (no SUPPORTED).
 *
 * Las verificaciones que el módulo no expone (presencia interna del
 * marcador en BD) se inspeccionan directamente sobre la fila persistida.
 */

const BUSINESS_ID = process.env.BUSINESS_ID ?? 'test-business';
const API_PREFIX = process.env.API_PREFIX ?? 'api/v1';

interface MockOverrides {
  configured?: boolean;
  response?: OpenAISummaryResult;
  error?: Error;
}

const baseReadyDecision = (overrides: Record<string, unknown> = {}) => ({
  decision: 'READY' as const,
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
    // daily/lifetime fuera del rango [1000, 1_000_000] para que el
    // motor sea autoritativo (IA override rechazado).
    initialDailyBudgetCLP: 999,
    initialLifetimeBudgetCLP: 999,
    initialDurationDays: 14,
    initialCpaTargetCLP: 2500,
    initialCpaCapCLP: 4000,
    cpaRationale:
      'Servicio premium en Las Condes; CPA objetivo conservador según ticket promedio y meta semanal.',
    priceJustification:
      'Servicio premium en Las Condes con ticket promedio de $95.500 CLP.',
    progressionSteps: [3, 4, 6],
    ...overrides,
  },
  ...overrides,
});

const createMockClient = (overrides: MockOverrides = {}) => {
  const configured = overrides.configured ?? true;
  const error = overrides.error ?? null;
  const response = overrides.response ?? {
    parsed: baseReadyDecision({}) as never,
    raw: {} as never,
    usage: { promptTokens: 220, completionTokens: 110, totalTokens: 330, model: 'gpt-4o-mini' },
  };
  const summarize = jest.fn(
    async (
      _input: unknown,
      _prompts: OpenAISummaryPrompt,
    ): Promise<OpenAISummaryResult> => {
      if (error) throw error;
      return response;
    },
  );

  const client: OpenAISummarizer & { summarize: jest.Mock } = {
    isConfigured: jest.fn(() => configured),
    getModel: jest.fn(() => 'gpt-4o-mini'),
    summarize,
  };
  return client;
};

const buildApp = async (
  overrides: MockOverrides = {},
): Promise<{ app: INestApplication; client: ReturnType<typeof createMockClient> }> => {
  const client = createMockClient(overrides);
  const businessProfileServiceMock = {
    getOrCreate: jest.fn(async () => ({
      id: 'profile-test',
      businessId: BUSINESS_ID,
      addressLine: 'Av. Apoquindo 4501',
      neighborhood: 'Las Condes',
      regionCutCode: '13',
      communeCutCode: '13114',
      regionName: 'Región Metropolitana de Santiago',
      communeName: 'Las Condes',
      countryCode: 'CL',
      city: 'Santiago',
      country: 'Chile',
      brandVoiceKeywords: ['profesional'],
      wordsToAvoid: ['barato'],
      preferredEmojiSemantics: [],
      primaryCustomerProfile: 'Mujer 30-45 que busca balayage natural',
      commonObjections: [],
      qualifyingQuestions: ['¿Cabello tinturado?'],
      weeklyServiceCapacity: 10,
      monthlyAcquisitionGoal: 20,
      monthlyRevenueTarget: null,
      costPerAcquisitionCap: 5000,
      tagline: 'Tu pelo, nuestras manos',
      differentiators: [],
      nearbyCommunesCutCodes: [],
      profileCompletedAt: new Date('2026-09-27T00:00:00Z'),
    })),
    upsert: jest.fn(),
    markCompleted: jest.fn(),
    isReady: jest.fn(() => true),
    getDisplayLocation: jest.fn(() => 'Las Condes, Región Metropolitana de Santiago'),
    getBusinessContext: jest.fn(() => ({
      regionName: 'Región Metropolitana de Santiago',
      communeName: 'Las Condes',
      regionCutCode: '13',
      communeCutCode: '13114',
      context: null,
      neighbors: [],
    })),
  };
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(OPENAI_CLIENT)
    .useValue(client)
    .overrideProvider(BUSINESS_PROFILE_SERVICE)
    .useValue(businessProfileServiceMock)
    .compile();
  const app = moduleRef.createNestApplication({ logger: ['error', 'warn'] });
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableShutdownHooks();
  await app.init();
  return { app, client };
};

async function createServiceFor(
  businessId: string,
  name = 'Balayage',
): Promise<{ id: string; name: string }> {
  return prisma.service.create({
    data: {
      businessId,
      name,
      price: 95_500,
      currency: 'CLP',
      duration: 120,
      isActive: true,
    },
  });
}

const validStart = (serviceId: string) => ({
  currentSituation:
    'Tengo clientas principalmente jueves a domingo; lunes a miércoles tengo bastante disponibilidad.',
  serviceId,
});

describe('SMOKE: correcciones CPA contextual', () => {
  it('Escenario 1: sin evidencia + cpaTarget=2500 → goalAssessment.status=TESTABLE + cpaRationale poblado + daily coherente + sin marcador en assumptions', async () => {
    // Sin datos históricos: limpiamos AdMetricDaily / Conversion.
    await prisma.adMetricDaily.deleteMany({ where: { businessId: BUSINESS_ID } });
    await prisma.conversion.deleteMany({ where: { businessId: BUSINESS_ID } });

    const { app, client } = await buildApp({
      response: {
        parsed: baseReadyDecision() as never,
        raw: {} as never,
        usage: { promptTokens: 220, completionTokens: 110, totalTokens: 330, model: 'gpt-4o-mini' },
      },
    });
    try {
      const service = await createServiceFor(BUSINESS_ID);
      const res = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/commercial-diagnoses`)
        .send(validStart(service.id))
        .expect(201);
      const body = res.body as {
        status: string;
        strategy?: {
          initialDailyBudgetCLP: string | null;
          initialLifetimeBudgetCLP: string | null;
          initialCpaTargetCLP: string | null;
          initialCpaCapCLP: string | null;
          initialDurationDays: number;
          cpaRationale: string | null;
          priceJustification: string | null;
          assumptions: string[];
          goalAssessment: { status: string; explanation: string; disclaimer: string } | null;
        };
      };

      console.log('SMOKE ESCENARIO 1 — Body completo:');
      console.log(JSON.stringify(body, null, 2));

      expect(body.status).toBe('READY');
      // Hallazgo 3: TESTABLE (no INSUFFICIENT_DATA) aunque no haya
      // evidencia histórica, porque la IA propuso cpaTarget>0.
      expect(body.strategy?.goalAssessment?.status).toBe('TESTABLE');
      // cpa objetivo efectivo es el propuesto (2500).
      expect(body.strategy?.initialCpaTargetCLP).toBe('2500');
      // cpaCap es mayor al objetivo (4000 > 2500).
      expect(Number(body.strategy?.initialCpaCapCLP)).toBeGreaterThan(2500);
      // cpaRationale poblado, viene del campo dedicado.
      expect(body.strategy?.cpaRationale).toContain('Servicio premium en Las Condes');
      // priceJustification también expuesto (Hallazgo 5).
      expect(body.strategy?.priceJustification).toContain('Servicio premium en Las Condes');
      // Sin marcador `__cpaRationale__:` en assumptions públicas.
      const publicAssumptions = body.strategy?.assumptions ?? [];
      expect(publicAssumptions).not.toEqual(
        expect.arrayContaining([expect.stringMatching(/^__cpaRationale__:/)]),
      );
      // dailyBudget coherente con cpaTarget + meta semanal.
      // weeklyAdd=6, cpaTarget=2500, duración=14:
      // conversionesObjetivo=ceil(6*14/7)=12, lifetime=12*2500=30000,
      // daily=Math.round(30000/14)=2143.
      expect(body.strategy?.initialDailyBudgetCLP).toBe('2143');
      expect(body.strategy?.initialLifetimeBudgetCLP).toBe('30000');

      // Verificación interna: la BD SÍ contiene el marker (round-trip
      // persistence), pero está oculto de la respuesta pública.
      const record = await prisma.commercialDiagnosis.findUnique({
        where: { id: body.id ?? undefined } as never,
      });
      void record;
      const recordById = await prisma.commercialDiagnosis.findFirst({
        where: { serviceId: service.id, status: 'READY' as never },
        orderBy: { createdAt: 'desc' },
      });
      const storedAssumptions = (recordById?.assumptions ?? []) as string[];
      expect(storedAssumptions.find((entry) => entry.startsWith('__cpaRationale__:')))
        .toBeDefined();
      const storedQualifyingQuestions = (recordById?.qualifyingQuestions ?? []) as string[];
      expect(storedQualifyingQuestions.find((entry) => entry.startsWith('__priceJustification__:')))
        .toBeDefined();

      // El cliente OpenAI fue invocado con prompts que incluyen el
      // precio del servicio principal (Hallazgo 8).
      const lastPrompts = client.summarize.mock.calls[0]?.[1] as
        | { userPrompt: string; systemPrompt: string }
        | undefined;
      expect(lastPrompts?.userPrompt).toContain('Precio del servicio principal: $95.500 CLP.');
      // Siglas expandidas en el system prompt (Hallazgo 7).
      expect(lastPrompts?.systemPrompt).not.toContain('CPL, KPIs');
      expect(lastPrompts?.systemPrompt).toMatch(
        /Costo por lead \(CPL\), Indicadores clave de rendimiento \(KPI\)/,
      );
    } finally {
      await app.close();
    }
  });

  it('Escenario 2: sin evidencia con meta > capacidad → goalAssessment.status=TESTABLE (no SUPPORTED)', async () => {
    // Limpiamos evidencia para garantizar NO_EVIDENCE.
    await prisma.adMetricDaily.deleteMany({ where: { businessId: BUSINESS_ID } });
    await prisma.conversion.deleteMany({ where: { businessId: BUSINESS_ID } });

    // Hallazgo 2: meta semanal 5 vs capacidad 1 → TESTABLE.
    // El bug original daba SUPPORTED por la multiplicación `cap * weekly * 4`.
    const decision = baseReadyDecision({
      recommended: {
        situation: 'Demasiada disponibilidad entre semana',
        opportunity: 'Hay demanda latente los lunes',
        primaryGoal: '5 clientes nuevos por semana',
        primaryConversion: 'Reservas',
        recommendedTitle: 'Plan lunes y martes',
        recommendedWeeklyAdd: 5,
        availableCapacity: 1, // meta excede capacidad
        pendingQuestion: null,
      },
      strategy: {
        ...baseReadyDecision().strategy,
        initialCpaTargetCLP: 2500,
        initialCpaCapCLP: 4000,
      },
    });

    const { app } = await buildApp({
      response: {
        parsed: decision as never,
        raw: {} as never,
        usage: { promptTokens: 220, completionTokens: 110, totalTokens: 330, model: 'gpt-4o-mini' },
      },
    });
    try {
      const service = await createServiceFor(BUSINESS_ID);
      const res = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/commercial-diagnoses`)
        .send(validStart(service.id))
        .expect(201);
      const body = res.body as {
        status: string;
        strategy?: {
          goalAssessment: { status: string; explanation: string } | null;
          initialDailyBudgetCLP: string | null;
          initialLifetimeBudgetCLP: string | null;
          initialCpaTargetCLP: string | null;
          initialDurationDays: number;
        };
      };

      console.log('SMOKE ESCENARIO 2 — Body:');
      console.log(JSON.stringify(body, null, 2));

      expect(body.status).toBe('READY');
      // Hallazgo 2: la meta excede la capacidad → TESTABLE (no
      // SUPPORTED, no UNLIKELY).
      expect(body.strategy?.goalAssessment?.status).toBe('TESTABLE');
      expect(body.strategy?.goalAssessment?.status).not.toBe('SUPPORTED');
    } finally {
      await app.close();
    }
  });
});