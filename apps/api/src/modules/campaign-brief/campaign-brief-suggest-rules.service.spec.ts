import { prisma } from '@publicador/database';
import { CampaignBriefStatus, Prisma } from '@prisma/client';
import { BusinessContextResolver } from '../../shared/business-context/business-context.resolver';
import { CampaignBriefSuggestRulesService } from './campaign-brief-suggest-rules.service';
import {
  openAIClientMock,
  OpenAIClientMock,
  type OpenAISummaryResult,
} from '../analyze/openai.client';
import type { BusinessProfileServiceToken } from '../business-profile/business-profile.tokens';
import type { SuggestRulesResponse } from './dto/campaign-brief-suggest-rules.dto';

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
  serviceId: 'svc-1',
  title: 'Balayage Q4',
  status: 'DRAFT',
  businessObjective: 'Conseguir 5 evaluaciones de balayage en 14 días',
  offer: 'Evaluación + 20% descuento en la primera sesión',
  primaryKpi: 'Evaluaciones',
  idealCustomerProfile: 'Mujeres 30-45 que quieren un cambio sutil',
  qualifyingQuestions: ['¿Cabello tinturado?'],
  monthlyAcquisitionGoal: 20,
  costPerAcquisitionCap: new Prisma.Decimal(5000),
  lifetimeBudgetCap: new Prisma.Decimal(200_000),
  dailyBudgetCap: new Prisma.Decimal(25_000),
  plannedDurationDays: 14,
  constraints: [],
  stopIf: null,
  scaleIf: null,
  approvedAt: null,
  approvedBy: null,
  createdAt: new Date('2026-09-27T00:00:00Z'),
  updatedAt: new Date('2026-09-27T00:00:00Z'),
  ...overrides,
});

interface ServiceFixture {
  id: string;
  name: string;
  description: string | null;
}

const baseService = (overrides: Partial<ServiceFixture> = {}): ServiceFixture => ({
  id: 'svc-1',
  name: 'Balayage personalizado',
  description: 'Servicio principal de evaluación.',
  ...overrides,
});

const baseUsage = {
  promptTokens: 180,
  completionTokens: 90,
  totalTokens: 270,
  model: 'gpt-4o-mini',
};

function attachPrismaMock(opts: {
  brief?: CampaignBriefFixture | null;
  service?: ServiceFixture | null;
}): void {
  (prisma as unknown as { campaignBrief: { findFirst: jest.Mock } }).campaignBrief = {
    findFirst: jest.fn(async () => opts.brief ?? null),
  };
  (prisma as unknown as { service: { findFirst: jest.Mock } }).service = {
    findFirst: jest.fn(async () => opts.service ?? null),
  };
}

function buildBusinessProfileServiceMock(
  overrides: Partial<{
    regionName: string | null;
    communeName: string | null;
    context: {
      population: number;
      avgHouseholdIncomeCLP: number;
      profileDescription: string;
      adultShare25_55: number;
    } | null;
  }> = {},
): BusinessProfileServiceToken {
  const ctx = overrides.context !== undefined ? overrides.context : null;
  return {
    getOrCreate: jest.fn(async () => ({
      id: 'profile-test',
      businessId: 'test-business',
      regionCutCode: null,
      communeCutCode: null,
      regionName: overrides.regionName ?? null,
      communeName: overrides.communeName ?? null,
      profileCompletedAt: null,
    })),
    upsert: jest.fn(),
    markCompleted: jest.fn(),
    isReady: jest.fn(() => false),
    getDisplayLocation: jest.fn(() => ''),
    getBusinessContext: jest.fn(() => ({
      regionName: overrides.regionName ?? null,
      communeName: overrides.communeName ?? null,
      regionCutCode: null,
      communeCutCode: null,
      context: ctx,
      neighbors: [],
    })),
  } as unknown as BusinessProfileServiceToken;
}

describe('CampaignBriefSuggestRulesService', () => {
  const originalBusinessId = process.env.BUSINESS_ID;

  beforeEach(() => {
    process.env.BUSINESS_ID = 'test-business';
    openAIClientMock.configured = true;
    openAIClientMock.model = 'gpt-4o-mini';
    openAIClientMock.response = null;
    openAIClientMock.error = null;
    openAIClientMock.lastInput = null;
    openAIClientMock.lastPrompts = null;
    // Limpiamos los spies acumulados en tests anteriores (el mock es
    // compartido por todo el spec).
    jest.spyOn(openAIClientMock, 'summarize').mockClear();
  });

  afterEach(() => {
    if (originalBusinessId === undefined) {
      delete process.env.BUSINESS_ID;
    } else {
      process.env.BUSINESS_ID = originalBusinessId;
    }
  });

  function buildService(options: {
      profile?: BusinessProfileServiceToken;
      response?: { parsed: unknown; usage?: typeof baseUsage };
      error?: Error;
      configured?: boolean;
    } = {}): {
      service: CampaignBriefSuggestRulesService;
      client: OpenAIClientMock;
      profile: BusinessProfileServiceToken;
    } {
    const client = openAIClientMock;
    if (options.configured !== undefined) client.configured = options.configured;
    if (options.response !== undefined) {
      client.response = {
        parsed: options.response.parsed as Record<string, unknown>,
        raw: {} as never,
        usage: options.response.usage ?? baseUsage,
      };
    }
    if (options.error !== undefined) client.error = options.error;
    const profile = options.profile ?? buildBusinessProfileServiceMock();
    const service = new CampaignBriefSuggestRulesService(
      new BusinessContextResolver(),
      client as unknown as Parameters<typeof CampaignBriefSuggestRulesService>[1],
      profile,
    );
    return { service, client, profile };
  }

  it('devuelve reglas preexistentes (idempotencia) sin llamar al modelo', async () => {
    const brief = baseFixture({
      stopIf: 'Si no hay 5 leads en 14 días',
      scaleIf: 'Si CPL < $5.000 con >10 conversaciones',
    });
    attachPrismaMock({ brief });
    const { service, client } = buildService();
    const summarizeSpy = jest.spyOn(client, 'summarize');

    const result = await service.suggest('brief-1');

    expect(result.source).toBe('AI');
    expect(result.stopIf).toBe('Si no hay 5 leads en 14 días');
    expect(result.scaleIf).toBe('Si CPL < $5.000 con >10 conversaciones');
    expect(result).not.toHaveProperty('tokens');
    expect(result).not.toHaveProperty('cost');
    expect(result).not.toHaveProperty('model');
    expect(result).not.toHaveProperty('usage');
    expect(summarizeSpy).not.toHaveBeenCalled();
  });

  it('genera stopIf y scaleIf con la IA cuando los campos están vacíos', async () => {
    attachPrismaMock({ brief: baseFixture(), service: baseService() });
    const { service, client } = buildService({
      response: {
        parsed: {
          stopIf: 'Si no hay 5 evaluaciones en 14 días',
          scaleIf: 'Si CPL < $5.000 con >10 conversaciones',
        },
        usage: {
          promptTokens: 200,
          completionTokens: 100,
          totalTokens: 300,
          model: 'gpt-4o-mini',
        },
      },
    });
    const summarizeSpy = jest.spyOn(client, 'summarize');

    const result = await service.suggest('brief-1');

    expect(result.source).toBe('AI');
    expect(result.stopIf).toBe('Si no hay 5 evaluaciones en 14 días');
    expect(result.scaleIf).toBe('Si CPL < $5.000 con >10 conversaciones');
    expect(result).not.toHaveProperty('tokens');
    expect(result).not.toHaveProperty('cost');
    expect(result).not.toHaveProperty('model');
    expect(result).not.toHaveProperty('usage');
    expect(summarizeSpy).toHaveBeenCalledTimes(1);
  });

  it('cae a fallback cuando la IA lanza error', async () => {
    attachPrismaMock({ brief: baseFixture(), service: baseService() });
    const { service } = buildService({
      error: new Error('OpenAI caído'),
    });

    const result = await service.suggest('brief-1');

    expect(result.source).toBe('FALLBACK');
    expect(result.stopIf.length).toBeGreaterThan(0);
    expect(result.scaleIf.length).toBeGreaterThan(0);
    expect(result).not.toHaveProperty('tokens');
    expect(result).not.toHaveProperty('cost');
    expect(result).not.toHaveProperty('model');
    expect(result).not.toHaveProperty('usage');
  });

  it('cae a fallback cuando la IA devuelve JSON malformado (sin stopIf/scaleIf)', async () => {
    attachPrismaMock({ brief: baseFixture(), service: baseService() });
    const { service } = buildService({
      response: {
        parsed: { suggestions: [{ headline: 'algo' }] },
        usage: baseUsage,
      },
    });

    const result = await service.suggest('brief-1');

    expect(result.source).toBe('FALLBACK');
    expect(result.stopIf.length).toBeGreaterThan(0);
    expect(result.scaleIf.length).toBeGreaterThan(0);
  });

  it('acepta JSON con stopIf/scaleIf anidados en `rules`', async () => {
    attachPrismaMock({ brief: baseFixture(), service: baseService() });
    const { service } = buildService({
      response: {
        parsed: { rules: { stopIf: 'stop', scaleIf: 'scale' } },
        usage: baseUsage,
      },
    });

    const result = await service.suggest('brief-1');

    expect(result.source).toBe('AI');
    expect(result.stopIf).toBe('stop');
    expect(result.scaleIf).toBe('scale');
  });

  it('normaliza reglas: sin emojis, sin saltos de línea, ≤ 280', async () => {
    attachPrismaMock({ brief: baseFixture(), service: baseService() });
    const long = 'a'.repeat(400);
    const { service } = buildService({
      response: {
        parsed: {
          stopIf: `🤍 Stop multi\nlínea ${long}`,
          scaleIf: 'Scale si la base',
        },
        usage: baseUsage,
      },
    });

    const result = await service.suggest('brief-1');

    expect(result.stopIf.length).toBeLessThanOrEqual(280);
    expect(result.stopIf).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(result.stopIf).not.toMatch(/\n/);
    expect(result.stopIf.startsWith('Stop')).toBe(true);
  });

  it('lanza 400 cuando el brief está archivado', async () => {
    attachPrismaMock({
      brief: baseFixture({ status: CampaignBriefStatus.ARCHIVED }),
    });
    const { service } = buildService();

    await expect(service.suggest('brief-1')).rejects.toMatchObject({
      name: 'BadRequestException',
    });
  });

  it('lanza 400 cuando el objetivo comercial está vacío', async () => {
    attachPrismaMock({
      brief: baseFixture({ businessObjective: '' }),
    });
    const { service } = buildService();

    await expect(service.suggest('brief-1')).rejects.toMatchObject({
      name: 'BadRequestException',
      message: expect.stringContaining('objetivo comercial'),
    });
  });

  it('lanza 404 cuando el brief no pertenece al negocio', async () => {
    attachPrismaMock({ brief: null });
    const { service } = buildService();

    await expect(service.suggest('brief-1')).rejects.toMatchObject({
      name: 'NotFoundException',
    });
  });

  it('funciona sin contexto socioeconómico (perfil vacío)', async () => {
    attachPrismaMock({ brief: baseFixture(), service: baseService() });
    const { service } = buildService({
      profile: buildBusinessProfileServiceMock(),
      response: {
        parsed: { stopIf: 'stop sin contexto', scaleIf: 'scale sin contexto' },
        usage: baseUsage,
      },
    });

    const result = await service.suggest('brief-1');

    expect(result.source).toBe('AI');
    expect(result.stopIf).toBe('stop sin contexto');
  });

  it('incluye contexto territorial y socioeconómico en el user prompt cuando están disponibles', async () => {
    attachPrismaMock({ brief: baseFixture(), service: baseService() });
    const profile = buildBusinessProfileServiceMock({
      regionName: 'Región Metropolitana de Santiago',
      communeName: 'Las Condes',
      context: {
        population: 280_000,
        avgHouseholdIncomeCLP: 1_500_000,
        profileDescription: 'Comuna de ingresos altos',
        adultShare25_55: 0.6,
      },
    });
    (profile.getDisplayLocation as jest.Mock).mockReturnValue(
      'Las Condes, Región Metropolitana de Santiago',
    );
    const { service, client } = buildService({
      profile,
      response: {
        parsed: { stopIf: 'stop', scaleIf: 'scale' },
        usage: baseUsage,
      },
    });

    await service.suggest('brief-1');

    const userPrompt = client.lastPrompts?.userPrompt ?? '';
    expect(userPrompt).toContain('Objetivo comercial:');
    expect(userPrompt).toContain('Conseguir 5 evaluaciones');
    expect(userPrompt).toContain('comuna Las Condes');
    expect(userPrompt).toContain('región Región Metropolitana de Santiago');
    expect(userPrompt).toContain('280.000 habitantes');
    expect(userPrompt).toContain('$1.500.000 CLP');
    expect(userPrompt).toContain('Comuna de ingresos altos');
  });

  it('incluye el serviceId y descripción del servicio en el prompt', async () => {
    attachPrismaMock({
      brief: baseFixture(),
      service: baseService({
        name: 'Balayage personalizado',
        description: 'Diagnóstico + aplicación + sellado.',
      }),
    });
    const { service, client } = buildService({
      response: {
        parsed: { stopIf: 'stop', scaleIf: 'scale' },
        usage: baseUsage,
      },
    });

    await service.suggest('brief-1');

    const userPrompt = client.lastPrompts?.userPrompt ?? '';
    expect(userPrompt).toContain('Servicio: Balayage personalizado');
    expect(userPrompt).toContain('Diagnóstico + aplicación + sellado.');
  });

  it('system prompt refuerza las reglas duras (sin marca, sin emojis, CLP)', async () => {
    attachPrismaMock({ brief: baseFixture(), service: baseService() });
    const { service, client } = buildService({
      response: {
        parsed: { stopIf: 'stop', scaleIf: 'scale' },
        usage: baseUsage,
      },
    });

    await service.suggest('brief-1');

    const systemPrompt = client.lastPrompts?.systemPrompt ?? '';
    expect(systemPrompt.toLowerCase()).toContain('prohibido nombrar');
    expect(systemPrompt.toLowerCase()).toContain('prohibido usar emojis');
    expect(systemPrompt.toLowerCase()).toContain('clp');
    expect(systemPrompt).toContain('280');
  });

  it('devuelve source=FALLBACK cuando OPENAI_CLIENT no está configurado', async () => {
    attachPrismaMock({ brief: baseFixture(), service: baseService() });
    const { service, client } = buildService({ configured: false });
    const summarizeSpy = jest.spyOn(client, 'summarize');

    const result = await service.suggest('brief-1');

    expect(result.source).toBe('FALLBACK');
    expect(result).not.toHaveProperty('tokens');
    expect(result).not.toHaveProperty('cost');
    expect(result).not.toHaveProperty('model');
    expect(result).not.toHaveProperty('usage');
    expect(summarizeSpy).not.toHaveBeenCalled();
  });

  it('fallback incluye el tope CPA en las plantillas cuando está disponible', async () => {
    attachPrismaMock({ brief: baseFixture(), service: baseService() });
    const { service } = buildService({
      error: new Error('boom'),
    });

    const result: SuggestRulesResponse = await service.suggest('brief-1');

    expect(result.source).toBe('FALLBACK');
    // CPA cap es $5.000, fallback usa 1.5x = $7.500 y 0.5x = $2.500
    expect(result.stopIf).toContain('$7.500');
    expect(result.scaleIf).toContain('$2.500');
  });

  it('no llama a la IA si solo una de las reglas preexistentes está completa', async () => {
    attachPrismaMock({
      brief: baseFixture({
        stopIf: 'Stop preexistente',
        // scaleIf queda null
      }),
      service: baseService(),
    });
    const { service, client } = buildService({
      response: {
        parsed: { stopIf: 'nuevo', scaleIf: 'nuevo scale' },
        usage: baseUsage,
      },
    });
    const summarizeSpy = jest.spyOn(client, 'summarize');

    const result = await service.suggest('brief-1');

    expect(result.source).toBe('AI');
    expect(result.stopIf).toBe('nuevo');
    expect(result.scaleIf).toBe('nuevo scale');
    expect(summarizeSpy).toHaveBeenCalledTimes(1);
  });
});