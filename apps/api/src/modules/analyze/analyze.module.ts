import { Module } from '@nestjs/common';
import { BusinessContextModule } from '../../shared/business-context/business-context.module';
import { PerformanceModule } from '../performance/performance.module';
import { AnalyzeController } from './analyze.controller';
import { AnalyzeService } from './analyze.service';
import { OpenAIClient } from './openai.client';
import { OPENAI_CLIENT } from './analyze.tokens';

@Module({
  imports: [BusinessContextModule, PerformanceModule],
  controllers: [AnalyzeController],
  providers: [
    AnalyzeService,
    {
      // Token de inyección para tests: `overrideProvider(OPENAI_CLIENT).useValue(mock)`.
      provide: OPENAI_CLIENT,
      useFactory: () =>
        new OpenAIClient({
          apiKey: process.env.OPENAI_API_KEY,
          project: process.env.OPENAI_PROJECT_ID,
          model: process.env.OPENAI_MODEL,
        }),
    },
    // Mantiene `OpenAIClient` resuelto en el contenedor para cualquier consumidor
    // externo que siga importándolo directamente desde el módulo.
    { provide: OpenAIClient, useExisting: OPENAI_CLIENT },
  ],
  exports: [AnalyzeService, OpenAIClient, OPENAI_CLIENT],
})
export class AnalyzeModule {}
