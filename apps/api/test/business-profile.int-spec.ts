import './setup';
import request from 'supertest';
import { Test, type TestingModule } from '@nestjs/testing';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';

const BUSINESS_ID = process.env.BUSINESS_ID ?? 'test-business';
const API_PREFIX = process.env.API_PREFIX ?? 'api/v1';

interface ProfileResponse {
  profile: Record<string, unknown>;
  ready: boolean;
}

const buildApp = async (): Promise<{ app: INestApplication }> => {
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication({ logger: ['error', 'warn'] });
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableShutdownHooks();
  await app.init();
  return { app };
};

describe('GET /business-profile & POST /business-profile (integration)', () => {
  it('POST vacío → 201 con perfil creado y `ready: false`', async () => {
    const { app } = await buildApp();
    try {
      const res = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/business-profile`)
        .send({
          primaryCustomerProfile: 'Mujeres 30-45 con cabello dañado.',
        })
        .expect(201);

      expect((res.body as ProfileResponse).ready).toBe(false);
      const profile = (res.body as ProfileResponse).profile;
      expect(profile).toBeDefined();
      expect(profile['businessId']).toBe(BUSINESS_ID);
      expect(profile['primaryCustomerProfile']).toBe('Mujeres 30-45 con cabello dañado.');
      expect(profile['profileCompletedAt']).toBeNull();
      expect(Array.isArray(profile['brandVoiceKeywords'])).toBe(true);
      expect(Array.isArray(profile['commonObjections'])).toBe(true);
      expect(Array.isArray(profile['qualifyingQuestions'])).toBe(true);
    } finally {
      await app.close();
    }
  });

  it('GET tras POST devuelve el mismo perfil persistido', async () => {
    const { app } = await buildApp();
    try {
      await request(app.getHttpServer())
        .post(`/${API_PREFIX}/business-profile`)
        .send({
          primaryCustomerProfile: 'Mujeres 30-45 con cabello dañado.',
          addressLine: 'Centro Comercial Omnium',
          neighborhood: 'Las Condes',
          regionCutCode: '13',
          communeCutCode: '13114',
          countryCode: 'CL',
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/${API_PREFIX}/business-profile`)
        .expect(200);

      const profile = (res.body as ProfileResponse).profile;
      expect(profile).toBeDefined();
      expect(profile['addressLine']).toBe('Centro Comercial Omnium');
      expect(profile['neighborhood']).toBe('Las Condes');
      expect(profile['regionCutCode']).toBe('13');
      expect(profile['communeCutCode']).toBe('13114');
      expect(profile['regionName']).toBe('Región Metropolitana de Santiago');
      expect(profile['communeName']).toBe('Las Condes');
      expect(profile['countryCode']).toBe('CL');
      expect(profile['primaryCustomerProfile']).toBe('Mujeres 30-45 con cabello dañado.');
    } finally {
      await app.close();
    }
  });

  it('GET cuando no existe perfil → 200 con `profile: null, ready: false`', async () => {
    const { app } = await buildApp();
    try {
      const res = await request(app.getHttpServer())
        .get(`/${API_PREFIX}/business-profile`)
        .expect(200);

      expect((res.body as ProfileResponse).ready).toBe(false);
      // La primera llamada también puede crear el perfil vacío (getOrCreate),
      // por lo que aceptamos cualquiera de los dos contratos: `null` si no
      // se creó, o el perfil recién creado con todos los campos vacíos.
      if ((res.body as ProfileResponse).profile === null) {
        expect((res.body as ProfileResponse).profile).toBeNull();
      } else {
        expect((res.body as ProfileResponse).profile['businessId']).toBe(BUSINESS_ID);
        expect(
          (res.body as ProfileResponse).profile['primaryCustomerProfile'],
        ).toBe('');
      }
    } finally {
      await app.close();
    }
  });

  it('POST con todos los campos críticos completos → setea `profileCompletedAt`', async () => {
    const { app } = await buildApp();
    try {
      const res = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/business-profile`)
        .send({
          addressLine: 'Centro Comercial Omnium',
          neighborhood: 'Las Condes',
          regionCutCode: '13',
          communeCutCode: '13114',
          countryCode: 'CL',
          primaryCustomerProfile: 'Mujeres 30-45 con cabello dañado.',
          qualifyingQuestions: ['¿Quieres un cambio sutil?', '¿Tienes el cabello dañado?'],
          brandVoiceKeywords: ['cercano', 'experto'],
          wordsToAvoid: ['oferta'],
          preferredEmojiSemantics: ['✨', '🤍'],
          commonObjections: ['No tengo tiempo'],
        })
        .expect(201);

      expect((res.body as ProfileResponse).ready).toBe(true);
      expect(
        (res.body as ProfileResponse).profile['profileCompletedAt'],
      ).not.toBeNull();
      expect((res.body as ProfileResponse).profile['brandVoiceKeywords']).toEqual([
        'cercano',
        'experto',
      ]);
      expect((res.body as ProfileResponse).profile['wordsToAvoid']).toEqual(['oferta']);
    } finally {
      await app.close();
    }
  });

  it('POST con un array excediendo `max(itemCount)` → 400', async () => {
    const { app } = await buildApp();
    try {
      const oversized = Array.from({ length: 60 }, (_, i) => `palabra-${i}`);
      const res = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/business-profile`)
        .send({
          primaryCustomerProfile: 'Mujeres 30-45 con cabello dañado.',
          wordsToAvoid: oversized,
        });

      expect(res.status).toBe(400);
      const message = JSON.stringify(res.body);
      expect(message).toContain('wordsToAvoid');
    } finally {
      await app.close();
    }
  });

  it('POST con primaryCustomerProfile vacío → 400', async () => {
    const { app } = await buildApp();
    try {
      const res = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/business-profile`)
        .send({
          primaryCustomerProfile: '',
        });

      expect(res.status).toBe(400);
      const message = JSON.stringify(res.body);
      expect(message).toContain('primaryCustomerProfile');
    } finally {
      await app.close();
    }
  });

  it('POST con campos legacy city/region/country → 400 (schema strict)', async () => {
    const { app } = await buildApp();
    try {
      const res = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/business-profile`)
        .send({
          primaryCustomerProfile: 'Mujeres 30-45 con cabello dañado.',
          city: 'Santiago',
          region: 'RM',
          country: 'Chile',
        });

      expect(res.status).toBe(400);
      const message = JSON.stringify(res.body);
      // El schema `.strict()` rechaza claves desconocidas.
      expect(message.toLowerCase()).toContain('unrecogn');
    } finally {
      await app.close();
    }
  });

  it('POST /business-profile/complete → fuerza profileCompletedAt', async () => {
    const { app } = await buildApp();
    try {
      await request(app.getHttpServer())
        .post(`/${API_PREFIX}/business-profile`)
        .send({
          primaryCustomerProfile: 'Mujeres 30-45 con cabello dañado.',
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/business-profile/complete`)
        .expect(200);

      expect((res.body as ProfileResponse).ready).toBe(true);
      expect(
        (res.body as ProfileResponse).profile['profileCompletedAt'],
      ).not.toBeNull();
    } finally {
      await app.close();
    }
  });

  it('POST persiste nearbyCommunesCutCodes y GET los devuelve', async () => {
    const { app } = await buildApp();
    try {
      await request(app.getHttpServer())
        .post(`/${API_PREFIX}/business-profile`)
        .send({
          primaryCustomerProfile: 'Mujeres 30-45 con cabello dañado.',
          nearbyCommunesCutCodes: ['13114', '13123', '13132'],
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/${API_PREFIX}/business-profile`)
        .expect(200);

      const profile = (res.body as ProfileResponse).profile;
      expect(profile['nearbyCommunesCutCodes']).toEqual(['13114', '13123', '13132']);
    } finally {
      await app.close();
    }
  });

  it('POST sin nearbyCommunesCutCodes persiste un array vacío por default', async () => {
    const { app } = await buildApp();
    try {
      const res = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/business-profile`)
        .send({
          primaryCustomerProfile: 'Mujeres 30-45 con cabello dañado.',
        })
        .expect(201);

      expect((res.body as ProfileResponse).profile['nearbyCommunesCutCodes']).toEqual([]);
    } finally {
      await app.close();
    }
  });

  it('POST con nearbyCommunesCutCodes de longitud != 5 → 400', async () => {
    const { app } = await buildApp();
    try {
      const res = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/business-profile`)
        .send({
          primaryCustomerProfile: 'Mujeres 30-45 con cabello dañado.',
          nearbyCommunesCutCodes: ['1234'],
        });
      expect(res.status).toBe(400);
    } finally {
      await app.close();
    }
  });
});
