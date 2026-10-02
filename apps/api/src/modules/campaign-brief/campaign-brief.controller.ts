import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ZodError } from 'zod';
import { BusinessContextResolver } from '../../shared/business-context/business-context.resolver';
import { CampaignBriefService } from './campaign-brief.service';
import { CampaignBriefSuggestRulesService } from './campaign-brief-suggest-rules.service';
import {
  createCampaignBriefSchema,
  updateCampaignBriefSchema,
  CAMPAIGN_BRIEF_STATUSES,
  type CampaignBriefStatusFilter,
  type CreateCampaignBriefInput,
  type UpdateCampaignBriefInput,
} from './dto/campaign-brief.dto';
import { suggestRulesResponseSchema } from './dto/campaign-brief-suggest-rules.dto';

/**
 * Endpoints HTTP para gestionar el `CampaignBrief` persistente del negocio
 * configurado en `BUSINESS_ID`. Es el segundo paso del plan publicitario
 * estratégico: define QUÉ queremos conseguir en una campaña concreta
 * (objetivo comercial, oferta, KPI, cliente ideal, presupuesto y reglas
 * de decisión) antes de tocar Meta.
 *
 * Esta capa es **independiente** del módulo `campaigns`: un brief es una
 * ficha de planificación; una campaña es la ejecución operativa que se
 * publica en Meta. El siguiente paso del plan (recomendaciones de copy)
 * leerá los briefs aprobados.
 *
 * - `POST /api/v1/campaign-briefs` crea un brief en estado `DRAFT`.
 * - `GET /api/v1/campaign-briefs` lista los briefs del negocio, opcional
 *   filtrando por `status` (`DRAFT` | `APPROVED` | `ARCHIVED`).
 * - `GET /api/v1/campaign-briefs/:id` devuelve un brief si pertenece al
 *   negocio actual (404 si no existe o pertenece a otro).
 * - `PATCH /api/v1/campaign-briefs/:id` actualiza campos parciales.
 * - `POST /api/v1/campaign-briefs/:id/approve` pasa a `APPROVED` y setea
 *   `approvedAt`. Si falta algún campo crítico, devuelve 400.
 * - `POST /api/v1/campaign-briefs/:id/archive` lo pasa a `ARCHIVED`.
 */
@Controller('campaign-briefs')
export class CampaignBriefController {
  constructor(
    private readonly briefs: CampaignBriefService,
    private readonly businessContext: BusinessContextResolver,
    private readonly suggestRules: CampaignBriefSuggestRulesService,
  ) {}

  @Post()
  @HttpCode(201)
  async create(@Body() body: unknown) {
    const input = this.parseBody(createCampaignBriefSchema, body) as CreateCampaignBriefInput;
    return this.briefs.create(input);
  }

  @Get()
  async list(@Query('status') status?: string) {
    const filter = this.parseStatus(status);
    return this.briefs.list(filter);
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.briefs.getById(id);
  }

  /**
   * `GET /api/v1/campaign-briefs/:id/executions` devuelve el resumen de
   * las campañas (`Campaign`) vinculadas a este brief. Sólo trae
   * campañas con `campaignBriefId = :id` (las huérfanas quedan excluidas).
   * Devuelve 404 si el brief no existe o pertenece a otro negocio.
   */
  @Get(':id/executions')
  async listExecutions(@Param('id') id: string) {
    return this.briefs.listExecutionsByBriefId(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: unknown) {
    const input = this.parseBody(updateCampaignBriefSchema, body) as UpdateCampaignBriefInput;
    return this.briefs.update(id, input);
  }

  @Post(':id/approve')
  @HttpCode(201)
  async approve(@Param('id') id: string) {
    return this.briefs.approve(id);
  }

  @Post(':id/archive')
  @HttpCode(201)
  async archive(@Param('id') id: string) {
    return this.briefs.archive(id);
  }

  /**
   * `POST /api/v1/campaign-briefs/:id/suggest-rules` propone dos reglas
   * de decisión (`stopIf` y `scaleIf`) basadas en el objetivo comercial
   * del brief. NO modifica el brief: el operador decide si aplica o
   * descarta cada sugerencia desde la UI. Si el brief ya tiene
   * `stopIf`/`scaleIf` con texto, las devuelve tal cual (idempotencia).
   */
  @Post(':id/suggest-rules')
  @HttpCode(201)
  async suggestRulesForBrief(@Param('id') id: string) {
    // Forzamos la lectura de `BUSINESS_ID` antes de tocar Prisma, igual
    // que en `parseBody`, para mantener consistencia con el resto de los
    // endpoints del módulo.
    void this.businessContext.resolve();
    const response = await this.suggestRules.suggest(id);
    const validated = suggestRulesResponseSchema.safeParse(response);
    if (!validated.success) {
      throw new BadRequestException({
        message: 'No se pudo construir la sugerencia con el formato esperado',
        issues: validated.error.issues.map((i) => ({ path: i.path, message: i.message })),
      });
    }
    return validated.data;
  }

  private parseStatus(raw?: string): { status?: CampaignBriefStatusFilter } {
    if (!raw || raw.trim().length === 0) return {};
    const normalized = raw.trim().toUpperCase();
    if (!CAMPAIGN_BRIEF_STATUSES.includes(normalized as CampaignBriefStatusFilter)) {
      throw new BadRequestException(
        `status inválido: ${raw}. Permitidos: ${CAMPAIGN_BRIEF_STATUSES.join(', ')}`,
      );
    }
    return { status: normalized as CampaignBriefStatusFilter };
  }

  private parseBody<T>(
    schema: { parse: (input: unknown) => T },
    body: unknown,
  ): T {
    // Forzar la lectura de `BUSINESS_ID` antes de tocar Prisma. Si no está
    // configurado, lanzamos 500 con un mensaje claro (consistente con el
    // módulo `BusinessProfile`).
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
