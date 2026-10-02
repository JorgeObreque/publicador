import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { prisma } from '@publicador/database';
import { BusinessContextResolver } from '../../shared/business-context/business-context.resolver';
import { OPENAI_CLIENT, type OpenAIClientToken } from '../analyze/analyze.tokens';
import {
  BUSINESS_PROFILE_SERVICE,
  type BusinessProfileServiceToken,
} from '../business-profile/business-profile.tokens';
import type { OpenAISummaryResult } from '../analyze/openai.client';
import {
  buildBusinessLocationLine,
  buildRecommendationPrompt,
} from './creative-recommendations.prompt';
import {
  HEADLINE_MAX,
  PRIMARY_TEXT_MAX,
  SUGGESTIONS_LENGTH,
  recommendationResponseSchema,
  type BusinessProfileSnapshot,
  type RecommendationMode,
  type RecommendationPayload,
  type RecommendationRequest,
  type RecommendationResponse,
  type RecommendationSuggestion,
} from './creative-recommendations.types';

/**
 * Servicio que orquesta la generación de recomendaciones de copy para
 * creativos publicitarios. Sigue el mismo patrón que `AnalyzeService`:
 *
 * 1. Resuelve el `businessId` desde el contexto.
 * 2. Valida que los recursos referenciados (`service`, `mediaAsset`)
 *    existan y pertenezcan al negocio.
 * 3. Construye el payload y los prompts adaptados al `mode`.
 * 4. Llama al cliente OpenAI y normaliza/valida la respuesta.
 * 5. Trunca longitudes según los límites del dominio.
 * 6. Devuelve la lista de sugerencias (sin usage público).
 *
 * No persiste nada: las recomendaciones son propuestas que el operador
 * revisa y, si las aprueba, terminan como `Creative` (ADR 0007).
 */
@Injectable()
export class CreativeRecommendationsService {
  private readonly logger = new Logger(CreativeRecommendationsService.name);

  constructor(
    private readonly businessContext: BusinessContextResolver,
    @Inject(OPENAI_CLIENT) private readonly client: OpenAIClientToken,
    @Inject(BUSINESS_PROFILE_SERVICE)
    private readonly businessProfile: BusinessProfileServiceToken,
  ) {}

  private get businessId(): string {
    return this.businessContext.resolve().businessId;
  }

  isConfigured(): boolean {
    return this.client.isConfigured();
  }

  async generate(request: RecommendationRequest): Promise<RecommendationResponse> {
    if (!this.client.isConfigured()) {
      throw new ServiceUnavailableException('No se pudo consultar OpenAI: cliente no configurado');
    }

    const payload = await this.buildPayload(request);
    const prompts = buildRecommendationPrompt(payload);

    // El cliente real ignora el `input` (lo mantiene en la firma sólo para
    // trazabilidad). Cast a `never` para evitar acoplar este módulo al tipo
    // `PerformancePromptPayload` que vive en el módulo de análisis.
    //
    // Si la primera respuesta de OpenAI no supera la validación (típicamente
    // porque devuelve sugerencias con `headline` o `primaryText` vacíos,
    // algo que se ha observado en producción como fluctuación puntual),
    // se reintenta la generación UNA vez antes de propagar el 503.
    const MAX_RECOMMENDATION_ATTEMPTS = 2;
    const fallbackHeadline = payload.service.name?.trim() || 'Tu cambio ideal';
    const locationNote = payload.businessLocationNote;
    let summary!: OpenAISummaryResult;
    let validatedSuggestions!: RecommendationSuggestion[];
    for (let attempt = 1; attempt <= MAX_RECOMMENDATION_ATTEMPTS; attempt += 1) {
      try {
        summary = await this.client.summarize(
          payload as unknown as Parameters<OpenAIClientToken['summarize']>[0],
          prompts,
        );
        const suggestions = this.normalizeSuggestions(summary.parsed);
        validatedSuggestions = this.validateSuggestions(
          suggestions,
          payload.mode,
          fallbackHeadline,
          locationNote,
        );
        break;
      } catch (error) {
        if (attempt >= MAX_RECOMMENDATION_ATTEMPTS) {
          throw error;
        }
        this.logger.warn(
          'Reintentando generación de recomendaciones por sugerencia vacía',
        );
      }
    }

    const response: RecommendationResponse = {
      mode: payload.mode,
      suggestions: validatedSuggestions,
    };

    const validated = recommendationResponseSchema.safeParse(response);
    if (!validated.success) {
      this.logger.error(
        `La respuesta recomputada no cumple el esquema: ${validated.error.message}`,
      );
      throw new ServiceUnavailableException(
        'No se pudo construir la respuesta de recomendaciones con el formato esperado',
      );
    }
    return validated.data;
  }

  private async buildPayload(request: RecommendationRequest): Promise<RecommendationPayload> {
    const business = await prisma.business.findUnique({
      where: { id: this.businessId },
      select: { id: true, name: true, description: true },
    });
    if (!business) {
      throw new BadRequestException(
        `Negocio ${this.businessId} no encontrado para recomendaciones`,
      );
    }

    const service = await prisma.service.findFirst({
      where: { id: request.serviceId, businessId: this.businessId },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        currency: true,
        duration: true,
      },
    });
    if (!service) {
      throw new BadRequestException(
        `Servicio ${request.serviceId} no pertenece al negocio actual`,
      );
    }

    const mediaAsset = await prisma.mediaAsset.findFirst({
      where: { id: request.mediaAssetId, businessId: this.businessId },
      select: {
        id: true,
        name: true,
        mimeType: true,
        kind: true,
      },
    });
    if (!mediaAsset) {
      throw new BadRequestException(
        `MediaAsset ${request.mediaAssetId} no pertenece al negocio actual`,
      );
    }

    // El precio puede venir ausente o ser 0 en la base; en ambos casos el
    // prompt builder lo representará como "Sin precio referencial — omitir
    // bloque de precio" y el system prompt instruye al modelo a omitir el
    // bloque completo de precio (incluida la línea de evaluación).
    const hasPositivePrice = service.price !== null && service.price !== undefined;
    const price = hasPositivePrice ? Number(service.price!.toString()) : null;
    const positivePrice = price !== null && Number.isFinite(price) && price > 0 ? price : null;

    // Resuelve el BusinessProfile (crea uno vacío si no existe) y construye
    // un snapshot mínimo para inyectarlo en el prompt builder. Si la fila
    // está totalmente vacía seguimos funcionando pero avisamos por log para
    // que el operador sepa que la IA está trabajando "a ciegas" sobre la
    // realidad del negocio.
    const profile = await this.businessProfile.getOrCreate();
    const snapshot = this.buildProfileSnapshot(profile);
    if (!snapshot.ready) {
      this.logger.warn(`BusinessProfile no inicializado para ${this.businessId}`);
    }
    const displayLocation = this.businessProfile.getDisplayLocation(profile);
    const locationNote = displayLocation
      ? `📍 ${displayLocation}\nAtención exclusiva con agenda previa.`
      : `${buildBusinessLocationLine(snapshot)}\nAtención exclusiva con agenda previa.`;

    return {
      mode: request.mode,
      business: {
        id: business.id,
        name: business.name,
        description: business.description ?? null,
      },
      service: {
        id: service.id,
        name: service.name,
        description: service.description ?? null,
        price: positivePrice,
        currency: service.currency,
        duration: service.duration ?? null,
      },
      mediaAsset: {
        id: mediaAsset.id,
        name: mediaAsset.name,
        mimeType: mediaAsset.mimeType,
        kind: String(mediaAsset.kind),
      },
      currentCopy: {
        primaryText: request.currentCopy?.primaryText?.trim() || undefined,
        headline: request.currentCopy?.headline?.trim() || undefined,
      },
      context: {
        campaignNotes: request.context?.campaignNotes?.trim() || undefined,
        briefContext: request.context?.briefContext,
      },
      briefContext: request.briefContext,
      businessLocationNote: locationNote,
      businessProfile: snapshot,
    };
  }

  private buildProfileSnapshot(profile: {
    addressLine: string | null;
    neighborhood: string | null;
    regionCutCode: string | null;
    communeCutCode: string | null;
    regionName?: string | null;
    communeName?: string | null;
    countryCode: string | null;
    brandVoiceKeywords: string[];
    wordsToAvoid: string[];
    preferredEmojiSemantics: string[];
    primaryCustomerProfile: string | null;
    commonObjections: string[];
    profileCompletedAt: Date | null;
  }): BusinessProfileSnapshot {
    return {
      addressLine: profile.addressLine,
      neighborhood: profile.neighborhood,
      regionCutCode: profile.regionCutCode,
      communeCutCode: profile.communeCutCode,
      regionName: profile.regionName ?? null,
      communeName: profile.communeName ?? null,
      countryCode: profile.countryCode,
      brandVoiceKeywords: profile.brandVoiceKeywords,
      wordsToAvoid: profile.wordsToAvoid,
      preferredEmojiSemantics: profile.preferredEmojiSemantics,
      primaryCustomerProfile: profile.primaryCustomerProfile ?? '',
      commonObjections: profile.commonObjections,
      ready: profile.profileCompletedAt !== null,
    };
  }

  private normalizeSuggestions(parsed: Record<string, unknown>): RecommendationSuggestion[] {
    const suggestions = this.coerceSuggestionArray(parsed['suggestions']);

    const fallbackHeadline = parsed['headline'];
    const fallbackPrimaryText = parsed['primaryText'];

    return suggestions.map((raw) => {
      const coerced: RecommendationSuggestion = {
        primaryText: this.normalizeRequiredField(
          raw.primaryText,
          fallbackPrimaryText,
          PRIMARY_TEXT_MAX,
        ),
        headline: this.normalizeRequiredField(raw.headline, fallbackHeadline, HEADLINE_MAX),
      };
      return coerced;
    });
  }

  private coerceSuggestionArray(value: unknown): Array<{
    primaryText: unknown;
    headline: unknown;
  }> {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return { primaryText: undefined, headline: undefined };
      }
      const obj = entry as Record<string, unknown>;
      return {
        primaryText: obj['primaryText'],
        headline: obj['headline'],
      };
    });
  }

  /**
   * Normaliza un campo obligatorio. Devuelve la primera cadena no vacía
   * encontrada entre los candidatos; si ninguno aporta, devuelve `''` (el
   * validador posterior lo marcará como error).
   */
  private normalizeRequiredField(primary: unknown, fallback: unknown, max: number): string {
    const candidates: unknown[] = [primary, fallback];
    for (const candidate of candidates) {
      const coerced = this.coerceString(candidate);
      if (coerced !== null && coerced.length > 0) {
        return this.truncate(coerced, max);
      }
    }
    return '';
  }

  private coerceString(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return null;
  }

  private truncate(value: string, max: number): string {
    if (value.length <= max) return value;
    return value.slice(0, max);
  }

  private validateSuggestions(
    raw: RecommendationSuggestion[],
    mode: RecommendationMode,
    fallbackHeadline: string,
    locationNote: string,
  ): RecommendationSuggestion[] {
    if (raw.length !== SUGGESTIONS_LENGTH) {
      this.logger.error(
        `OpenAI devolvió ${raw.length} sugerencias; se esperaban ${SUGGESTIONS_LENGTH}.`,
      );
      throw new ServiceUnavailableException(
        `No se pudo consultar OpenAI: se esperaban ${SUGGESTIONS_LENGTH} sugerencias y llegaron ${raw.length}`,
      );
    }

    const finalSuggestions: RecommendationSuggestion[] = [];
    for (const suggestion of raw) {
      const truncatedPrimaryText =
        suggestion.primaryText && suggestion.primaryText.length > 0
          ? suggestion.primaryText.slice(0, PRIMARY_TEXT_MAX)
          : '';

      if (truncatedPrimaryText.length === 0) {
        this.logger.error(
          `Sugerencia inválida (sin primaryText): ${JSON.stringify({
            primaryText: '',
            headline: suggestion.headline,
          })}`,
        );
        throw new ServiceUnavailableException(
          'No se pudo consultar OpenAI: una sugerencia quedó vacía tras normalizar',
        );
      }

      const rawHeadline = suggestion.headline;
      const needsHeadlineFallback = rawHeadline.trim().length < 2;
      const resolvedHeadline = needsHeadlineFallback
        ? this.extractHeadlineFromPrimaryText(truncatedPrimaryText, fallbackHeadline, locationNote)
        : rawHeadline.slice(0, HEADLINE_MAX);

      if (resolvedHeadline.length === 0) {
        this.logger.error(
          `Sugerencia inválida (sin primaryText ni headline extraíble): ${JSON.stringify({
            primaryText: truncatedPrimaryText,
            headline: resolvedHeadline,
          })}`,
        );
        throw new ServiceUnavailableException(
          'No se pudo consultar OpenAI: una sugerencia quedó vacía tras normalizar',
        );
      }

      const normalized: RecommendationSuggestion =
        mode === 'INITIAL' || mode === 'REGENERATE_PRIMARY_TEXT'
          ? {
              primaryText: this.ensureBusinessLocationNote(truncatedPrimaryText, locationNote),
              headline: resolvedHeadline,
            }
          : {
              primaryText: truncatedPrimaryText,
              headline: resolvedHeadline,
            };

      finalSuggestions.push(normalized);
    }
    return finalSuggestions;
  }

  private extractHeadlineFromPrimaryText(
    primaryText: string,
    fallbackHeadline: string,
    locationNote: string,
  ): string {
    let text = primaryText;

    if (text.endsWith(locationNote + '\n')) {
      text = text.slice(0, -(locationNote.length + 1));
    } else if (text.endsWith(locationNote)) {
      text = text.slice(0, -locationNote.length);
    }

    text = text.replace(/#[^\s#]+/gu, ' ');
    text = text.replace(/\p{Extended_Pictographic}/gu, '');

    const candidates = text
      .split(/[\n.!?|]+/u)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 0);

    const meaningfulRegex = /[\p{L}\p{N}]{3,}/u;
    const meaningful = candidates.find((sentence) => meaningfulRegex.test(sentence));

    let headline = meaningful
      ? meaningful
      : fallbackHeadline.trim().length > 0
        ? fallbackHeadline.trim()
        : 'Tu cambio ideal';

    headline = headline.replace(/\s+/g, ' ').trim();
    headline = headline.replace(/^[\s|:;,.\-–—]+|[\s|:;,.\-–—]+$/gu, '');

    const words = headline.split(/\s+/).filter((word) => word.length > 0);
    if (words.length > 8) {
      headline = words.slice(0, 8).join(' ');
    }

    if (headline.length > HEADLINE_MAX) {
      headline = headline.slice(0, HEADLINE_MAX).trim();
    }

    return headline;
  }

  /**
   * Garantiza que el `primaryText` termine con el sufijo canónico
   * `locationNote + '\n'`. Si ya lo trae, no modifica; si no, lo añade al
   * final. Si el resultado supera `PRIMARY_TEXT_MAX`, trunca el prefijo de
   * forma conservadora respetando la última línea completa posible que aún
   * permita alojar el sufijo (esto último solo si es estrictamente
   * necesario; en general los 2000 caracteres son suficientes).
   *
   * Casos cubiertos:
   * 1. Ya termina con el sufijo canónico → no se modifica.
   * 2. Termina con `locationNote` pero sin el `\n` final → se añade
   *    únicamente el `\n` faltante para evitar duplicar la dirección.
   * 3. No contiene la dirección al final → se concatena el sufijo canónico
   *    completo, truncando a líneas completas si no cabiera.
   */
  private ensureBusinessLocationNote(primaryText: string, locationNote: string): string {
    const suffix = locationNote + '\n';

    if (primaryText.endsWith(suffix)) {
      return primaryText;
    }

    if (primaryText.endsWith(locationNote)) {
      const withNewline = primaryText + '\n';
      if (withNewline.length <= PRIMARY_TEXT_MAX) {
        return withNewline;
      }
      const maxWithoutSuffix = PRIMARY_TEXT_MAX - 1;
      return primaryText.slice(0, maxWithoutSuffix) + '\n';
    }

    const candidate = primaryText + suffix;
    if (candidate.length <= PRIMARY_TEXT_MAX) {
      return candidate;
    }

    const maxPrefixLength = PRIMARY_TEXT_MAX - suffix.length;
    let prefix = primaryText.slice(0, maxPrefixLength);
    const lastNewlineIdx = prefix.lastIndexOf('\n');
    if (lastNewlineIdx > 0) {
      prefix = prefix.slice(0, lastNewlineIdx + 1);
    }
    return prefix + suffix;
  }
}
