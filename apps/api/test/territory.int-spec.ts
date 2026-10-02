import './setup';
import request from 'supertest';
import { Test, type TestingModule } from '@nestjs/testing';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { OPENAI_CLIENT } from '../src/modules/analyze/analyze.tokens';

/**
 * Tests de integración del catálogo territorial.
 *
 * Cargan el `AppModule` completo y verifican el contrato HTTP real de
 * los endpoints públicos. Como el resto del `AppModule` requiere
 * Prisma + OpenAI para arrancar, mockeamos `OPENAI_CLIENT` con un
 * stub no-op para evitar tráfico de red en CI (igual que en
 * `analyze.int-spec.ts`).
 *
 * Los endpoints de territorio NO requieren autenticación, así que
 * ninguna request lleva token.
 */

const API_PREFIX = process.env.API_PREFIX ?? 'api/v1';

interface RegionDto {
  cutCode: string;
  name: string;
  iso3166: string;
  capital: string;
}

interface CommuneDto {
  cutCode: string;
  name: string;
  regionCutCode: string;
}

interface RegionsResponse {
  regions: RegionDto[];
}

interface CommunesResponse {
  region?: RegionDto;
  communes?: CommuneDto[];
  query?: string;
  regionFilter?: string | null;
  communes_?: CommuneDto[];
}

interface CommuneDetailResponse {
  commune: CommuneDto;
  region: RegionDto | null;
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
        throw new Error('OpenAI deshabilitado en tests de territory');
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

describe('GET /territory (integration)', () => {
  it('GET /territory/regions devuelve las 16 regiones ordenadas por CUT', async () => {
    const { app } = await buildApp();
    try {
      const res = await request(app.getHttpServer())
        .get(`/${API_PREFIX}/territory/regions`)
        .expect(200);

      const body = res.body as RegionsResponse;
      expect(Array.isArray(body.regions)).toBe(true);
      expect(body.regions).toHaveLength(16);

      const codes = body.regions.map((r) => r.cutCode);
      const sorted = [...codes].sort();
      expect(codes).toEqual(sorted);

      const rm = body.regions.find((r) => r.name.includes('Metropolitana'));
      expect(rm?.cutCode).toBe('13');
    } finally {
      await app.close();
    }
  });

  it('GET /territory/regions/13/communes devuelve la lista real de la RM', async () => {
    const { app } = await buildApp();
    try {
      const res = await request(app.getHttpServer())
        .get(`/${API_PREFIX}/territory/regions/13/communes`)
        .expect(200);

      const body = res.body as { region: RegionDto; communes: CommuneDto[] };
      expect(body.region.cutCode).toBe('13');
      expect(body.region.name).toContain('Metropolitana');
      expect(Array.isArray(body.communes)).toBe(true);
      expect(body.communes).toHaveLength(52);

      const names = body.communes.map((c) => c.name);
      expect(names).toEqual(
        expect.arrayContaining([
          'Las Condes',
          'Providencia',
          'Maipú',
          'Santiago',
          'Ñuñoa',
          'Vitacura',
        ]),
      );
      for (const c of body.communes) {
        expect(c.regionCutCode).toBe('13');
      }
    } finally {
      await app.close();
    }
  });

  it('GET /territory/regions/99/communes → 404 cuando la región no existe', async () => {
    const { app } = await buildApp();
    try {
      await request(app.getHttpServer())
        .get(`/${API_PREFIX}/territory/regions/99/communes`)
        .expect(404);
    } finally {
      await app.close();
    }
  });

  it('GET /territory/communes?query=las&region=13 devuelve al menos Las Condes', async () => {
    const { app } = await buildApp();
    try {
      const res = await request(app.getHttpServer())
        .get(`/${API_PREFIX}/territory/communes`)
        .query({ query: 'las', region: '13' })
        .expect(200);

      const body = res.body as {
        query: string;
        region: string | null;
        communes: CommuneDto[];
      };
      expect(body.query).toBe('las');
      expect(body.region).toBe('13');
      expect(Array.isArray(body.communes)).toBe(true);
      expect(body.communes.length).toBeGreaterThanOrEqual(1);
      const names = body.communes.map((c) => c.name);
      expect(names).toEqual(expect.arrayContaining(['Las Condes']));
    } finally {
      await app.close();
    }
  });

  it('GET /territory/communes/:cut devuelve la ficha de Las Condes y su región', async () => {
    const { app } = await buildApp();
    try {
      const res = await request(app.getHttpServer())
        .get(`/${API_PREFIX}/territory/communes/13114`)
        .expect(200);

      const body = res.body as CommuneDetailResponse;
      expect(body.commune.cutCode).toBe('13114');
      expect(body.commune.name).toBe('Las Condes');
      expect(body.commune.regionCutCode).toBe('13');
      expect(body.region?.cutCode).toBe('13');
    } finally {
      await app.close();
    }
  });

  it('GET /territory/communes/99999 → 404 cuando la comuna no existe', async () => {
    const { app } = await buildApp();
    try {
      await request(app.getHttpServer())
        .get(`/${API_PREFIX}/territory/communes/99999`)
        .expect(404);
    } finally {
      await app.close();
    }
  });
});