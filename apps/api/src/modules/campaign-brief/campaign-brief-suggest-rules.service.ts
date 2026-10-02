import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CampaignBriefStatus } from '@prisma/client';
import { prisma } from '@publicador/database';
import { BusinessContextResolver } from '../../shared/business-context/business-context.resolver';
import { OPENAI_CLIENT, type OpenAIClientToken } from '../analyze/analyze.tokens';
import type { OpenAISummaryResult } from '../analyze/openai.client';
import {
  BUSINESS_PROFILE_SERVICE,
  type BusinessProfileServiceToken,
} from '../business-profile/business-profile.tokens';
import {
  RULE_MAX_LENGTH,
  type SuggestRulesResponse,
} from './dto/campaign-brief-suggest-rules.dto';
import {
  buildSuggestRulesPayloadFromBrief,
  type SuggestRulesContext,
  type SuggestRulesPayload,
} from './campaign-brief-suggest-rules.types';
import { buildSuggestRulesPrompt } from './campaign-brief-suggest-rules.prompt';

/**
 * Servicio que propone dos reglas de decisión (`stopIf` y `scaleIf`)
 * para un `CampaignBrief` ya creado, basándose en su objetivo comercial
 * y en el contexto del negocio (servicio, comuna, perfil territorial).
 *
 * Diseño:
 *
 *  1. Lee el brief actual (NO lo modifica). Si el brief está archivado,
 *     el servicio rechaza la operación con `BadRequestException` (la
 *     regla debe ser contra un brief vivo).
 *  2. Si el brief ya tiene `stopIf` y `scaleIf` con texto no vacío,
 *     devuelve esas reglas tal cual (idempotencia: NO consume tokens).
 *  3. Si las reglas están vacías, carga el contexto del negocio (perfil
 *     de negocio + contexto socioeconómico de la comuna cuando esté
 *     disponible) y construye el prompt.
 *  4. Llama al cliente OpenAI mockeable (`OPENAI_CLIENT`). Parsea la
 *     respuesta con un parser tolerante: cualquier excepción cae a un
 *     fallback determinista con `source: 'FALLBACK'`.
 *
 * El servicio es **idempotente** y **no escribe** en la base. La decisión
 * de aplicar o descartar la sugerencia la toma el frontend y, si el
 * operador la acepta, la persistencia ocurre vía `PATCH
 * /campaign-briefs/:id`.
 */
@Injectable()
export class CampaignBriefSuggestRulesService {
  private readonly logger = new Logger(CampaignBriefSuggestRulesService.name);

  constructor(
    private readonly businessContext: BusinessContextResolver,
    @Inject(OPENAI_CLIENT) private readonly client: OpenAIClientToken,
    @Inject(BUSINESS_PROFILE_SERVICE)
    private readonly businessProfile: BusinessProfileServiceToken,
  ) {}

  private get businessId(): string {
    return this.businessContext.resolve().businessId;
  }

/**
   * Genera (o devuelve) las reglas sugeridas. La promesa resuelve con un
   * payload que cumple `SuggestRulesResponse`.
   *
   * Casos cubiertos:
   *  - Brief inexistente o o de otro negocio → `NotFoundException` (404).
   *  - Brief archivado → `BadRequestException` (400).
   *  - Brief con `stopIf`/`scaleIf` ya completos → devuelve esas reglas
   *    con `source: 'AI'` (idempotencia: no se gasta el cupón de IA).
   *  - Brief con campos críticos vacíos (objetivo) → `BadRequestException`
   *    con mensaje claro para la UI.
 *  - Cualquier excepción del modelo (o JSON malformado) → fallback
 *    determinista con `source: 'FALLBACK'`.
   */
  async suggest(id: string): Promise<SuggestRulesResponse> {
    const businessId = this.businessId;
    const brief = await prisma.campaignBrief.findFirst({
      where: { id, businessId },
    });
    if (!brief) {
      throw new NotFoundException(`CampaignBrief ${id} no encontrado`);
    }
    if (brief.status === CampaignBriefStatus.ARCHIVED) {
      throw new BadRequestException(
        'No se pueden analizar reglas de un brief archivado',
      );
    }
    if (!brief.businessObjective || brief.businessObjective.trim().length === 0) {
      throw new BadRequestException(
        'Debes completar el objetivo comercial antes de analizar',
      );
    }

    const stopIfTrimmed = (brief.stopIf ?? '').trim();
    const scaleIfTrimmed = (brief.scaleIf ?? '').trim();
    if (stopIfTrimmed.length > 0 && scaleIfTrimmed.length > 0) {
      return {
        stopIf: stopIfTrimmed,
        scaleIf: scaleIfTrimmed,
        source: 'AI',
      };
    }

    const context = await this.loadContext(brief.serviceId);
    const payload = buildSuggestRulesPayloadFromBrief(brief, context);
    const prompts = buildSuggestRulesPrompt(payload);

    const fallback = this.buildFallback(payload);

    try {
      if (!this.client.isConfigured()) {
        this.logger.warn('OPENAI_CLIENT no configurado; devolviendo fallback');
        return fallback;
      }
      const summary = await this.trySummarize(payload, prompts);
      const parsed = this.parseResponse(summary);
      return this.buildSuccessResponse(parsed, summary);
    } catch (error) {
      this.logger.warn(
        `No se pudo generar sugerencia con IA, fallback aplicado: ${(error as Error).message}`,
      );
      return fallback;
    }
  }

  /**
   * Construye el contexto del prompt a partir del `BusinessProfile` y del
   * contexto socioeconómico de la comuna (cuando esté disponible). Si el
   * operador aún no completó el perfil del negocio o el servicio no
   * existe, devuelve `null` (el prompt sigue funcionando sin ese bloque).
   */
  private async loadContext(serviceId: string): Promise<SuggestRulesContext | null> {
    const [profile, service] = await Promise.all([
      this.businessProfile.getOrCreate(),
      prisma.service.findFirst({
        where: { id: serviceId, businessId: this.businessId },
        select: { name: true, description: true },
      }),
    ]);

    const displayLocation = this.businessProfile.getDisplayLocation(profile);
    const ctx = this.businessProfile.getBusinessContext(profile);

    return {
      businessName: null,
      serviceName: service?.name ?? null,
      serviceDescription: service?.description ?? null,
      displayLocation,
      regionName: ctx.regionName,
      communeName: ctx.communeName,
      population: ctx.context?.population ?? null,
      income: ctx.context?.avgHouseholdIncomeCLP ?? null,
      profileDescription: ctx.context?.profileDescription ?? null,
      adultShare25_55: ctx.context?.adultShare25_55 ?? null,
    };
  }

  private async trySummarize(
    payload: SuggestRulesPayload,
    prompts: ReturnType<typeof buildSuggestRulesPrompt>,
  ): Promise<OpenAISummaryResult> {
    return this.client.summarize(
      payload as unknown as Parameters<OpenAIClientToken['summarize']>[0],
      prompts,
    );
  }

  /**
   * Parsea la respuesta del modelo. Acepta `parsed` o `parsed.rules` /
   * `parsed.suggestions` (cualquier variante razonable) y devuelve un
   * objeto `{ stopIf, scaleIf }` con strings no vacíos y dentro del
   * límite. Lanza si ninguna variante encaja.
   */
  private parseResponse(
    summary: OpenAISummaryResult,
  ): { stopIf: string; scaleIf: string } {
    const candidates = this.collectRuleCandidates(summary.parsed);
    for (const candidate of candidates) {
      const stopIf = this.coerceString(candidate['stopIf']);
      const scaleIf = this.coerceString(candidate['scaleIf']);
      if (stopIf && scaleIf) {
        return {
          stopIf: this.normalizeRule(stopIf),
          scaleIf: this.normalizeRule(scaleIf),
        };
      }
    }
    throw new Error('La respuesta de OpenAI no contiene stopIf/scaleIf válidos');
  }

  private collectRuleCandidates(parsed: Record<string, unknown>): Array<Record<string, unknown>> {
    const list: Array<Record<string, unknown>> = [parsed];
    const rules = parsed['rules'];
    if (rules && typeof rules === 'object') {
      list.push(rules as Record<string, unknown>);
    }
    const suggestions = parsed['suggestions'];
    if (Array.isArray(suggestions)) {
      for (const entry of suggestions) {
        if (entry && typeof entry === 'object') {
          list.push(entry as Record<string, unknown>);
        }
      }
    }
    return list;
  }

  private coerceString(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      const str = String(value).trim();
      return str.length > 0 ? str : null;
    }
    return null;
  }

  /**
   * Normaliza una regla: trim, sin saltos de línea, sin emojis y con
   * truncado defensivo a `RULE_MAX_LENGTH`. NO transforma mayúsculas
   * (el system prompt prohíbe mayúsculas sostenidas pero el operador
   * puede decidir mantenerlas si vienen del modelo).
   */
  private normalizeRule(value: string): string {
    const withoutEmoji = value.replace(/\p{Extended_Pictographic}/gu, '');
    const flattened = withoutEmoji.replace(/\s+/g, ' ').trim();
    if (flattened.length <= RULE_MAX_LENGTH) return flattened;
    return flattened.slice(0, RULE_MAX_LENGTH).trim();
  }

  private buildSuccessResponse(
    parsed: { stopIf: string; scaleIf: string },
    _summary: OpenAISummaryResult,
  ): SuggestRulesResponse {
    return {
      stopIf: parsed.stopIf,
      scaleIf: parsed.scaleIf,
      source: 'AI',
    };
  }

  /**
   * Fallback determinista cuando el modelo falla, devuelve JSON
   * malformado, o el cliente OpenAI no está configurado. Las reglas se
   * construyen a partir del objetivo y de los topes económicos del brief
   * (sin inventar cifras exactas: usamos rangos razonables).
   *
   * El source marca `FALLA_FALLBACK` para que la UI pueda comunicárselo
   * al operador y el operador pueda editar manualmente.
   */
  private buildFallback(payload: SuggestRulesPayload): SuggestRulesResponse {
    const duration =
      payload.plannedDurationDays && payload.plannedDurationDays > 0
        ? `${payload.plannedDurationDays} días`
        : '14 días';

    const cpaCap = payload.costPerAcquisitionCap;
    const stopThreshold =
      cpaCap !== null && cpaCap > 0
        ? `Si el CPL supera $${formatClpValue(cpaCap * 1.5)} sin resultados en ${duration}`
        : `Si no hay resultados calificados en ${duration}`;
    const scaleThreshold =
      cpaCap !== null && cpaCap > 0
        ? `Si el CPL baja de $${formatClpValue(cpaCap * 0.5)} con más de 5 conversaciones calificadas`
        : `Si en ${duration} hay más de 5 conversaciones calificadas`;

    return {
      stopIf: this.normalizeRule(stopThreshold),
      scaleIf: this.normalizeRule(scaleThreshold),
      source: 'FALLBACK',
    };
  }
}

const formatClpValue = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) return '0';
  return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};