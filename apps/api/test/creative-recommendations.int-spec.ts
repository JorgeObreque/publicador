import './setup';
import request from 'supertest';
import { Test, type TestingModule } from '@nestjs/testing';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { MediaAssetKind, MediaAssetSource, MediaAssetStatus } from '@prisma/client';
import { prisma } from '@publicador/database';
import { AppModule } from '../src/app.module';
import { OPENAI_CLIENT } from '../src/modules/analyze/analyze.tokens';
import { BUSINESS_PROFILE_SERVICE } from '../src/modules/business-profile/business-profile.tokens';
import type {
  OpenAISummaryPrompt,
  OpenAISummaryResult,
  OpenAISummarizer,
} from '../src/modules/analyze/openai.client';
import type { RecommendationMode } from '../src/modules/creative-recommendations/creative-recommendations.types';
import { BUSINESS_LOCATION_NOTE } from '../src/modules/creative-recommendations/creative-recommendations.prompt';

const BUSINESS_ID = process.env.BUSINESS_ID ?? 'test-business';
const API_PREFIX = process.env.API_PREFIX ?? 'api/v1';

interface MockOverrides {
  configured?: boolean;
  model?: string;
  response?: OpenAISummaryResult;
  error?: Error;
}

interface SuggestionPayload {
  primaryText: string;
  headline: string;
}

const createMockClient = (overrides: MockOverrides = {}) => {
  const configured = overrides.configured ?? true;
  const model = overrides.model ?? 'gpt-mock';
  const response = overrides.response ?? {
    parsed: defaultParsedSuggestions('INITIAL'),
    raw: {} as never,
    usage: { promptTokens: 320, completionTokens: 180, totalTokens: 500, model: 'gpt-4o-mini' },
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
    getModel: jest.fn(() => model),
    summarize,
  };

  return client;
};

// Helper: construye un primaryText con la estructura obligatoria del nuevo prompt.
const buildPrimaryText = (
  priceLine: string | null,
  hashtagSet: string,
  index: number,
): string => {
  const header = `✨ Visos e iluminación personalizada | Blondor Peluquería`;
  const description =
    'Servicio personalizado: evaluamos tu cabello y diseñamos la iluminación ideal para ti.';
  const priceBlock = priceLine
    ? `${priceLine}\nValor sujeto a evaluación según largo, cantidad y técnica.`
    : '';
  const bullets = [
    '- 🤍 Asesoría personalizada.',
    '- 🤍 Diagnóstico capilar.',
    '- 🤍 Resultado natural.',
  ].join('\n');
  const cta = index === 1 ? '📩 Escríbenos por WhatsApp.' : '✨ Reserva tu evaluación.';
  const hashtags = hashtagSet;
  return [header, description, priceBlock, bullets, cta, hashtags, BUSINESS_LOCATION_NOTE]
    .filter((line) => line.length > 0)
    .join('\n');
};

const defaultParsedSuggestions = (mode: RecommendationMode): Record<string, unknown> => ({
  mode,
  suggestions: [
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
  ],
});

const regenerateParsedSuggestions = (
  mode: 'REGENERATE_PRIMARY_TEXT' | 'REGENERATE_HEADLINE',
  keepHeadline: string,
  keepPrimaryText: string,
): Record<string, unknown> => ({
  mode,
  suggestions: [
    mode === 'REGENERATE_PRIMARY_TEXT'
      ? {
          primaryText: buildPrimaryText(
            'desde $55.000',
            '#Blondor #CorteModerno #EstiloPersonalizado #CabelloSano',
            0,
          ),
          headline: keepHeadline,
        }
      : {
          primaryText: keepPrimaryText,
          headline: 'Variante uno: tu mejor versión',
        },
    mode === 'REGENERATE_PRIMARY_TEXT'
      ? {
          primaryText: buildPrimaryText(
            'desde $55.000',
            '#Blondor #CorteFresco #LookNuevo #Personalizado #CabelloSano',
            0,
          ),
          headline: keepHeadline,
        }
      : {
          primaryText: keepPrimaryText,
          headline: 'Variante dos: estilo a tu medida',
        },
    mode === 'REGENERATE_PRIMARY_TEXT'
      ? {
          primaryText: buildPrimaryText(
            'desde $55.000',
            '#Blondor #Visagismo #CortePersonalizado #Mirada #CabelloSano',
            0,
          ),
          headline: keepHeadline,
        }
      : {
          primaryText: keepPrimaryText,
          headline: 'Variante tres: corte con propósito',
        },
  ],
});

const buildApp = async (
  overrides: MockOverrides = {},
): Promise<{ app: INestApplication; client: ReturnType<typeof createMockClient> }> => {
  const client = createMockClient(overrides);
  // Mock determinista de `BusinessProfileService` que devuelve un perfil
  // vacío (mismo comportamiento que la implementación real con un operador
  // que aún no ha editado el perfil). Esto evita que la integración
  // dependa del estado del dev DB y mantiene 0 llamadas a OpenAI.
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

interface SeedOptions {
  serviceId?: string;
  mediaAssetId?: string;
  otherBusinessId?: string;
}

const seedFixtures = async (options: SeedOptions = {}): Promise<{
  serviceId: string;
  mediaAssetId: string;
}> => {
  const serviceId =
    options.serviceId ??
    (await prisma.service.create({
      data: {
        businessId: BUSINESS_ID,
        name: 'Corte y peinado',
        description: 'Servicio principal de la peluquería.',
        price: '15990.00',
        currency: 'CLP',
        duration: 60,
      },
      select: { id: true },
    })).id;

  const mediaAssetId =
    options.mediaAssetId ??
    (await prisma.mediaAsset.create({
      data: {
        businessId: BUSINESS_ID,
        source: MediaAssetSource.URL,
        kind: MediaAssetKind.IMAGE,
        externalFileId: 'file-test-1',
        externalFolderId: null,
        externalFolderKey: null,
        externalLink: 'https://example.com/local.jpg',
        name: 'local.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 1024,
        status: MediaAssetStatus.READY,
      },
      select: { id: true },
    })).id;

  if (options.otherBusinessId) {
    await prisma.business.create({
      data: { id: options.otherBusinessId, name: 'Other Business' },
    });
    await prisma.service.create({
      data: {
        businessId: options.otherBusinessId,
        name: 'Servicio ajeno',
        price: '100.00',
        currency: 'CLP',
      },
    });
    await prisma.mediaAsset.create({
      data: {
        businessId: options.otherBusinessId,
        source: MediaAssetSource.URL,
        kind: MediaAssetKind.IMAGE,
        externalFileId: 'file-other-1',
        name: 'other.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 256,
        status: MediaAssetStatus.READY,
      },
    });
  }

  return { serviceId, mediaAssetId };
};

describe('POST /creatives/recommendations (integration)', () => {
  it('genera 3 sugerencias INITIAL con copy vacía y llama al cliente exactamente una vez', async () => {
    const { serviceId, mediaAssetId } = await seedFixtures();

    const { app, client } = await buildApp();
    try {
      const res = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/creatives/recommendations`)
        .send({
          mode: 'INITIAL',
          serviceId,
          mediaAssetId,
        })
        .expect(201);

      expect(res.body.mode).toBe('INITIAL');
      expect(Array.isArray(res.body.suggestions)).toBe(true);
      expect(res.body.suggestions).toHaveLength(3);
      for (const suggestion of res.body.suggestions as SuggestionPayload[]) {
        expect(typeof suggestion.primaryText).toBe('string');
        expect(suggestion.primaryText.length).toBeGreaterThan(0);
        expect(suggestion.primaryText.length).toBeLessThanOrEqual(2000);
        expect(typeof suggestion.headline).toBe('string');
        expect(suggestion.headline.length).toBeGreaterThan(0);
        expect(suggestion.headline.length).toBeLessThanOrEqual(80);
        // No debe existir el campo description en la respuesta
        expect((suggestion as Record<string, unknown>)['description']).toBeUndefined();
        // El primaryText debe terminar con la dirección fija (canónica, con '\n' final)
        expect(suggestion.primaryText.endsWith(BUSINESS_LOCATION_NOTE + '\n')).toBe(true);
      }
      // El nuevo contrato exige hashtags en primaryText y prohíbe emojis en headline.
      const firstSuggestion = res.body.suggestions[0] as SuggestionPayload;
      expect(firstSuggestion.primaryText).toMatch(/#\w+/);
      expect(firstSuggestion.headline).not.toMatch(
        /[\u{1F300}-\u{1FAFF}\u{1F600}-\u{1F64F}\u{1F900}-\u{1F9FF}\u{2600}-\u{27BF}]/u,
      );
      expect(res.body.usage).toBeUndefined();

      expect(client.summarize).toHaveBeenCalledTimes(1);
      // El userPrompt debe incluir la dirección fija del negocio y la regla de personalización
      const promptsArg = client.summarize.mock.calls[0]?.[1] as OpenAISummaryPrompt | undefined;
      expect(promptsArg?.userPrompt).toContain('Dirección fija del negocio');
      expect(promptsArg?.userPrompt).toContain(
        'cada propuesta debe recalcar que el servicio es 100% personalizado',
      );
      expect(promptsArg?.userPrompt).toContain(
        'SIEMPRE termina en la línea "Atención exclusiva con agenda previa."',
      );
    } finally {
      await app.close();
    }
  });

  it('genera 3 sugerencias INITIAL sin pasar la copia actual como contexto (solo campaignNotes)', async () => {
    const { serviceId, mediaAssetId } = await seedFixtures();

    const { app, client } = await buildApp();
    try {
      const res = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/creatives/recommendations`)
        .send({
          mode: 'INITIAL',
          serviceId,
          mediaAssetId,
          currentCopy: {
            primaryText: 'Texto original que el operador quiere mantener cerca.',
            headline: 'Titular original',
          },
          context: {
            campaignNotes: 'Resaltar promo de verano.',
          },
        })
        .expect(201);

      expect(res.body.suggestions).toHaveLength(3);
      expect(client.summarize).toHaveBeenCalledTimes(1);
      // Validamos que los prompts lleguen al cliente con los datos del operador,
      // pero que la copia actual NO se incluya en INITIAL (es solo referencia
      // para los modos REGENERATE_*).
      const promptsArg = client.summarize.mock.calls[0]?.[1] as OpenAISummaryPrompt | undefined;
      expect(promptsArg?.userPrompt).not.toContain(
        'Texto original que el operador quiere mantener cerca.',
      );
      expect(promptsArg?.userPrompt).toContain('Resaltar promo de verano.');
    } finally {
      await app.close();
    }
  });

  it('rechaza con 400 cuando currentCopy trae un campo desconocido (description)', async () => {
    const { serviceId, mediaAssetId } = await seedFixtures();

    const { app, client } = await buildApp();
    try {
      const res = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/creatives/recommendations`)
        .send({
          mode: 'INITIAL',
          serviceId,
          mediaAssetId,
          currentCopy: {
            primaryText: 'Texto',
            headline: 'Titular',
            description: 'Descripción prohibida',
          },
        });

      expect(res.status).toBe(400);
      expect(client.summarize).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('genera 3 textos alternativos en REGENERATE_PRIMARY_TEXT conservando headline', async () => {
    const { serviceId, mediaAssetId } = await seedFixtures();
    const headline = 'Titular que se mantiene';

    const { app } = await buildApp({
      response: {
        parsed: regenerateParsedSuggestions(
          'REGENERATE_PRIMARY_TEXT',
          headline,
          'Texto original',
        ),
        raw: {} as never,
        usage: { promptTokens: 250, completionTokens: 150, totalTokens: 400, model: 'gpt-4o-mini' },
      },
    });
    try {
      const res = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/creatives/recommendations`)
        .send({
          mode: 'REGENERATE_PRIMARY_TEXT',
          serviceId,
          mediaAssetId,
          currentCopy: {
            primaryText: 'Texto original',
            headline,
          },
        })
        .expect(201);

      expect(res.body.mode).toBe('REGENERATE_PRIMARY_TEXT');
      expect(res.body.suggestions).toHaveLength(3);
      for (const suggestion of res.body.suggestions as SuggestionPayload[]) {
        expect(suggestion.headline).toBe(headline);
        expect(suggestion.primaryText).not.toBe('Texto original');
        // Cada variante debe cerrar con la dirección fija (canónica, con '\n' final)
        expect(suggestion.primaryText.endsWith(BUSINESS_LOCATION_NOTE + '\n')).toBe(true);
      }
    } finally {
      await app.close();
    }
  });

  it('genera 3 títulos alternativos en REGENERATE_HEADLINE conservando primaryText', async () => {
    const { serviceId, mediaAssetId } = await seedFixtures();
    const primaryText =
      'Servicio personalizado | Blondor Peluquería\nAtención cercana.\n🤍 Asesoría.\n✨ Reserva.\n#Blondor #Estilo\n📍 Las Condes · Centro Comercial Omnium\nAtención exclusiva con agenda previa.';

    const { app } = await buildApp({
      response: {
        parsed: regenerateParsedSuggestions(
          'REGENERATE_HEADLINE',
          'Titular original',
          primaryText,
        ),
        raw: {} as never,
        usage: { promptTokens: 200, completionTokens: 100, totalTokens: 300, model: 'gpt-4o-mini' },
      },
    });
    try {
      const res = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/creatives/recommendations`)
        .send({
          mode: 'REGENERATE_HEADLINE',
          serviceId,
          mediaAssetId,
          currentCopy: {
            primaryText,
            headline: 'Titular original',
          },
        })
        .expect(201);

      expect(res.body.mode).toBe('REGENERATE_HEADLINE');
      expect(res.body.suggestions).toHaveLength(3);
      for (const suggestion of res.body.suggestions as SuggestionPayload[]) {
        expect(suggestion.primaryText).toBe(primaryText);
        expect(suggestion.headline).not.toBe('Titular original');
      }
    } finally {
      await app.close();
    }
  });

  it('responde 503 cuando el cliente OpenAI no está configurado', async () => {
    const { serviceId, mediaAssetId } = await seedFixtures();

    const { app, client } = await buildApp({ configured: false });
    try {
      const res = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/creatives/recommendations`)
        .send({ mode: 'INITIAL', serviceId, mediaAssetId });

      expect(res.status).toBe(503);
      const message: string = res.body.message ?? '';
      expect(message.toUpperCase()).toEqual(expect.stringContaining('OPENAI'));
      expect(client.summarize).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('responde 400 cuando serviceId no pertenece al negocio actual', async () => {
    await seedFixtures({ otherBusinessId: 'other-business' });

    const { app, client } = await buildApp();
    try {
      const res = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/creatives/recommendations`)
        .send({
          mode: 'INITIAL',
          serviceId: 'svc-inexistente',
          mediaAssetId: 'asset-inexistente',
        });

      expect(res.status).toBe(400);
      const message: string = res.body.message ?? '';
      expect(message.toLowerCase()).toContain('servicio');
      expect(client.summarize).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('responde 400 cuando mediaAssetId pertenece a otro negocio', async () => {
    const otherBusinessId = 'foreign-business';
    await prisma.business.create({
      data: { id: otherBusinessId, name: 'Foreign Business' },
    });
    const otherMediaAsset = await prisma.mediaAsset.create({
      data: {
        businessId: otherBusinessId,
        source: MediaAssetSource.URL,
        kind: MediaAssetKind.IMAGE,
        externalFileId: 'file-foreign-1',
        name: 'foreign.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 100,
        status: MediaAssetStatus.READY,
      },
      select: { id: true },
    });

    const { serviceId } = await seedFixtures();

    const { app, client } = await buildApp();
    try {
      const res = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/creatives/recommendations`)
        .send({
          mode: 'INITIAL',
          serviceId,
          mediaAssetId: otherMediaAsset.id,
        });

      expect(res.status).toBe(400);
      const message: string = res.body.message ?? '';
      expect(message.toLowerCase()).toContain('mediaasset');
      expect(client.summarize).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('INITIAL: el primaryText de cada sugerencia termina con la dirección fija del negocio', async () => {
    const { serviceId, mediaAssetId } = await seedFixtures();

    const { app } = await buildApp();
    try {
      const res = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/creatives/recommendations`)
        .send({ mode: 'INITIAL', serviceId, mediaAssetId })
        .expect(201);

      const suggestions = res.body.suggestions as SuggestionPayload[];
      expect(suggestions).toHaveLength(3);
      for (const suggestion of suggestions) {
        // El primaryText debe terminar exactamente con la línea de cierre (canónica, con '\n' final)
        expect(suggestion.primaryText.endsWith(BUSINESS_LOCATION_NOTE + '\n')).toBe(true);
        // Y debe contener la línea con 📍 justo antes de la línea de cierre
        const lines = suggestion.primaryText
          .split('\n')
          .filter((line) => line.length > 0);
        const lastIdx = lines.length - 1;
        expect(lines[lastIdx]).toBe('Atención exclusiva con agenda previa.');
        expect(lines[lastIdx - 1]).toBe('📍 Las Condes · Centro Comercial Omnium');
        // Debe existir al menos una línea de hashtags (>= 2 hashtags)
        const hashtagLines = lines.filter((line) => /#\S+(?:\s+#\S+)+/u.test(line));
        expect(hashtagLines.length).toBeGreaterThan(0);
      }
    } finally {
      await app.close();
    }
  });

  it('verifica que summarize se llama exactamente una vez por request', async () => {
    const { serviceId, mediaAssetId } = await seedFixtures();

    const { app, client } = await buildApp();
    try {
      const res = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/creatives/recommendations`)
        .send({ mode: 'INITIAL', serviceId, mediaAssetId })
        .expect(201);

      expect(res.body.suggestions).toHaveLength(3);
      expect(client.summarize).toHaveBeenCalledTimes(1);
    } finally {
      await app.close();
    }
  });

  it('rechaza con 400 cuando el body no cumple el esquema Zod', async () => {
    const { serviceId, mediaAssetId } = await seedFixtures();
    const { app, client } = await buildApp();
    try {
      const res = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/creatives/recommendations`)
        .send({
          mode: 'NO_EXISTE',
          serviceId,
          mediaAssetId,
        });

      expect(res.status).toBe(400);
      expect(client.summarize).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('lanza 503 cuando OpenAI devuelve menos de 3 sugerencias', async () => {
    const { serviceId, mediaAssetId } = await seedFixtures();

    const { app } = await buildApp({
      response: {
        parsed: {
          suggestions: [
            {
              primaryText: 'p1',
              headline: 'h1',
            },
          ],
        },
        raw: {} as never,
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2, model: 'gpt-4o-mini' },
      },
    });
    try {
      const res = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/creatives/recommendations`)
        .send({ mode: 'INITIAL', serviceId, mediaAssetId });

      expect(res.status).toBe(503);
      const message: string = res.body.message ?? '';
      expect(message).toEqual(expect.stringContaining('sugerencias'));
    } finally {
      await app.close();
    }
  });
});
