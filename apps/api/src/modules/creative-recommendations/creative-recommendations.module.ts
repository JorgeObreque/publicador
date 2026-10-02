import { Module } from '@nestjs/common';
import { AnalyzeModule } from '../analyze/analyze.module';
import { BusinessProfileModule } from '../business-profile/business-profile.module';
import { CreativeRecommendationsController } from './creative-recommendations.controller';
import { CreativeRecommendationsService } from './creative-recommendations.service';

/**
 * Módulo que expone el endpoint de recomendaciones de copy.
 *
 * Reutiliza el provider `OPENAI_CLIENT` registrado en `AnalyzeModule`
 * (mismo cliente OpenAI, mismo token de inyección) para mantener una
 * única instancia compartida. Los tests de integración pueden sustituir
 * al cliente mockeado con la misma técnica que ya usan en `analyze.int-spec`:
 * `Test.createTestingModule({ imports: [AppModule] })
 *   .overrideProvider(OPENAI_CLIENT).useValue(mock)`.
 *
 * Consume además `BUSINESS_PROFILE_SERVICE` (registrado en
 * `BusinessProfileModule`) para inyectar en los prompts las reglas reales
 * del negocio (dirección, voz de marca, palabras prohibidas, emojis
 * permitidos, perfil de clienta ideal y objeciones). En esta entrega el
 * perfil es **de sólo lectura** para este módulo.
 *
 * `BusinessContextModule` se inyecta gracias a que es `@Global`. El
 * módulo no persiste nada: sólo genera propuestas que el operador revisa
 * y, si las aprueba, terminan como entidades `Creative` (ADR 0007).
 */
@Module({
  imports: [AnalyzeModule, BusinessProfileModule],
  controllers: [CreativeRecommendationsController],
  providers: [CreativeRecommendationsService],
})
export class CreativeRecommendationsModule {}
