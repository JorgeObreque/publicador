import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { ZodError } from 'zod';
import { BusinessContextResolver } from '../../shared/business-context/business-context.resolver';
import {
  adjustDiagnosisSchema,
  answerQuestionSchema,
  startDiagnosisSchema,
  type AdjustDiagnosisInput,
  type AnswerQuestionInput,
  type StartDiagnosisInput,
} from './dto/commercial-diagnosis.dto';
import { CommercialDiagnosisService } from './commercial-diagnosis.service';

/**
 * Endpoints HTTP del módulo `CommercialDiagnosis`. Sigue el mismo patrón
 * que `CampaignBriefController`:
 *
 *  - `parseBody` fuerza la lectura de `BUSINESS_ID` antes de tocar Prisma.
 *  - `ZodError` se traduce a `BadRequestException` con issues planos.
 *  - Los códigos HTTP son 201 para las acciones que mutan estado y 200
 *    para las lecturas (Nest default).
 *
 * Rutas:
 *  - `POST /commercial-diagnoses`                       → crear diagnóstico.
 *  - `GET  /commercial-diagnoses/:id`                   → leer.
 *  - `POST /commercial-diagnoses/:id/answer`            → responder.
 *  - `POST /commercial-diagnoses/:id/adjust`            → ajustar.
 *  - `POST /commercial-diagnoses/:id/accept`            → aceptar (crea brief).
 *  - `POST /commercial-diagnoses/:id/archive`           → archivar.
 */
@Controller('commercial-diagnoses')
export class CommercialDiagnosisController {
  constructor(
    private readonly diagnoses: CommercialDiagnosisService,
    private readonly businessContext: BusinessContextResolver,
  ) {}

  @Post()
  @HttpCode(201)
  async create(@Body() body: unknown) {
    const input = this.parseBody(startDiagnosisSchema, body) as StartDiagnosisInput;
    return this.diagnoses.start(input);
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.diagnoses.getById(id);
  }

  @Post(':id/answer')
  @HttpCode(201)
  async answer(@Param('id') id: string, @Body() body: unknown) {
    const input = this.parseBody(answerQuestionSchema, body) as AnswerQuestionInput;
    return this.diagnoses.answer(id, input);
  }

  @Post(':id/adjust')
  @HttpCode(201)
  async adjust(@Param('id') id: string, @Body() body: unknown) {
    const input = this.parseBody(adjustDiagnosisSchema, body) as AdjustDiagnosisInput;
    return this.diagnoses.adjust(id, input);
  }

  @Post(':id/accept')
  @HttpCode(201)
  async accept(@Param('id') id: string) {
    return this.diagnoses.accept(id);
  }

  @Post(':id/archive')
  @HttpCode(201)
  async archive(@Param('id') id: string) {
    return this.diagnoses.archive(id);
  }

  private parseBody<T>(
    schema: { parse: (input: unknown) => T },
    body: unknown,
  ): T {
    void this.businessContext.resolve();
    try {
      return schema.parse(body ?? {});
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