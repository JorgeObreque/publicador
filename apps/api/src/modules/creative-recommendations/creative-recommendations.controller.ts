import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ZodError } from 'zod';
import { CreativeRecommendationsService } from './creative-recommendations.service';
import {
  recommendationRequestSchema,
  type RecommendationRequest,
  type RecommendationResponse,
} from './creative-recommendations.types';

/**
 * Endpoint para generar propuestas de copy publicitario asistidas por IA.
 *
 * Sigue el patrón de `AnalyzeController`: la validación de entrada se hace
 * con Zod y el `OPENAI_CLIENT` se expone mediante el mismo token que ya
 * usa `AnalyzeModule`, lo que permite que los tests de integración
 * sustituyan al cliente real con un mock determinista sin tocar el código
 * de producción.
 */
@Controller('creatives')
export class CreativeRecommendationsController {
  constructor(private readonly service: CreativeRecommendationsService) {}

  @Post('recommendations')
  @HttpCode(201)
  recommendations(@Body() body: unknown): Promise<RecommendationResponse> {
    const request = this.parseBody(body);
    if (!this.service.isConfigured()) {
      throw new ServiceUnavailableException('No se pudo consultar OpenAI: cliente no configurado');
    }
    return this.service.generate(request);
  }

  private parseBody(body: unknown): RecommendationRequest {
    try {
      return recommendationRequestSchema.parse(body ?? {});
    } catch (err) {
      if (err instanceof ZodError) {
        throw new BadRequestException({
          message: 'Datos inválidos',
          issues: err.issues.map((i) => ({ path: i.path, message: i.message })),
        });
      }
      throw err;
    }
  }
}
