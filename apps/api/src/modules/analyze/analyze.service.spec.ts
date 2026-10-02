import { prisma } from '@publicador/database';
import { BusinessContextResolver } from '../../shared/business-context/business-context.resolver';
import { PerformanceService } from '../performance/performance.service';
import { AnalyzeService } from './analyze.service';
import { OpenAIClientMock, openAIClientMock } from './openai.client';
import type { CampaignPerformance } from '../performance/performance.types';

interface PerformanceServiceMock {
  campaignPerformance: jest.Mock<Promise<CampaignPerformance>, [string, string, string]>;
}

const buildPerformanceServiceMock = (
  response: CampaignPerformance,
): PerformanceServiceMock => ({
  campaignPerformance: jest.fn(async () => response),
});

const basePerformance = (
  overrides: Partial<CampaignPerformance> = {},
): CampaignPerformance => ({
  range: {
    from: '2026-01-01',
    to: '2026-01-30',
    previousFrom: '2025-12-02',
    previousTo: '2025-12-31',
    days: 30,
  },
  totals: {
    spend: 0,
    impressions: 0,
    clicks: 0,
    results: 0,
    ctr: 0,
    cpc: 0,
    cpl: 0,
    conversionRate: 0,
    currency: 'CLP',
  },
  comparison: {
    spendDelta: null,
    resultsDelta: null,
    cplDelta: null,
    ctrDelta: null,
    cpcDelta: null,
  },
  daily: [],
  ads: [],
  importedAt: '2026-01-31T00:00:00.000Z',
  ...overrides,
});

const baseCampaignRow = {
  metaCampaignId: 'cmp-1',
  name: 'Campaña Test',
  status: 'ACTIVE',
  effectiveStatus: 'active',
  dailyBudget: '5000',
  lifetimeBudget: null as string | null,
};

describe('AnalyzeService', () => {
  const originalBusinessId = process.env.BUSINESS_ID;
  const originalPrismaMetaRemoteCampaign = prisma.metaRemoteCampaign;

  beforeEach(() => {
    process.env.BUSINESS_ID = 'test-business';
    openAIClientMock.response = null;
    openAIClientMock.error = null;
    openAIClientMock.lastInput = null;
    openAIClientMock.lastPrompts = null;
  });

  afterEach(() => {
    (prisma as unknown as { metaRemoteCampaign: unknown }).metaRemoteCampaign =
      originalPrismaMetaRemoteCampaign;
    if (originalBusinessId === undefined) {
      delete process.env.BUSINESS_ID;
    } else {
      process.env.BUSINESS_ID = originalBusinessId;
    }
  });

  function installCampaignRow(row: typeof baseCampaignRow | null) {
    (prisma as unknown as { metaRemoteCampaign: { findFirst: jest.Mock } }).metaRemoteCampaign = {
      findFirst: jest.fn(async () => row),
    };
  }

  function buildService(performanceResponse: CampaignPerformance): {
    service: AnalyzeService;
    performanceMock: PerformanceServiceMock;
    client: OpenAIClientMock;
  } {
    const performanceMock = buildPerformanceServiceMock(performanceResponse);
    const client = openAIClientMock;
    const service = new AnalyzeService(
      new BusinessContextResolver(),
      performanceMock as unknown as PerformanceService,
      client as unknown as Parameters<typeof AnalyzeService>[2],
    );
    return { service, performanceMock, client };
  }

  it('devuelve NEEDS_MORE_DATA sin llamar a OpenAI cuando la campaña no tiene actividad', async () => {
    const performance = basePerformance({
      totals: {
        spend: 0,
        impressions: 0,
        clicks: 0,
        results: 0,
        ctr: 0,
        cpc: 0,
        cpl: 0,
        conversionRate: 0,
        currency: 'CLP',
      },
      daily: [],
    });
    installCampaignRow(baseCampaignRow);
    const { service, performanceMock, client } = buildService(performance);

    const result = await service.analyzeCampaign('cmp-1', 30);

    expect(result.analysis.action).toBe('NEEDS_MORE_DATA');
    expect(result.analysis.recommendedVariable).toBe('NONE');
    expect(result.analysis.confidence).toBe('LOW');
    expect(result).not.toHaveProperty('usage');
    expect(performanceMock.campaignPerformance).toHaveBeenCalledTimes(1);
    expect(client.lastInput).toBeNull();
    expect(client.lastPrompts).toBeNull();
  });

  it('envía el prompt a OpenAI y calcula el coste estimado cuando hay datos suficientes', async () => {
    const performance = basePerformance({
      totals: {
        spend: 120000,
        impressions: 8000,
        clicks: 320,
        results: 18,
        ctr: 4,
        cpc: 375,
        cpl: 6666.67,
        conversionRate: 5.63,
        currency: 'CLP',
      },
      comparison: {
        spendDelta: 12.5,
        resultsDelta: -4.2,
        cplDelta: 17.4,
        ctrDelta: -1.1,
        cpcDelta: 3.3,
      },
      daily: [
        { date: '2026-01-01', spend: 4000, impressions: 250, clicks: 10, results: 1 },
        { date: '2026-01-02', spend: 4200, impressions: 270, clicks: 12, results: 0 },
      ],
    });
    installCampaignRow(baseCampaignRow);

    openAIClientMock.response = {
      parsed: {
        summary: 'Resumen breve de la campaña',
        diagnosis: 'Diagnóstico basado en los datos',
        action: 'KEEP',
        recommendedVariable: 'PRIMARY_TEXT',
        confidence: 'MEDIUM',
        evidence: [
          'CTR estable en 4%',
          'CPL subió 17% respecto al período anterior',
          'Resultados cayeron 4%',
          'Más de 2000 impresiones',
        ],
        caveats: ['Comparación contra período anterior corta'],
        recommendedNextStep: 'Probar una variante del texto principal la próxima semana.',
      },
      raw: {} as never,
      usage: {
        promptTokens: 800,
        completionTokens: 220,
        totalTokens: 1020,
        model: 'gpt-4o-mini',
      },
    };

    const { service, performanceMock, client } = buildService(performance);

    const result = await service.analyzeCampaign('cmp-1', 30);

    expect(performanceMock.campaignPerformance).toHaveBeenCalledTimes(1);
    expect(client.lastInput).not.toBeNull();
    expect(client.lastInput?.campaign.metaCampaignId).toBe('cmp-1');
    expect(client.lastInput?.totals.impressions).toBe(8000);
    expect(client.lastInput?.hasPreviousPeriod).toBe(true);
    expect(client.lastPrompts?.systemPrompt).toContain('analista publicitario');
    expect(client.lastPrompts?.userPrompt).toContain('Campaña Test');

    expect(result.analysis.action).toBe('KEEP');
    expect(result.analysis.recommendedVariable).toBe('PRIMARY_TEXT');
    expect(result.analysis.confidence).toBe('MEDIUM');
    expect(result.analysis.evidence.length).toBeGreaterThanOrEqual(3);

    expect(result).not.toHaveProperty('usage');
  });

  it('rechaza con ServiceUnavailable cuando OpenAI responde sin cumplir el esquema', async () => {
    const performance = basePerformance({
      totals: {
        spend: 120000,
        impressions: 8000,
        clicks: 320,
        results: 18,
        ctr: 4,
        cpc: 375,
        cpl: 6666.67,
        conversionRate: 5.63,
        currency: 'CLP',
      },
    });
    installCampaignRow(baseCampaignRow);

    openAIClientMock.response = {
      parsed: {
        summary: 'Sin diagnosis',
        // Falta el resto de campos; Zod debe fallar.
      },
      raw: {} as never,
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2, model: 'gpt-4o-mini' },
    };

    const { service } = buildService(performance);

    await expect(service.analyzeCampaign('cmp-1', 30)).rejects.toMatchObject({
      name: 'ServiceUnavailableException',
      message: expect.stringContaining('No se pudo'),
    });
  });
});
