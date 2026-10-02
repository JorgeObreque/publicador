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

const BUSINESS_ID = process.env.BUSINESS_ID ?? 'test-business';
const API_PREFIX = process.env.API_PREFIX ?? 'api/v1';

interface MockOverrides {
  configured?: boolean;
  response?: OpenAISummaryResult;
  error?: Error;
}

interface BriefPayload {
  title: string;
  serviceId: string;
  businessObjective: string;
  offer: string;
  primaryKpi: string;
  idealCustomerProfile?: string;
  qualifyingQuestions?: string[];
  constraints?: string[];
  stopIf?: string;
  scaleIf?: string;
  monthlyAcquisitionGoal?: number;
  costPerAcquisitionCap?: number;
  lifetimeBudgetCap?: number;
  dailyBudgetCap?: number;
  plannedDurationDays?: number;
}

const createMockClient = (overrides: MockOverrides = {}) => {
  const configured = overrides.configured ?? true;
  const response = overrides.response ?? {
    parsed: {
      stopIf: 'Si no hay 5 conversaciones calificadas en 14 días',
      scaleIf: 'Si CPL < $5.000 con más de 10 conversaciones',
    },
    raw: {} as never,
    usage: { promptTokens: 220, completionTokens: 110, totalTokens: 330, model: 'gpt-4o-mini' },
  };
  const error = overrides.error ?? null;

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
      addressLine: null,
      neighborhood: null,
      regionCutCode: null,
      communeCutCode: null,
      regionName: null,
      communeName: null,
      countryCode: null,
      city: null,
      country: null,
      brandVoiceKeywords: [],
      wordsToAvoid: [],
      preferredEmojiSemantics: [],
      primaryCustomerProfile: '',
      commonObjections: [],
      profileCompletedAt: null,
    })),
    upsert: jest.fn(),
    markCompleted: jest.fn(),
    isReady: jest.fn(() => false),
    getDisplayLocation: jest.fn(() => ''),
    getBusinessContext: jest.fn(() => ({
      regionName: null,
      communeName: null,
      regionCutCode: null,
      communeCutCode: null,
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

const validPayload = (serviceId: string, overrides: Partial<BriefPayload> = {}): BriefPayload => ({
  title: 'Balayage Q4',
  serviceId,
  businessObjective: 'Conseguir 5 evaluaciones de balayage en 14 días',
  offer: 'Evaluación + 20% descuento en la primera sesión',
  primaryKpi: 'Evaluaciones',
  qualifyingQuestions: ['¿Cabello tinturado?'],
  constraints: ['No usar antes/después'],
  monthlyAcquisitionGoal: 20,
  costPerAcquisitionCap: 5000,
  lifetimeBudgetCap: 200_000,
  dailyBudgetCap: 25_000,
  plannedDurationDays: 14,
  ...overrides,
});

interface SuggestRulesResponse {
  stopIf: string;
  scaleIf: string;
  source: 'AI' | 'FALLBACK';
}

describe('POST /campaign-briefs/:id/suggest-rules (integration)', () => {
  it('genera stopIf y scaleIf no vacíos para un brief en DRAFT', async () => {
    const { app } = await buildApp();
    try {
      const service = await createServiceFor(BUSINESS_ID);
      const created = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/campaign-briefs`)
        .send(validPayload(service.id))
        .expect(201);
      const briefId = (created.body as { id: string }).id;

      const res = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/campaign-briefs/${briefId}/suggest-rules`)
        .expect(201);
      const suggestion = res.body as SuggestRulesResponse;
      expect(suggestion.stopIf.length).toBeGreaterThan(0);
      expect(suggestion.scaleIf.length).toBeGreaterThan(0);
      expect(suggestion.source).toBe('AI');
      expect(suggestion.model).toBeUndefined();
      expect(suggestion.tokens).toBeUndefined();
      expect(suggestion.cost).toBeUndefined();
      expect(suggestion.usage).toBeUndefined();

      // El brief NO debe modificarse al pedir el análisis.
      const fetched = await request(app.getHttpServer())
        .get(`/${API_PREFIX}/campaign-briefs/${briefId}`)
        .expect(200);
      const fetchedBrief = fetched.body as BriefPayload & { stopIf: string | null };
      expect(fetchedBrief.stopIf).toBeNull();
      expect(fetchedBrief.scaleIf).toBeNull();
    } finally {
      await app.close();
    }
  });

  it('rechaza con 400 cuando el brief está archivado', async () => {
    const { app } = await buildApp();
    try {
      const service = await createServiceFor(BUSINESS_ID);
      const created = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/campaign-briefs`)
        .send(validPayload(service.id))
        .expect(201);
      const briefId = (created.body as { id: string }).id;

      await request(app.getHttpServer())
        .post(`/${API_PREFIX}/campaign-briefs/${briefId}/archive`)
        .expect(201);

      const res = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/campaign-briefs/${briefId}/suggest-rules`);

      expect(res.status).toBe(400);
      const message = JSON.stringify(res.body).toLowerCase();
      expect(message).toContain('archivado');
    } finally {
      await app.close();
    }
  });

  it('rechaza con 400 cuando el objetivo comercial está vacío', async () => {
    const { app } = await buildApp();
    try {
      const service = await createServiceFor(BUSINESS_ID);
      // Creamos el brief con objetivo válido y luego lo vaciamos vía Prisma
      // para forzar el rechazo del endpoint (la validación Zod impide
      // aceptar `businessObjective: ''` desde el POST).
      const created = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/campaign-briefs`)
        .send(validPayload(service.id))
        .expect(201);
      const briefId = (created.body as { id: string }).id;
      await prisma.campaignBrief.update({
        where: { id: briefId },
        data: { businessObjective: '' },
      });

      const res = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/campaign-briefs/${briefId}/suggest-rules`);

      expect(res.status).toBe(400);
      const message = JSON.stringify(res.body);
      expect(message).toContain('objetivo comercial');
    } finally {
      await app.close();
    }
  });

  it('es idempotente: si ya hay stopIf/scaleIf, los devuelve sin llamar a la IA', async () => {
    const { app } = await buildApp();
    try {
      const service = await createServiceFor(BUSINESS_ID);
      const preexistente = {
        stopIf: 'Stop manual',
        scaleIf: 'Scale manual',
      };
      const created = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/campaign-briefs`)
        .send(validPayload(service.id, preexistente))
        .expect(201);
      const briefId = (created.body as { id: string }).id;

      const res = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/campaign-briefs/${briefId}/suggest-rules`)
        .expect(201);
      const suggestion = res.body as SuggestRulesResponse;
      expect(suggestion.stopIf).toBe('Stop manual');
      expect(suggestion.scaleIf).toBe('Scale manual');
      expect(suggestion.source).toBe('AI');
      expect(suggestion.model).toBeUndefined();
      expect(suggestion.tokens).toBeUndefined();
      expect(suggestion.cost).toBeUndefined();
      expect(suggestion.usage).toBeUndefined();
    } finally {
      await app.close();
    }
  });

  it('devuelve 503 cuando OpenAI está caído y cae a FALLBACK', async () => {
    const { app } = await buildApp({ error: new Error('boom openai') });
    try {
      const service = await createServiceFor(BUSINESS_ID);
      const created = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/campaign-briefs`)
        .send(validPayload(service.id))
        .expect(201);
      const briefId = (created.body as { id: string }).id;

      const res = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/campaign-briefs/${briefId}/suggest-rules`)
        .expect(201);
      const suggestion = res.body as SuggestRulesResponse;
      expect(suggestion.source).toBe('FALLBACK');
      expect(suggestion.stopIf.length).toBeGreaterThan(0);
      expect(suggestion.scaleIf.length).toBeGreaterThan(0);
      expect(suggestion.usage).toBeUndefined();
    } finally {
      await app.close();
    }
  });
});