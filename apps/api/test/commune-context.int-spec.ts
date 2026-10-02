import './setup';
import request from 'supertest';
import { Test, type TestingModule } from '@nestjs/testing';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { OPENAI_CLIENT } from '../src/modules/analyze/analyze.tokens';

const API_PREFIX = process.env.API_PREFIX ?? 'api/v1';

interface CommuneContextDto {
  cutCode: string;
  population: number;
  adultShare25_55: number;
  avgHouseholdIncomeCLP: number;
  profileDescription: string;
  source: string;
  year: number;
}

interface CommuneDetailDto {
  cutCode: string;
  name: string;
  regionCutCode: string;
}

interface CommuneContextResponse {
  context: CommuneContextDto;
  commune: CommuneDetailDto;
  neighbors: CommuneContextDto[];
}

interface RegionDto {
  cutCode: string;
  name: string;
  iso3166: string;
  capital: string;
}

interface RegionSummaryResponse {
  region: RegionDto;
  totalCommunes: number;
  entries: CommuneContextDto[];
}

const buildApp = async (): Promise<{ app: INestApplication }> => {
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(OPENAI_CLIENT)
    .useValue({
      isConfigured: () => false,
      getModel: () => 'noop',
      summarize: async () => {
        throw new Error('OpenAI deshabilitado en tests de commune-context');
      },
    })
    .compile();
  const app = moduleRef.createNestApplication({ logger: ['error', 'warn'] });
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableShutdownHooks();
  await app.init();
  return { app };
};

describe('GET /commune-context (integration)', () => {
  it('GET /commune-context/communes/13114 devuelve el contexto de Las Condes', async () => {
    const { app } = await buildApp();
    try {
      const res = await request(app.getHttpServer())
        .get(`/${API_PREFIX}/commune-context/communes/13114`)
        .expect(200);

      const body = res.body as CommuneContextResponse;
      expect(body.context.cutCode).toBe('13114');
      expect(body.context.source).toBe('estimación Publicador');
      expect(body.context.year).toBe(2024);
      expect(body.context.avgHouseholdIncomeCLP).toBeGreaterThan(1_500_000);
      expect(body.context.population).toBeGreaterThan(0);
      expect(body.context.adultShare25_55).toBeGreaterThan(0);
      expect(typeof body.context.profileDescription).toBe('string');
      expect(body.context.profileDescription.length).toBeGreaterThan(20);

      expect(body.commune.cutCode).toBe('13114');
      expect(body.commune.name).toBe('Las Condes');
      expect(body.commune.regionCutCode).toBe('13');

      expect(Array.isArray(body.neighbors)).toBe(true);
      expect(body.neighbors).toHaveLength(10);
      expect(body.neighbors.find((n) => n.cutCode === '13114')).toBeUndefined();
    } finally {
      await app.close();
    }
  });

  it('GET /commune-context/communes/99999 → 404 cuando la comuna no existe', async () => {
    const { app } = await buildApp();
    try {
      await request(app.getHttpServer())
        .get(`/${API_PREFIX}/commune-context/communes/99999`)
        .expect(404);
    } finally {
      await app.close();
    }
  });

  it('GET /commune-context/communes/05101 → 404 cuando la comuna existe pero no tiene contexto', async () => {
    const { app } = await buildApp();
    try {
      await request(app.getHttpServer())
        .get(`/${API_PREFIX}/commune-context/communes/05101`)
        .expect(404);
    } finally {
      await app.close();
    }
  });

  it('GET /commune-context/regions/13/summary devuelve 52 comunas para la RM', async () => {
    const { app } = await buildApp();
    try {
      const res = await request(app.getHttpServer())
        .get(`/${API_PREFIX}/commune-context/regions/13/summary`)
        .expect(200);

      const body = res.body as RegionSummaryResponse;
      expect(body.region.cutCode).toBe('13');
      expect(body.region.name).toContain('Metropolitana');
      expect(body.totalCommunes).toBe(52);
      expect(body.entries).toHaveLength(52);

      const cuts = body.entries.map((e) => e.cutCode);
      expect(cuts).toEqual(expect.arrayContaining(['13114', '13119', '13120', '13201']));
      for (const entry of body.entries) {
        expect(entry.source).toBe('estimación Publicador');
        expect(entry.year).toBe(2024);
      }
    } finally {
      await app.close();
    }
  });

  it('GET /commune-context/regions/99/summary → 404 cuando la región no existe', async () => {
    const { app } = await buildApp();
    try {
      await request(app.getHttpServer())
        .get(`/${API_PREFIX}/commune-context/regions/99/summary`)
        .expect(404);
    } finally {
      await app.close();
    }
  });
});