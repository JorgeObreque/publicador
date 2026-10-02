import { Prisma } from '@prisma/client';
import { prisma } from '@publicador/database';
import { BusinessContextResolver } from '../../shared/business-context/business-context.resolver';
import { CreativeRecommendationsService } from './creative-recommendations.service';
import { BUSINESS_LOCATION_NOTE } from './creative-recommendations.prompt';
import {
  OpenAIClientMock,
  openAIClientMock,
  type OpenAISummaryResult,
} from '../analyze/openai.client';
import {
  HEADLINE_MAX,
  PRIMARY_TEXT_MAX,
  type RecommendationRequest,
  type RecommendationResponse,
} from './creative-recommendations.types';
import type { BusinessProfileServiceToken } from '../business-profile/business-profile.tokens';

interface SuggestionFixture {
  primaryText: string;
  headline: string;
}

interface ParsedResponse {
  suggestions?: SuggestionFixture[];
}

const buildRequest = (overrides: Partial<RecommendationRequest> = {}): RecommendationRequest => ({
  mode: 'INITIAL',
  serviceId: 'svc-1',
  mediaAssetId: 'asset-1',
  ...overrides,
});

const buildBusinessRow = (overrides: Partial<{ id: string; name: string }> = {}) => ({
  id: 'test-business',
  name: 'Test Business',
  ...overrides,
});

const buildServiceRow = (
  overrides: Partial<{
    id: string;
    name: string;
    description: string | null;
    price: Prisma.Decimal;
    currency: string;
    duration: number | null;
  }> = {},
) => ({
  id: 'svc-1',
  name: 'Corte y peinado',
  description: 'Servicio principal de la peluquería.',
  price: new Prisma.Decimal(15990),
  currency: 'CLP',
  duration: 60,
  ...overrides,
});

const buildMediaAssetRow = (
  overrides: Partial<{
    id: string;
    name: string;
    mimeType: string;
    kind: unknown;
  }> = {},
) => ({
  id: 'asset-1',
  name: 'foto-local.jpg',
  mimeType: 'image/jpeg',
  kind: 'IMAGE',
  ...overrides,
});

const buildSuggestionsResponse = (
  suggestions: SuggestionFixture[],
  mode: 'INITIAL' | 'REGENERATE_PRIMARY_TEXT' | 'REGENERATE_HEADLINE' = 'INITIAL',
): ParsedResponse & { mode: string } => ({
  mode,
  suggestions,
});

const baseUsage = {
  promptTokens: 120,
  completionTokens: 80,
  totalTokens: 200,
  model: 'gpt-4o-mini',
};
// El uso interno (tokens/modelo) sigue llegando al cliente y a los mocks para
// que `OpenAIClientMock` mantenga su firma interna. El contrato que ve el
// frontend ya no incluye `usage`, así que no se valida en este spec.
void baseUsage;

const bigPrimaryText = 'a'.repeat(PRIMARY_TEXT_MAX + 50);
const bigHeadline = 'h'.repeat(HEADLINE_MAX + 20);

// Helper para construir un primaryText con la nueva estructura obligatoria.
const buildPrimaryText = (
  priceLine: string | null,
  hashtagSet: string,
  index: number,
): string => {
  const header = `✨ Visos e iluminación personalizada | Blondor Peluquería`;
  const description =
    'Servicio pensado para ti: evaluamos tu cabello y diseñamos una propuesta personalizada de iluminación.';
  const priceBlock = priceLine
    ? `${priceLine}\nValor sujeto a evaluación según largo, cantidad y técnica.`
    : '';
  const bullets = [
    '- 🤍 Asesoría personalizada de color.',
    '- 🤍 Productos premium libres de amoníaco.',
    '- 🤍 Resultado natural y luminoso.',
  ].join('\n');
  const cta = index === 1 ? '📩 Escríbenos por WhatsApp para evaluar tu caso.' : '✨ Reserva tu hora por WhatsApp.';
  const hashtags = hashtagSet;
  return [header, description, priceBlock, bullets, cta, hashtags, BUSINESS_LOCATION_NOTE]
    .filter((line) => line.length > 0)
    .join('\n');
};

describe('CreativeRecommendationsService', () => {
  const originalBusinessId = process.env.BUSINESS_ID;
  const originalPrisma = prisma;

  beforeEach(() => {
    process.env.BUSINESS_ID = 'test-business';
    openAIClientMock.configured = true;
    openAIClientMock.model = 'gpt-4o-mini';
    openAIClientMock.response = null;
    openAIClientMock.error = null;
    openAIClientMock.lastInput = null;
    openAIClientMock.lastPrompts = null;
  });

  afterEach(() => {
    (prisma as unknown as Record<string, unknown>)['business'] = (
      originalPrisma as unknown as Record<string, unknown>
    )['business'];
    (prisma as unknown as Record<string, unknown>)['service'] = (
      originalPrisma as unknown as Record<string, unknown>
    )['service'];
    (prisma as unknown as Record<string, unknown>)['mediaAsset'] = (
      originalPrisma as unknown as Record<string, unknown>
    )['mediaAsset'];
    if (originalBusinessId === undefined) {
      delete process.env.BUSINESS_ID;
    } else {
      process.env.BUSINESS_ID = originalBusinessId;
    }
  });

  function installPrisma({
    business = buildBusinessRow(),
    service = buildServiceRow(),
    mediaAsset = buildMediaAssetRow(),
  }: {
    business?: ReturnType<typeof buildBusinessRow> | null;
    service?: ReturnType<typeof buildServiceRow> | null;
    mediaAsset?: ReturnType<typeof buildMediaAssetRow> | null;
  } = {}) {
    (prisma as unknown as { business: { findUnique: jest.Mock } }).business = {
      findUnique: jest.fn(async () => business),
    };
    (prisma as unknown as { service: { findFirst: jest.Mock } }).service = {
      findFirst: jest.fn(async () => service),
    };
    (prisma as unknown as { mediaAsset: { findFirst: jest.Mock } }).mediaAsset = {
      findFirst: jest.fn(async () => mediaAsset),
    };
  }

  /**
   * Construye un mock del `BusinessProfileService` que devuelve un perfil
   * vacío por defecto (mismo comportamiento que la implementación real
   * cuando el operador aún no ha editado el perfil). Se permite sobrescribir
   * cualquier campo para tests específicos.
   */
  function buildBusinessProfileServiceMock(
    overrides: Partial<{
      addressLine: string | null;
      neighborhood: string | null;
      regionCutCode: string | null;
      communeCutCode: string | null;
      regionName: string | null;
      communeName: string | null;
      city: string | null;
      country: string | null;
      countryCode: string | null;
      brandVoiceKeywords: string[];
      wordsToAvoid: string[];
      preferredEmojiSemantics: string[];
      primaryCustomerProfile: string;
      commonObjections: string[];
      profileCompletedAt: Date | null;
    }> = {},
  ): BusinessProfileServiceToken {
    const defaults = {
      addressLine: null,
      neighborhood: null,
      regionCutCode: null,
      communeCutCode: null,
      regionName: null,
      communeName: null,
      city: null,
      country: null,
      countryCode: null,
      brandVoiceKeywords: [],
      wordsToAvoid: [],
      preferredEmojiSemantics: [],
      primaryCustomerProfile: '',
      commonObjections: [],
      profileCompletedAt: null,
      ...overrides,
    };
    return {
      getOrCreate: jest.fn(async () => defaults),
      upsert: jest.fn(async (input: unknown) => ({ ...defaults, ...(input as object) })),
      markCompleted: jest.fn(async () => ({ ...defaults, profileCompletedAt: new Date() })),
      isReady: jest.fn((p: { profileCompletedAt: Date | null } | null) =>
        Boolean(p && p.profileCompletedAt),
      ),
      getDisplayLocation: jest.fn(() => ''),
    } as unknown as BusinessProfileServiceToken;
  }

  function buildService(
    options: {
      response?: { parsed: unknown; usage?: typeof baseUsage };
      error?: Error;
      configured?: boolean;
      profile?: ReturnType<typeof buildBusinessProfileServiceMock>;
    } = {},
  ): {
    service: CreativeRecommendationsService;
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
    const service = new CreativeRecommendationsService(
      new BusinessContextResolver(),
      client as unknown as Parameters<typeof CreativeRecommendationsService>[1],
      profile,
    );
    return { service, client, profile };
  }

  it('INITIAL devuelve 3 propuestas distintas con primaryText y headline', async () => {
    installPrisma();
    const { service } = buildService({
      response: {
        parsed: buildSuggestionsResponse([
          {
            primaryText: buildPrimaryText(
              'desde $55.000',
              '#Blondor #Visos #IluminaciónPersonalizada #DiseñoDeColor #Balayage #Babylights #Colorista #LasCondes #CabelloSano',
              0,
            ),
            headline: 'Visos e iluminación personalizada',
          },
          {
            primaryText: buildPrimaryText(
              'desde $55.000',
              '#Blondor #CabelloDañado #ReparaciónCapilar #TratamientoCapilar #Keratina #Hidratación #Colorista #LasCondes #CabelloSano #PeloSano',
              1,
            ),
            headline: 'Cabello dañado, solución real',
          },
          {
            primaryText: buildPrimaryText(
              'desde $55.000',
              '#Blondor #RenovaciónDeImagen #Coloración #Corte #Estilo #DiseñoDeColor #Colorista #LasCondes #CabelloSano #Peluquería',
              0,
            ),
            headline: 'Renueva tu imagen hoy',
          },
        ]),
      },
    });

    const result = await service.generate(buildRequest({ mode: 'INITIAL' }));

    expect(result.mode).toBe('INITIAL');
    expect(result.suggestions).toHaveLength(3);
    for (const suggestion of result.suggestions) {
      expect(suggestion.primaryText.length).toBeGreaterThan(0);
      expect(suggestion.primaryText.length).toBeLessThanOrEqual(PRIMARY_TEXT_MAX);
      expect(suggestion.primaryText).toMatch(/✨|🤍|📩|📍/);
      expect(suggestion.primaryText).toMatch(/#\w+/);
      // El primaryText SIEMPRE termina con la dirección fija (canónica, con '\n' final)
      expect(suggestion.primaryText.endsWith(BUSINESS_LOCATION_NOTE + '\n')).toBe(true);
      expect(suggestion.headline.length).toBeGreaterThan(0);
      expect(suggestion.headline.length).toBeLessThanOrEqual(HEADLINE_MAX);
    }
    const primaryTexts = new Set(result.suggestions.map((s) => s.primaryText));
    expect(primaryTexts.size).toBe(3);
    const headlines = new Set(result.suggestions.map((s) => s.headline));
    expect(headlines.size).toBe(3);
  });

  it('REGENERATE_PRIMARY_TEXT devuelve 3 textos distintos conservando headline', async () => {
    installPrisma();
    const currentHeadline = 'Corte que resalta tu estilo';
    const { service } = buildService({
      response: {
        parsed: buildSuggestionsResponse(
          [
            {
              primaryText: buildPrimaryText(
                'desde $55.000',
                '#Blondor #Corte #EstiloPersonalizado #CabelloSano',
                0,
              ),
              headline: currentHeadline,
            },
            {
              primaryText: buildPrimaryText(
                'desde $55.000',
                '#Blondor #CorteModerno #LookNuevo #Estilo #CabelloSano',
                0,
              ),
              headline: currentHeadline,
            },
            {
              primaryText: buildPrimaryText(
                'desde $55.000',
                '#Blondor #CorteFresco #Personalizado #Estilo #CabelloSano',
                0,
              ),
              headline: currentHeadline,
            },
          ],
          'REGENERATE_PRIMARY_TEXT',
        ),
      },
    });

    const result = await service.generate(
      buildRequest({
        mode: 'REGENERATE_PRIMARY_TEXT',
        currentCopy: {
          primaryText: 'Texto original del operador.',
          headline: currentHeadline,
        },
      }),
    );

    expect(result.mode).toBe('REGENERATE_PRIMARY_TEXT');
    expect(result.suggestions).toHaveLength(3);
    for (const suggestion of result.suggestions) {
      expect(suggestion.headline).toBe(currentHeadline);
      expect(suggestion.primaryText.endsWith(BUSINESS_LOCATION_NOTE + '\n')).toBe(true);
    }
    const primaryTexts = new Set(result.suggestions.map((s) => s.primaryText));
    expect(primaryTexts.size).toBe(3);
  });

  it('REGENERATE_HEADLINE devuelve 3 títulos distintos conservando primaryText', async () => {
    installPrisma();
    const currentPrimary =
      'Servicio principal | Blondor Peluquería\nNuestra atención personalizada te espera.\n🤍 Asesoría.\n🤍 Diagnóstico.\n✨ Reserva tu hora.\n#Blondor #Corte #Estilo #CabelloSano\n📍 Las Condes · Centro Comercial Omnium\nAtención exclusiva con agenda previa.';
    const { service } = buildService({
      response: {
        parsed: buildSuggestionsResponse(
          [
            {
              primaryText: currentPrimary,
              headline: 'Titular uno: tu mejor versión',
            },
            {
              primaryText: currentPrimary,
              headline: 'Titular dos: estilo a tu medida',
            },
            {
              primaryText: currentPrimary,
              headline: 'Titular tres: corte con propósito',
            },
          ],
          'REGENERATE_HEADLINE',
        ),
      },
    });

    const result = await service.generate(
      buildRequest({
        mode: 'REGENERATE_HEADLINE',
        currentCopy: {
          primaryText: currentPrimary,
          headline: 'Titular original',
        },
      }),
    );

    expect(result.mode).toBe('REGENERATE_HEADLINE');
    expect(result.suggestions).toHaveLength(3);
    for (const suggestion of result.suggestions) {
      expect(suggestion.primaryText).toBe(currentPrimary);
    }
    const headlines = new Set(result.suggestions.map((s) => s.headline));
    expect(headlines.size).toBe(3);
  });

  it('rechaza con BadRequest cuando el servicio no pertenece al negocio', async () => {
    installPrisma({ service: null });
    const { service } = buildService();

    await expect(service.generate(buildRequest())).rejects.toMatchObject({
      name: 'BadRequestException',
      message: expect.stringContaining('svc-1'),
    });
  });

  it('rechaza con BadRequest cuando el MediaAsset no pertenece al negocio', async () => {
    installPrisma({ mediaAsset: null });
    const { service } = buildService();

    await expect(service.generate(buildRequest())).rejects.toMatchObject({
      name: 'BadRequestException',
      message: expect.stringContaining('asset-1'),
    });
  });

  it('lanza ServiceUnavailable cuando el cliente OpenAI no está configurado', async () => {
    installPrisma();
    const { service } = buildService({ configured: false });

    await expect(service.generate(buildRequest())).rejects.toMatchObject({
      name: 'ServiceUnavailableException',
      message: expect.stringContaining('no configurado'),
    });
  });

  it('lanza ServiceUnavailable cuando OpenAI devuelve menos de 3 sugerencias', async () => {
    installPrisma();
    const { service } = buildService({
      response: {
        parsed: buildSuggestionsResponse([
          {
            primaryText: 'Solo una propuesta',
            headline: 'Titular',
          },
        ]),
      },
    });

    await expect(service.generate(buildRequest())).rejects.toMatchObject({
      name: 'ServiceUnavailableException',
      message: expect.stringContaining('sugerencias'),
    });
  });

  it('lanza ServiceUnavailable cuando OpenAI devuelve más de 3 sugerencias', async () => {
    installPrisma();
    const { service } = buildService({
      response: {
        parsed: buildSuggestionsResponse([
          { primaryText: 'a', headline: 'h1' },
          { primaryText: 'b', headline: 'h2' },
          { primaryText: 'c', headline: 'h3' },
          { primaryText: 'd', headline: 'h4' },
        ]),
      },
    });

    await expect(service.generate(buildRequest())).rejects.toMatchObject({
      name: 'ServiceUnavailableException',
    });
  });

  it('trunca primaryText y headline cuando exceden los límites', async () => {
    installPrisma();
    const { service } = buildService({
      response: {
        parsed: buildSuggestionsResponse([
          {
            primaryText: bigPrimaryText,
            headline: bigHeadline,
          },
          {
            primaryText: bigPrimaryText,
            headline: bigHeadline,
          },
          {
            primaryText: bigPrimaryText,
            headline: bigHeadline,
          },
        ]),
      },
    });

    const result: RecommendationResponse = await service.generate(buildRequest());

    expect(result.suggestions).toHaveLength(3);
    for (const suggestion of result.suggestions) {
      expect(suggestion.primaryText.length).toBe(PRIMARY_TEXT_MAX);
      expect(suggestion.headline.length).toBe(HEADLINE_MAX);
    }
  });

  it('lanza ServiceUnavailable cuando una sugerencia llega con primaryText vacío', async () => {
    installPrisma();
    const { service } = buildService({
      response: {
        parsed: buildSuggestionsResponse([
          { primaryText: '', headline: 'h' },
          { primaryText: 'b', headline: 'h2' },
          { primaryText: 'c', headline: 'h3' },
        ]),
      },
    });

    await expect(service.generate(buildRequest())).rejects.toMatchObject({
      name: 'ServiceUnavailableException',
      message: expect.stringContaining('vacía'),
    });
  });

  it('REGENERATE_PRIMARY_TEXT extrae headline del primaryText cuando el modelo lo devuelve vacío', async () => {
    installPrisma();
    const { service } = buildService({
      response: {
        parsed: buildSuggestionsResponse(
          [
            {
              primaryText: buildPrimaryText(
                'desde $55.000',
                '#Blondor #Corte #EstiloPersonalizado #CabelloSano',
                0,
              ),
              headline: '',
            },
            {
              primaryText: buildPrimaryText(
                'desde $55.000',
                '#Blondor #CorteModerno #LookNuevo #Estilo #CabelloSano',
                0,
              ),
              headline: '',
            },
            {
              primaryText: buildPrimaryText(
                'desde $55.000',
                '#Blondor #CorteFresco #Personalizado #Estilo #CabelloSano',
                0,
              ),
              headline: '',
            },
          ],
          'REGENERATE_PRIMARY_TEXT',
        ),
      },
    });

    const result = await service.generate(
      buildRequest({
        mode: 'REGENERATE_PRIMARY_TEXT',
        currentCopy: {
          primaryText: 'Texto original del operador.',
          headline: 'Titular fijo',
        },
      }),
    );

    expect(result.mode).toBe('REGENERATE_PRIMARY_TEXT');
    expect(result.suggestions).toHaveLength(3);
    for (const suggestion of result.suggestions) {
      expect(suggestion.headline.length).toBeGreaterThanOrEqual(2);
      expect(suggestion.headline.length).toBeLessThanOrEqual(HEADLINE_MAX);
      expect(suggestion.headline).not.toBe('');
      expect(suggestion.headline).not.toMatch(/[🤍✨📍📩]/u);
      expect(suggestion.primaryText.endsWith(BUSINESS_LOCATION_NOTE + '\n')).toBe(true);
    }
    const extractedHeadline = result.suggestions[0].headline;
    expect(extractedHeadline.toLowerCase()).toMatch(/visos|iluminación|personalizada/);
  });

  it('reintenta UNA vez cuando la primera respuesta rompe el contrato y devuelve las 3 sugerencias del segundo intento', async () => {
    installPrisma();

    const firstAttemptParsed = buildSuggestionsResponse([
      { primaryText: '', headline: '' },
    ]);
    const secondAttemptParsed = buildSuggestionsResponse([
      { primaryText: 'p1', headline: 'h1' },
      { primaryText: 'p2', headline: 'h2' },
      { primaryText: 'p3', headline: 'h3' },
    ]);

    const summarizeSpy = jest
      .spyOn(openAIClientMock, 'summarize')
      .mockResolvedValueOnce({
        parsed: firstAttemptParsed as unknown as Record<string, unknown>,
        raw: {} as never,
        usage: baseUsage,
      } as OpenAISummaryResult)
      .mockResolvedValueOnce({
        parsed: secondAttemptParsed as unknown as Record<string, unknown>,
        raw: {} as never,
        usage: baseUsage,
      } as OpenAISummaryResult);

    let service: CreativeRecommendationsService;
    try {
      service = new CreativeRecommendationsService(
        new BusinessContextResolver(),
        openAIClientMock as unknown as Parameters<typeof CreativeRecommendationsService>[1],
        buildBusinessProfileServiceMock(),
      );

      const result = await service.generate(buildRequest());

      expect(summarizeSpy).toHaveBeenCalledTimes(2);
      expect(result.suggestions).toHaveLength(3);
      expect(result.suggestions.map((s) => s.headline)).toEqual(['h1', 'h2', 'h3']);
      expect(result.suggestions.map((s) => s.primaryText)).toEqual([
        `p1${BUSINESS_LOCATION_NOTE}\n`,
        `p2${BUSINESS_LOCATION_NOTE}\n`,
        `p3${BUSINESS_LOCATION_NOTE}\n`,
      ]);
    } finally {
      summarizeSpy.mockRestore();
    }
  });

  it('reenvía al cliente el payload y los prompts construidos a partir del modo', async () => {
    installPrisma();
    const { service, client } = buildService({
      response: {
        parsed: buildSuggestionsResponse([
          { primaryText: 'p1', headline: 'h1' },
          { primaryText: 'p2', headline: 'h2' },
          { primaryText: 'p3', headline: 'h3' },
        ]),
      },
    });

    await service.generate(
      buildRequest({
        mode: 'REGENERATE_HEADLINE',
        context: { campaignNotes: 'Enfatizar promo de verano' },
      }),
    );

    expect(client.lastPrompts?.systemPrompt).toContain('Blondor Peluquería');
    expect(client.lastPrompts?.userPrompt).toContain('Modo actual: REGENERATE_HEADLINE');
    expect(client.lastPrompts?.userPrompt).toContain('Servicio: Corte y peinado');
    expect(client.lastPrompts?.userPrompt).toContain('Enfatizar promo de verano');
    // Nueva instrucción explícita en el user prompt sobre personalización y dirección fija
    expect(client.lastPrompts?.userPrompt).toContain(
      'cada propuesta debe recalcar que el servicio es 100% personalizado',
    );
    expect(client.lastPrompts?.userPrompt).toContain(
      'SIEMPRE termina en la línea "Atención exclusiva con agenda previa."',
    );
  });

  it('respeta el límite del dominio al construir el payload', async () => {
    installPrisma();
    const { service, client } = buildService({
      response: {
        parsed: buildSuggestionsResponse([
          { primaryText: 'p1', headline: 'h1' },
          { primaryText: 'p2', headline: 'h2' },
          { primaryText: 'p3', headline: 'h3' },
        ]),
      },
    });

    await service.generate(buildRequest({ serviceId: 'svc-1', mediaAssetId: 'asset-1' }));

    expect(client.lastPrompts?.userPrompt).toContain('Modo actual: INITIAL');
    expect(client.lastPrompts?.userPrompt).toContain('Precio referencial en CLP: desde $15.990');
    expect(client.lastPrompts?.userPrompt).toContain('Imagen seleccionada: image/jpeg');
  });

  it('incluye "Sin precio referencial" en el payload cuando service.price es 0 o ausente', async () => {
    installPrisma({
      service: buildServiceRow({
        price: new Prisma.Decimal(0),
        currency: 'CLP',
      }),
    });
    const { service, client } = buildService({
      response: {
        parsed: buildSuggestionsResponse([
          { primaryText: 'p1', headline: 'h1' },
          { primaryText: 'p2', headline: 'h2' },
          { primaryText: 'p3', headline: 'h3' },
        ]),
      },
    });

    await service.generate(buildRequest());

    expect(client.lastPrompts?.userPrompt).toContain('Sin precio referencial');
    expect(client.lastPrompts?.userPrompt).not.toContain('$0');
    expect(client.lastPrompts?.userPrompt).not.toContain('desde $0');
  });

  it('el system prompt exige hashtags, formato CLP y dirección fija', async () => {
    installPrisma();
    const { service, client } = buildService({
      response: {
        parsed: buildSuggestionsResponse([
          { primaryText: 'p1', headline: 'h1' },
          { primaryText: 'p2', headline: 'h2' },
          { primaryText: 'p3', headline: 'h3' },
        ]),
      },
    });

    await service.generate(buildRequest());

    const systemPrompt = client.lastPrompts?.systemPrompt ?? '';
    expect(systemPrompt.toLowerCase()).toContain('hashtag');
    expect(systemPrompt).toMatch(/CLP|\$\d+/);
    // El system prompt debe exigir la dirección fija
    expect(systemPrompt).toContain('Las Condes · Centro Comercial Omnium');
    expect(systemPrompt).toContain('Atención exclusiva con agenda previa.');
  });

  it('el system prompt recalca que el servicio es personalizado y exige la palabra "desde" antes del precio', async () => {
    installPrisma();
    const { service, client } = buildService({
      response: {
        parsed: buildSuggestionsResponse([
          { primaryText: 'p1', headline: 'h1' },
          { primaryText: 'p2', headline: 'h2' },
          { primaryText: 'p3', headline: 'h3' },
        ]),
      },
    });

    await service.generate(buildRequest());

    const systemPrompt = client.lastPrompts?.systemPrompt ?? '';
    // El system prompt debe recalcar la personalización
    expect(systemPrompt.toLowerCase()).toContain('personalizado');
    // El system prompt debe exigir la palabra "desde" antes del precio
    expect(systemPrompt.toLowerCase()).toMatch(/desde\s+\$\d/);
    // El system prompt debe indicar que el primaryText termina con la dirección
    expect(systemPrompt).toMatch(/primaryText[\s\S]{0,400}termina/i);
    expect(systemPrompt).toContain('Atención exclusiva con agenda previa.');
  });

  it('incluye la dirección fija del negocio en el user prompt', async () => {
    installPrisma();
    const { service, client } = buildService({
      response: {
        parsed: buildSuggestionsResponse([
          { primaryText: 'p1', headline: 'h1' },
          { primaryText: 'p2', headline: 'h2' },
          { primaryText: 'p3', headline: 'h3' },
        ]),
      },
    });

    await service.generate(buildRequest());

    expect(client.lastPrompts?.userPrompt).toContain('Dirección fija del negocio');
    expect(client.lastPrompts?.userPrompt).toContain('📍 Las Condes · Centro Comercial Omnium');
    expect(client.lastPrompts?.userPrompt).toContain('Atención exclusiva con agenda previa.');
  });

  it('el system prompt refuerza que headline NO puede quedar vacío', async () => {
    installPrisma();
    const { service, client } = buildService({
      response: {
        parsed: buildSuggestionsResponse([
          { primaryText: 'p1', headline: 'h1' },
          { primaryText: 'p2', headline: 'h2' },
          { primaryText: 'p3', headline: 'h3' },
        ]),
      },
    });

    await service.generate(buildRequest());

    const systemPrompt = client.lastPrompts?.systemPrompt ?? '';
    expect(systemPrompt).toContain('headline');
    expect(systemPrompt.toLowerCase()).toMatch(/no vacías|no vacío|no vacía/);
  });

  it('el system prompt refuerza que el primaryText NO menciona el nombre del negocio', async () => {
    installPrisma();
    const { service, client } = buildService({
      response: {
        parsed: buildSuggestionsResponse([
          { primaryText: 'p1', headline: 'h1' },
          { primaryText: 'p2', headline: 'h2' },
          { primaryText: 'p3', headline: 'h3' },
        ]),
      },
    });

    await service.generate(buildRequest());

    const systemPrompt = client.lastPrompts?.systemPrompt ?? '';
    // El system prompt debe mencionar explícitamente la regla de no nombrar la marca.
    expect(systemPrompt.toLowerCase()).toContain('no nombrar');
    // Y debe nombrar el negocio como referencia de lo prohibido.
    expect(systemPrompt).toContain('Blondor');
    // El "primaryText" y el "headline" deben quedar explícitamente incluidos en la prohibición.
    expect(systemPrompt).toMatch(/primaryText[\s\S]{0,300}headline[\s\S]{0,300}no nombrar|no nombrar[\s\S]{0,300}primaryText[\s\S]{0,300}headline|no nombrar[\s\S]{0,300}headline[\s\S]{0,300}primaryText/iu);
    // La marca SOLO debe poder aparecer en hashtags y en la línea de ubicación 📍.
    expect(systemPrompt.toLowerCase()).toContain('hashtag');
    expect(systemPrompt).toContain('Las Condes · Centro Comercial Omnium');
  });

  it('INITIAL: añade BUSINESS_LOCATION_NOTE al final si el primaryText del modelo no la trae', async () => {
    installPrisma();
    const { service } = buildService({
      response: {
        parsed: buildSuggestionsResponse(
          [
            { primaryText: 'Texto sin dirección', headline: 'Titular uno' },
            { primaryText: 'Otra propuesta sin dirección', headline: 'Titular dos' },
            { primaryText: 'Tercera propuesta sin dirección', headline: 'Titular tres' },
          ],
          'INITIAL',
        ),
      },
    });

    const result = await service.generate(buildRequest({ mode: 'INITIAL' }));

    expect(result.mode).toBe('INITIAL');
    expect(result.suggestions).toHaveLength(3);
    for (const suggestion of result.suggestions) {
      expect(suggestion.primaryText.endsWith(BUSINESS_LOCATION_NOTE + '\n')).toBe(true);
      expect(suggestion.primaryText.length).toBeLessThanOrEqual(PRIMARY_TEXT_MAX);
    }
  });

  it('REGENERATE_PRIMARY_TEXT: añade BUSINESS_LOCATION_NOTE al final si el primaryText del modelo no la trae', async () => {
    installPrisma();
    const currentHeadline = 'Titular fijo';
    const { service } = buildService({
      response: {
        parsed: buildSuggestionsResponse(
          [
            { primaryText: 'Texto variante uno sin dirección', headline: currentHeadline },
            { primaryText: 'Texto variante dos sin dirección', headline: currentHeadline },
            { primaryText: 'Texto variante tres sin dirección', headline: currentHeadline },
          ],
          'REGENERATE_PRIMARY_TEXT',
        ),
      },
    });

    const result = await service.generate(
      buildRequest({
        mode: 'REGENERATE_PRIMARY_TEXT',
        currentCopy: {
          primaryText: 'Texto original del operador.',
          headline: currentHeadline,
        },
      }),
    );

    expect(result.mode).toBe('REGENERATE_PRIMARY_TEXT');
    expect(result.suggestions).toHaveLength(3);
    for (const suggestion of result.suggestions) {
      expect(suggestion.headline).toBe(currentHeadline);
      expect(suggestion.primaryText.endsWith(BUSINESS_LOCATION_NOTE + '\n')).toBe(true);
    }
  });

  it('REGENERATE_HEADLINE: NO modifica el primaryText (lo deja intacto)', async () => {
    installPrisma();
    const currentPrimary = 'Texto fijo del operador sin dirección';
    const { service } = buildService({
      response: {
        parsed: buildSuggestionsResponse(
          [
            { primaryText: currentPrimary, headline: 'Titular uno' },
            { primaryText: currentPrimary, headline: 'Titular dos' },
            { primaryText: currentPrimary, headline: 'Titular tres' },
          ],
          'REGENERATE_HEADLINE',
        ),
      },
    });

    const result = await service.generate(
      buildRequest({
        mode: 'REGENERATE_HEADLINE',
        currentCopy: {
          primaryText: currentPrimary,
          headline: 'Titular original',
        },
      }),
    );

    expect(result.mode).toBe('REGENERATE_HEADLINE');
    expect(result.suggestions).toHaveLength(3);
    for (const suggestion of result.suggestions) {
      expect(suggestion.primaryText).toBe(currentPrimary);
    }
  });

  it('construye el businessLocationNote desde el perfil usando getDisplayLocation()', async () => {
    installPrisma();
    const profileMock = buildBusinessProfileServiceMock({
      addressLine: 'Centro Comercial Omnium, Local 12',
      neighborhood: 'Las Condes',
      regionCutCode: '13',
      communeCutCode: '13114',
      regionName: 'Región Metropolitana de Santiago',
      communeName: 'Las Condes',
      countryCode: 'CL',
      profileCompletedAt: new Date(),
    });
    (profileMock.getDisplayLocation as jest.Mock).mockReturnValue(
      'Centro Comercial Omnium, Local 12, Las Condes, Región Metropolitana de Santiago',
    );
    const { service, client } = buildService({
      profile: profileMock,
      response: {
        parsed: buildSuggestionsResponse([
          { primaryText: 'Texto base', headline: 'Titular uno' },
          { primaryText: 'Texto base', headline: 'Titular dos' },
          { primaryText: 'Texto base', headline: 'Titular tres' },
        ]),
      },
    });

    await service.generate(buildRequest());

    expect(client.lastPrompts?.userPrompt).toContain(
      '📍 Centro Comercial Omnium, Local 12, Las Condes, Región Metropolitana de Santiago',
    );
    // El fallback queda como respaldo si el perfil está vacío
    const fallbackService = new CreativeRecommendationsService(
      new BusinessContextResolver(),
      openAIClientMock as unknown as Parameters<typeof CreativeRecommendationsService>[1],
      buildBusinessProfileServiceMock(),
    );
    openAIClientMock.response = {
      parsed: buildSuggestionsResponse([
        { primaryText: 'Texto base', headline: 'a' },
        { primaryText: 'Texto base', headline: 'b' },
        { primaryText: 'Texto base', headline: 'c' },
      ]) as unknown as Record<string, unknown>,
      raw: {} as never,
      usage: baseUsage,
    };
    await fallbackService.generate(buildRequest());
    expect(client.lastPrompts?.userPrompt).toContain('📍 Las Condes · Centro Comercial Omnium');
  });

  it('anexa las restricciones del BusinessProfile (emoji semantics + wordsToAvoid) al system prompt', async () => {
    installPrisma();
    const { service, client } = buildService({
      profile: buildBusinessProfileServiceMock({
        preferredEmojiSemantics: ['✨', '🤍'],
        wordsToAvoid: ['oferta', 'descuento'],
        profileCompletedAt: new Date(),
      }),
      response: {
        parsed: buildSuggestionsResponse([
          { primaryText: 'Texto base', headline: 'Titular uno' },
          { primaryText: 'Texto base', headline: 'Titular dos' },
          { primaryText: 'Texto base', headline: 'Titular tres' },
        ]),
      },
    });

    await service.generate(buildRequest());

    const systemPrompt = client.lastPrompts?.systemPrompt ?? '';
    expect(systemPrompt).toContain('Reglas dinámicas del BusinessProfile');
    expect(systemPrompt).toContain('Iconografía del negocio');
    expect(systemPrompt).toContain('Vocabulario prohibido por el negocio');
    expect(systemPrompt).toContain('"oferta"');
    expect(systemPrompt).toContain('"descuento"');
  });

  it('prependa brandVoiceKeywords y anexa primaryCustomerProfile + commonObjections al user prompt', async () => {
    installPrisma();
    const { service, client } = buildService({
      profile: buildBusinessProfileServiceMock({
        brandVoiceKeywords: ['cercano', 'experto'],
        primaryCustomerProfile: 'Mujeres 30-45 que quieren un cambio sutil y luminoso.',
        commonObjections: ['No tengo tiempo', 'Tengo miedo a dañar mi cabello'],
        profileCompletedAt: new Date(),
      }),
      response: {
        parsed: buildSuggestionsResponse([
          { primaryText: 'Texto base', headline: 'Titular uno' },
          { primaryText: 'Texto base', headline: 'Titular dos' },
          { primaryText: 'Texto base', headline: 'Titular tres' },
        ]),
      },
    });

    await service.generate(buildRequest());

    const userPrompt = client.lastPrompts?.userPrompt ?? '';
    expect(userPrompt).toContain('Voz de marca del negocio');
    expect(userPrompt).toContain('- cercano');
    expect(userPrompt).toContain('- experto');
    expect(userPrompt).toContain('Cliente ideal del negocio');
    expect(userPrompt).toContain('Mujeres 30-45 que quieren un cambio sutil y luminoso.');
    expect(userPrompt).toContain('Objeciones reales');
    expect(userPrompt).toContain('- No tengo tiempo');
    expect(userPrompt).toContain('- Tengo miedo a dañar mi cabello');
  });

  it('NO inyecta reglas dinámicas cuando el perfil no aporta restricciones', async () => {
    installPrisma();
    const { service, client } = buildService({
      response: {
        parsed: buildSuggestionsResponse([
          { primaryText: 'Texto base', headline: 'Titular uno' },
          { primaryText: 'Texto base', headline: 'Titular dos' },
          { primaryText: 'Texto base', headline: 'Titular tres' },
        ]),
      },
    });

    await service.generate(buildRequest());

    const systemPrompt = client.lastPrompts?.systemPrompt ?? '';
    expect(systemPrompt).not.toContain('Reglas dinámicas del BusinessProfile');
    expect(systemPrompt).toContain('📍 Las Condes · Centro Comercial Omnium');
  });
});
