import './setup';
import request from 'supertest';
import { buildApp } from './helpers/test-app';

describe('Health endpoints (integration)', () => {
  it('returns live without database checks', async () => {
    const app = await buildApp();
    const res = await request(app.getHttpServer()).get('/api/v1/health/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    await app.close();
  });

  it('returns ready with database ok', async () => {
    const app = await buildApp();
    const res = await request(app.getHttpServer()).get('/api/v1/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.checks.database.status).toBe('ok');
    await app.close();
  });
});
