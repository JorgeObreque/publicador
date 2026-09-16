import './setup';
import request from 'supertest';
import { ScheduleModule } from '@nestjs/schedule';
import { buildApp } from './helpers/test-app';

describe('Application smoke (integration)', () => {
  it('boots NestJS, exposes health routes and registers scheduler', async () => {
    const app = await buildApp();
    const live = await request(app.getHttpServer()).get('/api/v1/health/live');
    expect(live.status).toBe(200);
    const ready = await request(app.getHttpServer()).get('/api/v1/health/ready');
    expect(ready.status).toBe(200);
    expect(ready.body.status).toBe('ok');
    expect(app.get(ScheduleModule)).toBeDefined();
    await app.close();
  });
});
