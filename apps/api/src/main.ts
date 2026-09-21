import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadRootEnv } from '@publicador/database';

async function bootstrap() {
  loadRootEnv();

  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { cors: true });

  const config = app.get(ConfigService);
  const prefix = config.get<string>('API_PREFIX') ?? 'api/v1';
  const port = Number(config.get<string>('API_PORT') ?? 3001);
  if (!Number.isFinite(port)) {
    throw new Error(`API_PORT inválido: ${process.env.API_PORT}`);
  }

  app.setGlobalPrefix(prefix);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableShutdownHooks();

  await app.listen(port);
  logger.log(`API escuchando en http://localhost:${port}/${prefix}`);
}
bootstrap().catch((err) => {
  console.error('Fallo al iniciar la API', err);
  process.exit(1);
});
