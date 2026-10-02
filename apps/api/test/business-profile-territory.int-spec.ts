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

describe('BusinessProfile territorial validation (integration)', () => {
  it('PUT con regionCutCode inválido → 400', async () => {
    const { app } = await buildApp();
    try {
      const res = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/business-profile`)
        .send({
          primaryCustomerProfile: 'Mujeres 30-45 con cabello dañado.',
          regionCutCode: '99',
        });
      expect(res.status).toBe(400);
      const message = JSON.stringify(res.body);
      expect(message).toContain('Región inválida');
    } finally {
      await app.close();
    }
  });

  it('PUT con communeCutCode que NO pertenece a regionCutCode → 400', async () => {
    const { app } = await buildApp();
    try {
      const res = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/business-profile`)
        .send({
          primaryCustomerProfile: 'Mujeres 30-45 con cabello dañado.',
          regionCutCode: '13',
          communeCutCode: '05101', // Valparaíso, no es de la RM
        });
      expect(res.status).toBe(400);
      const message = JSON.stringify(res.body);
      expect(message).toContain('La comuna no pertenece a la región seleccionada');
    } finally {
      await app.close();
    }
  });

  it('PUT sin communeCutCode pero con regionCutCode válido → 201', async () => {
    const { app } = await buildApp();
    try {
      const res = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/business-profile`)
        .send({
          primaryCustomerProfile: 'Mujeres 30-45 con cabello dañado.',
          regionCutCode: '13',
        })
        .expect(201);
      const profile = (res.body as ProfileResponse).profile;
      expect(profile['regionCutCode']).toBe('13');
      expect(profile['communeCutCode']).toBeNull();
      expect(profile['regionName']).toBe('Región Metropolitana de Santiago');
      expect(profile['communeName']).toBeNull();
    } finally {
      await app.close();
    }
  });

  it('GET incluye regionName y communeName resueltos desde el catálogo', async () => {
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
      expect(profile['regionCutCode']).toBe('13');
      expect(profile['communeCutCode']).toBe('13114');
      expect(profile['regionName']).toBe('Región Metropolitana de Santiago');
      expect(profile['communeName']).toBe('Las Condes');
      expect(profile['countryCode']).toBe('CL');
    } finally {
      await app.close();
    }
  });

  it('PUT omite countryCode → backend rellena CL por defecto', async () => {
    const { app } = await buildApp();
    try {
      const res = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/business-profile`)
        .send({
          primaryCustomerProfile: 'Mujeres 30-45 con cabello dañado.',
          regionCutCode: '13',
          communeCutCode: '13114',
        })
        .expect(201);
      const profile = (res.body as ProfileResponse).profile;
      expect(profile['countryCode']).toBe('CL');
    } finally {
      await app.close();
    }
  });

  it('PUT con communeCutCode y sin regionCutCode → 201 si la comuna es válida sola', async () => {
    const { app } = await buildApp();
    try {
      const res = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/business-profile`)
        .send({
          primaryCustomerProfile: 'Mujeres 30-45 con cabello dañado.',
          communeCutCode: '13114',
        })
        .expect(201);
      const profile = (res.body as ProfileResponse).profile;
      expect(profile['communeCutCode']).toBe('13114');
      expect(profile['regionCutCode']).toBeNull();
      expect(profile['communeName']).toBe('Las Condes');
      expect(profile['regionName']).toBeNull();
    } finally {
      await app.close();
    }
  });
});
