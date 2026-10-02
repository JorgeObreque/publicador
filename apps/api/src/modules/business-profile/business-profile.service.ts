import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { BusinessProfile, Prisma } from '@prisma/client';
import { prisma } from '@publicador/database';
import { BusinessContextResolver } from '../../shared/business-context/business-context.resolver';
import { CommuneContextService } from '../commune-context/commune-context.service';
import type { SantiagoMetroCommuneContext } from '../commune-context/data/santiago-metro.context';
import { TerritoryService } from '../territory/territory.service';
import {
  DEFAULT_COUNTRY_CODE,
  type BusinessProfileResponse,
  type UpsertBusinessProfileInput,
} from './dto/business-profile.dto';

/**
 * Servicio que gestiona el `BusinessProfile` persistente del negocio
 * configurado en `BUSINESS_ID`. Es el primer paso del plan publicitario
 * estratégico: la realidad del negocio (dirección territorial oficial,
 * voz, clienta ideal, restricciones de marca, metas) que el resto de IA,
 * briefs y planes de medios consultarán.
 *
 * A partir del corte territorial SUBDERE 2018, los campos libres
 * `city/region/country` se reemplazaron por códigos oficiales:
 * - `regionCutCode` y `communeCutCode` validados contra el `TerritoryService`
 *   (catálogo versionado en memoria).
 * - `countryCode` se rellena a `CL` por defecto si el cliente lo omite.
 *
 * En esta entrega es de **solo lectura** para los consumidores: lo escribe
 * únicamente el módulo HTTP (`POST /api/v1/business-profile`). El resto de
 * módulos lo lee via `BUSINESS_PROFILE_SERVICE`.
 */
@Injectable()
export class BusinessProfileService {
  private readonly logger = new Logger(BusinessProfileService.name);

  constructor(
    private readonly businessContext: BusinessContextResolver,
    private readonly territory: TerritoryService,
    private readonly communeContext: CommuneContextService,
  ) {}

  private get businessId(): string {
    return this.businessContext.resolve().businessId;
  }

  /**
   * Devuelve el perfil actual. Si no existe, crea uno vacío (todos los
   * campos opcionales en null/[] salvo `primaryCustomerProfile` que arranca
   * como string vacío) y lo persiste. Nunca devuelve `null`.
   */
  async getOrCreate(): Promise<BusinessProfile> {
    const existing = await prisma.businessProfile.findUnique({
      where: { businessId: this.businessId },
    });
    if (existing) return existing;
    return prisma.businessProfile.create({
      data: {
        businessId: this.businessId,
        primaryCustomerProfile: '',
        commonObjections: [],
        qualifyingQuestions: [],
        brandVoiceKeywords: [],
        wordsToAvoid: [],
        preferredEmojiSemantics: [],
        differentiators: [],
      },
    });
  }

  /**
   * Aplica un upsert validado por Zod. Valida pertenencia
   * región/comuna contra el `TerritoryService` (catálogo SUBDERE 2018) y
   * rellena `countryCode` con `CL` si el cliente lo omitió. Si tras aplicar
   * los campos críticos están completos (`addressLine`, `neighborhood`,
   * `regionCutCode`, `communeCutCode`, `primaryCustomerProfile` con texto
   * no vacío, `qualifyingQuestions` con al menos un ítem y
   * `brandVoiceKeywords` con al menos un ítem) y `profileCompletedAt` aún
   * no estaba seteado, lo marca con `new Date()`. Esta función es
   * idempotente: editar campos no críticos NO desmarca un perfil
   * previamente completado.
   */
  async upsert(input: UpsertBusinessProfileInput): Promise<BusinessProfile> {
    const businessId = this.businessId;
    const existing = await prisma.businessProfile.findUnique({
      where: { businessId },
    });

    const regionCutCode = this.resolveRegionCutCode(input.regionCutCode);
    const communeCutCode = this.resolveCommuneCutCode(
      input.communeCutCode,
      regionCutCode,
    );
    const countryCode = (input.countryCode ?? existing?.countryCode ?? DEFAULT_COUNTRY_CODE)
      .trim()
      .slice(0, 8);

    const data: Prisma.BusinessProfileUpdateInput = {
      addressLine: input.addressLine,
      neighborhood: input.neighborhood,
      phone: input.phone,
      whatsappNumber: input.whatsappNumber,
      publicEmail: input.publicEmail,
      googleMapsUrl: input.googleMapsUrl,
      brandVoiceKeywords: input.brandVoiceKeywords,
      wordsToAvoid: input.wordsToAvoid,
      preferredEmojiSemantics: input.preferredEmojiSemantics,
      primaryCustomerProfile: input.primaryCustomerProfile,
      commonObjections: input.commonObjections,
      qualifyingQuestions: input.qualifyingQuestions,
      weeklyServiceCapacity: input.weeklyServiceCapacity,
      monthlyAcquisitionGoal: input.monthlyAcquisitionGoal,
      tagline: input.tagline,
      differentiators: input.differentiators,
      countryCode,
    };
    if (input.nearbyCommunesCutCodes !== undefined) {
      data.nearbyCommunesCutCodes = input.nearbyCommunesCutCodes;
    }
    if (regionCutCode !== undefined) data.regionCutCode = regionCutCode;
    if (communeCutCode !== undefined) data.communeCutCode = communeCutCode;
    if (input.monthlyRevenueTarget !== undefined) {
      data.monthlyRevenueTarget = input.monthlyRevenueTarget;
    }
    if (input.costPerAcquisitionCap !== undefined) {
      data.costPerAcquisitionCap = input.costPerAcquisitionCap;
    }

    const completed = this.evaluateCompletion({
      addressLine: input.addressLine ?? existing?.addressLine ?? null,
      neighborhood: input.neighborhood ?? existing?.neighborhood ?? null,
      regionCutCode: regionCutCode ?? existing?.regionCutCode ?? null,
      communeCutCode: communeCutCode ?? existing?.communeCutCode ?? null,
      primaryCustomerProfile:
        input.primaryCustomerProfile ?? existing?.primaryCustomerProfile ?? null,
      qualifyingQuestions:
        input.qualifyingQuestions ?? (existing?.qualifyingQuestions ?? []),
      brandVoiceKeywords: input.brandVoiceKeywords ?? (existing?.brandVoiceKeywords ?? []),
    });

    if (completed && !existing?.profileCompletedAt) {
      data.profileCompletedAt = new Date();
    }

    return prisma.businessProfile.upsert({
      where: { businessId },
      create: {
        businessId,
        addressLine: input.addressLine,
        neighborhood: input.neighborhood,
        regionCutCode,
        communeCutCode,
        countryCode,
        phone: input.phone,
        whatsappNumber: input.whatsappNumber,
        publicEmail: input.publicEmail,
        googleMapsUrl: input.googleMapsUrl,
        brandVoiceKeywords: input.brandVoiceKeywords,
        wordsToAvoid: input.wordsToAvoid,
        preferredEmojiSemantics: input.preferredEmojiSemantics,
        primaryCustomerProfile: input.primaryCustomerProfile,
        commonObjections: input.commonObjections,
        qualifyingQuestions: input.qualifyingQuestions,
        weeklyServiceCapacity: input.weeklyServiceCapacity,
        monthlyAcquisitionGoal: input.monthlyAcquisitionGoal,
        monthlyRevenueTarget: input.monthlyRevenueTarget,
        costPerAcquisitionCap: input.costPerAcquisitionCap,
        tagline: input.tagline,
        differentiators: input.differentiators,
        nearbyCommunesCutCodes: input.nearbyCommunesCutCodes ?? [],
        ...(completed ? { profileCompletedAt: new Date() } : {}),
      },
      update: data,
    });
  }

  /**
   * Fuerza el flag `profileCompletedAt` a `now()` si no estaba ya seteado.
   * Útil para que el operador pueda completar el perfil manualmente sin
   * editar los campos críticos.
   */
  async markCompleted(): Promise<BusinessProfile> {
    const existing = await this.getOrCreate();
    if (existing.profileCompletedAt) {
      return existing;
    }
    return prisma.businessProfile.update({
      where: { businessId: this.businessId },
      data: { profileCompletedAt: new Date() },
    });
  }

  /**
   * Devuelve `true` si el perfil está marcado como completado.
   */
  isReady(profile: Pick<BusinessProfile, 'profileCompletedAt'> | null): boolean {
    return Boolean(profile && profile.profileCompletedAt);
  }

  /**
   * Compone el bloque de contexto territorial que consume la UI y los
   * módulos de IA: nombres oficiales de región/comuna, códigos CUT y el
   * contexto socioeconómico ORIENTATIVO de la comuna (cuando está
   * disponible en el catálogo interno). Si el perfil no tiene comuna
   * seleccionada, `context` se devuelve como `null` (NO se inventa).
   *
   * Adicionalmente, cuando la comuna pertenece a la Región Metropolitana
   * (cut '13') y tiene contexto, devuelve también un top 10 de comunas
   * vecinas por ingreso estimado del hogar (ver
   * `CommuneContextService.compareNeighborCommunes`). Para comunas de
   * otras regiones, `neighbors` queda como `[]` para mantener el contrato
   * estable.
   */
  getBusinessContext(
    profile: BusinessProfile | null,
  ): {
    regionName: string | null;
    communeName: string | null;
    regionCutCode: string | null;
    communeCutCode: string | null;
    context: SantiagoMetroCommuneContext | null;
    neighbors: readonly SantiagoMetroCommuneContext[];
  } {
    if (!profile) {
      return {
        regionName: null,
        communeName: null,
        regionCutCode: null,
        communeCutCode: null,
        context: null,
        neighbors: [],
      };
    }
    const region = profile.regionCutCode
      ? this.territory.findRegionByCut(profile.regionCutCode) ?? null
      : null;
    const commune = profile.communeCutCode
      ? this.territory.findCommuneByCut(profile.communeCutCode) ?? null
      : null;
    const context = profile.communeCutCode
      ? this.communeContext.getContext(profile.communeCutCode)
      : null;
    const neighbors = profile.communeCutCode
      ? this.communeContext.compareNeighborCommunes(profile.communeCutCode)
      : [];
    return {
      regionName: region?.name ?? null,
      communeName: commune?.name ?? null,
      regionCutCode: profile.regionCutCode,
      communeCutCode: profile.communeCutCode,
      context,
      neighbors,
    };
  }

  /**
   * Devuelve un string amigable en español para mostrar al usuario y para
   * inyectar en prompts: "<addressLine>, <commune>, <region>" (omitiendo
   * el `neighborhood` cuando coincide con la comuna oficial para no
   * duplicarlo). Si alguno de los códigos territoriales no resuelve a un
   * nombre oficial, se omite esa parte (no se inventa) y se cae al
   * `neighborhood` libre como fallback.
   *
   * Se usa desde `creative-recommendations` para construir el `locationNote`
   * que se inyecta al system prompt y al user prompt.
   */
  getDisplayLocation(profile: BusinessProfile | null): string {
    if (!profile) return '';
    const parts: string[] = [];
    const communeName = profile.communeCutCode
      ? this.territory.findCommuneByCut(profile.communeCutCode)?.name ?? null
      : null;
    const region = profile.regionCutCode
      ? this.territory.findRegionByCut(profile.regionCutCode) ?? null
      : null;
    if (communeName) parts.push(communeName);
    if (region?.name) parts.push(region.name);
    const composed = parts.join(', ');
    if (composed.length === 0) return '';
    const addressLine = typeof profile.addressLine === 'string' ? profile.addressLine.trim() : '';
    const neighborhood = typeof profile.neighborhood === 'string' ? profile.neighborhood.trim() : '';
    const neighborhoodPart =
      neighborhood.length > 0 && neighborhood.toLowerCase() !== (communeName ?? '').toLowerCase()
        ? neighborhood
        : '';
    const addressPrefix = [addressLine, neighborhoodPart]
      .filter((part) => part.length > 0)
      .join(', ');
    return addressPrefix.length > 0 ? `${addressPrefix}, ${composed}` : composed;
  }

  private resolveRegionCutCode(input: string | undefined): string | undefined {
    if (input === undefined) return undefined;
    const trimmed = input.trim();
    if (trimmed.length === 0) return undefined;
    const region = this.territory.findRegionByCut(trimmed);
    if (!region) {
      throw new BadRequestException(`Región inválida: ${trimmed}`);
    }
    return region.cutCode;
  }

  private resolveCommuneCutCode(
    input: string | undefined,
    regionCutCode: string | undefined,
  ): string | undefined {
    if (input === undefined) return undefined;
    const trimmed = input.trim();
    if (trimmed.length === 0) return undefined;
    const commune = this.territory.findCommuneByCut(trimmed);
    if (!commune) {
      throw new BadRequestException(`Comuna inválida: ${trimmed}`);
    }
    if (regionCutCode && commune.regionCutCode !== regionCutCode) {
      throw new BadRequestException('La comuna no pertenece a la región seleccionada');
    }
    return commune.cutCode;
  }

  private evaluateCompletion(profile: {
    addressLine: string | null | undefined;
    neighborhood: string | null | undefined;
    regionCutCode: string | null | undefined;
    communeCutCode: string | null | undefined;
    primaryCustomerProfile: string | null | undefined;
    qualifyingQuestions: string[] | null | undefined;
    brandVoiceKeywords: string[] | null | undefined;
  }): boolean {
    const addressLine =
      typeof profile.addressLine === 'string' ? profile.addressLine.trim() : '';
    const neighborhood =
      typeof profile.neighborhood === 'string' ? profile.neighborhood.trim() : '';
    const regionCutCode =
      typeof profile.regionCutCode === 'string' ? profile.regionCutCode.trim() : '';
    const communeCutCode =
      typeof profile.communeCutCode === 'string' ? profile.communeCutCode.trim() : '';
    const customerProfile =
      typeof profile.primaryCustomerProfile === 'string'
        ? profile.primaryCustomerProfile.trim()
        : '';
    const questions = Array.isArray(profile.qualifyingQuestions)
      ? profile.qualifyingQuestions.filter(
          (q) => typeof q === 'string' && q.trim().length > 0,
        )
      : [];
    const keywords = Array.isArray(profile.brandVoiceKeywords)
      ? profile.brandVoiceKeywords.filter(
          (k) => typeof k === 'string' && k.trim().length > 0,
        )
      : [];
    return (
      addressLine.length > 0 &&
      neighborhood.length > 0 &&
      regionCutCode.length > 0 &&
      communeCutCode.length > 0 &&
      customerProfile.length > 0 &&
      questions.length >= 1 &&
      keywords.length >= 1
    );
  }
}

/**
 * Serializa un `BusinessProfile` de Prisma a la forma pública de la API.
 * Resuelve `regionName`/`communeName` consultando el `TerritoryService`
 * para evitar que el frontend tenga que hacer una segunda llamada.
 *
 * Mantiene los `Decimal` como string para preservar precisión.
 */
export function serializeBusinessProfile(
  profile: BusinessProfile,
  territory: TerritoryService,
): BusinessProfileResponse {
  const region = profile.regionCutCode
    ? territory.findRegionByCut(profile.regionCutCode)
    : null;
  const commune = profile.communeCutCode
    ? territory.findCommuneByCut(profile.communeCutCode)
    : null;
  return {
    id: profile.id,
    businessId: profile.businessId,
    addressLine: profile.addressLine,
    neighborhood: profile.neighborhood,
    regionCutCode: profile.regionCutCode,
    communeCutCode: profile.communeCutCode,
    regionName: region?.name ?? null,
    communeName: commune?.name ?? null,
    countryCode: profile.countryCode,
    phone: profile.phone,
    whatsappNumber: profile.whatsappNumber,
    publicEmail: profile.publicEmail,
    googleMapsUrl: profile.googleMapsUrl,
    brandVoiceKeywords: profile.brandVoiceKeywords,
    wordsToAvoid: profile.wordsToAvoid,
    preferredEmojiSemantics: profile.preferredEmojiSemantics,
    primaryCustomerProfile: profile.primaryCustomerProfile ?? '',
    commonObjections: profile.commonObjections,
    qualifyingQuestions: profile.qualifyingQuestions,
    weeklyServiceCapacity: profile.weeklyServiceCapacity,
    monthlyRevenueTarget:
      profile.monthlyRevenueTarget === null ? null : profile.monthlyRevenueTarget.toString(),
    monthlyAcquisitionGoal: profile.monthlyAcquisitionGoal,
    costPerAcquisitionCap:
      profile.costPerAcquisitionCap === null ? null : profile.costPerAcquisitionCap.toString(),
    tagline: profile.tagline,
    differentiators: profile.differentiators,
    nearbyCommunesCutCodes: profile.nearbyCommunesCutCodes,
    profileCompletedAt:
      profile.profileCompletedAt === null ? null : profile.profileCompletedAt.toISOString(),
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}
