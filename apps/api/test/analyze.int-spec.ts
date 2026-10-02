import './setup';
import request from 'supertest';
import { Test, type TestingModule } from '@nestjs/testing';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { prisma } from '@publicador/database';
import { AppModule } from '../src/app.module';
import { OPENAI_CLIENT } from '../src/modules/analyze/analyze.tokens';
import type {
  OpenAISummaryPrompt,
  OpenAISummaryResult,
  OpenAISummarizer,
} from '../src/modules/analyze/openai.client';
import type { PerformancePromptPayload } from '../src/modules/analyze/analyze.types';

const BUSINESS_ID = process.env.BUSINESS_ID ?? 'test-business';

interface MockOverrides {
  configured?: boolean;
  model?: string;
  response?: OpenAISummaryResult;
  error?: Error;
}

const createMockClient = (overrides: MockOverrides = {}) => {
  const configured = overrides.configured ?? true;
  const model = overrides.model ?? 'gpt-mock';
  const response = overrides.response ?? {
    parsed: {
      summary: 'Resumen breve de la campaña',
      diagnosis: 'Diagnóstico generado en test',
      action: 'KEEP',
      recommendedVariable: 'PRIMARY_TEXT',
      confidence: 'MEDIUM',
      evidence: [
        'CTR estable en 4%',
        'CPL subió 17% respecto al período anterior',
        'Más de 2000 impresiones acumuladas',
        'Resultados cayeron 4% vs período previo',
      ],
      caveats: ['Comparación contra período anterior corta'],
      recommendedNextStep: 'Probar una variante del texto principal la próxima semana.',
    },
    raw: {} as never,
    usage: { promptTokens: 800, completionTokens: 220, totalTokens: 1020, model: 'gpt-4o-mini' },
  };
  const error = overrides.error ?? null;

  const summarize = jest.fn(
    async (
      _input: PerformancePromptPayload,
      _prompts: OpenAISummaryPrompt,
    ): Promise<OpenAISummaryResult> => {
      if (error) throw error;
      return response;
    },
  );

  const client: OpenAISummarizer & { summarize: jest.Mock } = {
    isConfigured: jest.fn(() => configured),
    getModel: jest.fn(() => model),
    summarize,
  };

  return client;
};

const buildAnalyzeApp = async (
  overrides: MockOverrides = {},
): Promise<{ app: INestApplication; client: ReturnType<typeof createMockClient> }> => {
  const client = createMockClient(overrides);
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(OPENAI_CLIENT)
    .useValue(client)
    .compile();
  const app = moduleRef.createNestApplication({ logger: ['error', 'warn'] });
  app.setGlobalPrefix(process.env.API_PREFIX ?? 'api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableShutdownHooks();
  await app.init();
  return { app, client };
};

interface SeedOptions {
  metaCampaignId: string;
  withMetrics: boolean;
  previousMetrics?: boolean;
}

const seedCampaign = async ({
  metaCampaignId,
  withMetrics,
  previousMetrics,
}: SeedOptions): Promise<void> => {
  const now = new Date();
  // Anclamos `to` a hoy en UTC para que coincida con la ventana que
  // computa `AnalyzeService.computeRange(30)`.
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  await prisma.metaRemoteCampaign.create({
    data: {
      businessId: BUSINESS_ID,
      metaCampaignId,
      name: 'Campaign Integration',
      status: 'ACTIVE',
      effectiveStatus: 'active',
      objective: 'whatsapp',
      dailyBudget: '5000',
    },
  });

  if (!withMetrics) {
    return;
  }

  const rows: Array<{
    businessId: string;
    metaCampaignId: string;
    metaAdId: string;
    date: Date;
    impressions: number;
    clicks: number;
    spend: number;
    leads: number;
  }> = [];

  // 30 días en el período actual: impresiones/clics/spend coherentes.
  for (let i = 0; i < 30; i += 1) {
    const day = new Date(to.getTime());
    day.setUTCDate(day.getUTCDate() - i);
    rows.push({
      businessId: BUSINESS_ID,
      metaCampaignId,
      metaAdId: `ad-${i % 3}`,
      date: day,
      impressions: 1500 + i * 12,
      clicks: 60 + i,
      spend: 3500 + i * 25,
      leads: 2 + (i % 3),
    });
  }

  if (previousMetrics) {
    // 30 días previos: resultados distintos para que los deltas no sean cero.
    for (let i = 30; i < 60; i += 1) {
      const day = new Date(to.getTime());
      day.setUTCDate(day.getUTCDate() - i);
      rows.push({
        businessId: BUSINESS_ID,
        metaCampaignId,
        metaAdId: `ad-prev-${i % 3}`,
        date: day,
        impressions: 900 + (i - 30) * 8,
        clicks: 30 + (i - 30),
        spend: 2200 + (i - 30) * 18,
        leads: 1 + (i % 2),
      });
    }
  }

  await prisma.metaRemoteMetricDaily.createMany({ data: rows });
};

describe('Analyze endpoint (integration)', () => {
  it('analiza una campaña con datos suficientes y reenvía el resultado del cliente OpenAI mock', async () => {
    const metaCampaignId = 'cmp-int-1';
    await seedCampaign({ metaCampaignId, withMetrics: true, previousMetrics: true });

    const { app, client } = await buildAnalyzeApp();
    try {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/meta-ads/campaigns/remote/${metaCampaignId}/analyze`)
        .send({ periodDays: 30 })
        .expect(201);

      expect(res.body.campaignId).toBe(metaCampaignId);
      expect(['WAIT', 'KEEP', 'CREATE_VARIANT', 'REVIEW_CONVERSION', 'NEEDS_MORE_DATA']).toContain(
        res.body.analysis.action,
      );
      expect(['LOW', 'MEDIUM', 'HIGH']).toContain(res.body.analysis.confidence);
      expect(res.body.analysis.evidence.length).toBeGreaterThanOrEqual(3);
      expect(Array.isArray(res.body.analysis.caveats)).toBe(true);

      expect(res.body.usage).toBeUndefined();

      expect(client.summarize).toHaveBeenCalledTimes(1);
      expect(client.isConfigured).toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('responde NEEDS_MORE_DATA sin invocar al cliente OpenAI cuando no hay métricas', async () => {
    const metaCampaignId = 'cmp-int-empty';
    await seedCampaign({ metaCampaignId, withMetrics: false });

    const { app, client } = await buildAnalyzeApp();
    try {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/meta-ads/campaigns/remote/${metaCampaignId}/analyze`)
        .send({ periodDays: 30 })
        .expect(201);

      expect(res.body.analysis.action).toBe('NEEDS_MORE_DATA');
      expect(res.body.analysis.confidence).toBe('LOW');
      expect(res.body.analysis.recommendedVariable).toBe('NONE');
      expect(res.body.usage).toBeUndefined();

      expect(client.summarize).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('devuelve 503 cuando el cliente OpenAI no está configurado', async () => {
    const metaCampaignId = 'cmp-int-unconfigured';
    await seedCampaign({ metaCampaignId, withMetrics: true, previousMetrics: true });

    const { app, client } = await buildAnalyzeApp({ configured: false });
    try {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/meta-ads/campaigns/remote/${metaCampaignId}/analyze`)
        .send({ periodDays: 30 });

      expect(res.status).toBe(503);
      // El controlador aborta con `Falta OPENAI_API_KEY` y el servicio aborta con
      // `cliente no configurado`. Ambos contienen `OPENAI` (la marca real es
      // OpenAI pero la variable de entorno está en mayúsculas). Verificamos
      // el mensaje independiente del casing para cubrir ambas rutas.
      const message: string = res.body.message ?? '';
      expect(message.toUpperCase()).toEqual(expect.stringContaining('OPENAI'));
      expect(client.summarize).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('rechaza con 503 cuando la respuesta del cliente OpenAI no cumple el esquema', async () => {
    const metaCampaignId = 'cmp-int-invalid-schema';
    await seedCampaign({ metaCampaignId, withMetrics: true, previousMetrics: true });

    const { app } = await buildAnalyzeApp({
      response: {
        // Faltan campos requeridos por el schema de performanceAnalysis.
        parsed: { summary: 'Sin campos requeridos' },
        raw: {} as never,
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2, model: 'gpt-4o-mini' },
      },
    });
    try {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/meta-ads/campaigns/remote/${metaCampaignId}/analyze`)
        .send({ periodDays: 30 });

      expect(res.status).toBe(503);
      expect(res.body.message).toEqual(expect.stringContaining('No se pudo'));
    } finally {
      await app.close();
    }
  });

  it('normaliza evidence y caveats cuando vienen como strings', async () => {
    const metaCampaignId = 'cmp-int-stringify';
    await seedCampaign({ metaCampaignId, withMetrics: true, previousMetrics: true });

    const { app } = await buildAnalyzeApp({
      response: {
        parsed: {
          summary: 'Resumen breve de la campaña',
          diagnosis: 'Diagnóstico generado en test',
          action: 'CREATE_VARIANT',
          recommendedVariable: 'IMAGE',
          confidence: 'MEDIUM',
          evidence: 'CTR estable\nCPL subió 17%\nMás de 2000 impresiones',
          caveats: 'Comparación contra período anterior corta',
          recommendedNextStep: 'Probar un ángulo visual nuevo.',
        },
        raw: {} as never,
        usage: { promptTokens: 400, completionTokens: 120, totalTokens: 520, model: 'gpt-4o-mini' },
      },
    });
    try {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/meta-ads/campaigns/remote/${metaCampaignId}/analyze`)
        .send({ periodDays: 30 })
        .expect(201);

      expect(res.body.analysis.action).toBe('CREATE_VARIANT');
      expect(Array.isArray(res.body.analysis.evidence)).toBe(true);
      expect(res.body.analysis.evidence.length).toBeGreaterThanOrEqual(3);
      expect(Array.isArray(res.body.analysis.caveats)).toBe(true);
      expect(res.body.analysis.caveats.length).toBeGreaterThanOrEqual(1);
      expect(res.body.usage).toBeUndefined();
    } finally {
      await app.close();
    }
  });
});
