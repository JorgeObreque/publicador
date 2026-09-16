import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';

export async function buildApp(options: { logger?: boolean } = {}): Promise<INestApplication> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication({ logger: options.logger ?? true });
  app.setGlobalPrefix(process.env.API_PREFIX ?? 'api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableShutdownHooks();
  await app.init();
  return app;
}
