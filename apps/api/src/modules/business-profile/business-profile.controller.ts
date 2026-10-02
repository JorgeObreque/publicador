import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
} from '@nestjs/common';
import { ZodError } from 'zod';
import { BusinessContextResolver } from '../../shared/business-context/business-context.resolver';
import { TerritoryService } from '../territory/territory.service';
import {
  BusinessProfileService,
  serializeBusinessProfile,
} from './business-profile.service';
import { upsertBusinessProfileSchema, type UpsertBusinessProfileInput } from './dto/business-profile.dto';

/**
 * Endpoints HTTP para gestionar el `BusinessProfile` persistente.
 *
 * - `GET /api/v1/business-profile` devuelve el perfil actual; si no existe,
 *   crea uno vacío y lo persiste (mismo contrato que `getOrCreate()`) y
 *   expone `ready: false` para que la UI pueda mostrar el formulario.
 * - `POST /api/v1/business-profile` aplica un upsert validado por Zod y
 *   por el `TerritoryService` (códigos SUBDERE 2018).
 * - `POST /api/v1/business-profile/complete` fuerza el flag de "perfil
 *   completado" sin necesidad de editar campos.
 *
 * El módulo es el primer paso del plan publicitario estratégico: el resto
 * de IA, briefs y planes de medios consultará este perfil de sólo lectura.
 */
@Controller('business-profile')
export class BusinessProfileController {
  constructor(
    private readonly service: BusinessProfileService,
    private readonly territory: TerritoryService,
    private readonly businessContext: BusinessContextResolver,
  ) {}

  @Get()
  async getCurrent() {
    const profile = await this.service.getOrCreate();
    return {
      profile: serializeBusinessProfile(profile, this.territory),
      ready: this.service.isReady(profile),
    };
  }

  @Post()
  @HttpCode(201)
  async upsert(@Body() body: unknown) {
    const input = this.parseBody(body);
    const profile = await this.service.upsert(input);
    return {
      profile: serializeBusinessProfile(profile, this.territory),
      ready: this.service.isReady(profile),
    };
  }

  @Post('complete')
  @HttpCode(200)
  async complete() {
    const profile = await this.service.markCompleted();
    return {
      profile: serializeBusinessProfile(profile, this.territory),
      ready: this.service.isReady(profile),
    };
  }

  private parseBody(body: unknown): UpsertBusinessProfileInput {
    // El `BusinessContextResolver` se inyecta para forzar la validación de
    // `BUSINESS_ID` en cuanto llega la primera request. Si el operador
    // intenta usar el endpoint sin haber definido la variable de entorno,
    // el error 500 con mensaje claro se devuelve antes de tocar Prisma.
    void this.businessContext.resolve();
    try {
      return upsertBusinessProfileSchema.parse(body ?? {});
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
