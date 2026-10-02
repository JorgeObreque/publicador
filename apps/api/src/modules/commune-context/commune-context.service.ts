import { Injectable } from '@nestjs/common';
import { TerritoryService } from '../territory/territory.service';
import {
  SANTIAGO_METRO_CONTEXT,
  type SantiagoMetroCommuneContext,
} from './data/santiago-metro.context';

/**
 * Servicio que expone la capa ORIENTATIVA de contexto socioeconómico de las
 * 52 comunas de la Región Metropolitana de Santiago (cut prefix '13').
 *
 * Los datos viven en `data/santiago-metro.context.ts` como un array
 * estático y NO se persisten en Prisma: son una estimación a nivel
 * comunal versionada en código, pensada para alimentar la UI del
 * BusinessProfile y, opcionalmente, prompts de marketing/IA.
 *
 * Reglas:
 *  - Si una comuna no tiene entrada, NO se aproxima: el helper devuelve
 *    `null` y el caller decide si ocultar el bloque o devolver 404.
 *  - El módulo NO usa OpenAI ni servicios externos.
 *  - Expuesto como `@Global()` (ver `CommuneContextModule`) para que
 *    otros módulos puedan inyectarlo sin redeclararlo en `imports`.
 */
@Injectable()
export class CommuneContextService {
  private readonly index: Map<string, SantiagoMetroCommuneContext>;

  constructor(private readonly territory: TerritoryService) {
    this.index = new Map();
    for (const entry of SANTIAGO_METRO_CONTEXT) {
      this.index.set(entry.cutCode, entry);
    }
  }

  /**
   * Devuelve el contexto socioeconómico estimado para una comuna, validando
   * primero que exista en el catálogo territorial oficial. Devuelve
   * `null` si la comuna no existe o no tiene contexto cargado.
   */
  getContext(cut: string): SantiagoMetroCommuneContext | null {
    const trimmed = cut.trim();
    if (trimmed.length === 0) return null;
    const commune = this.territory.findCommuneByCut(trimmed);
    if (!commune) return null;
    return this.index.get(commune.cutCode) ?? null;
  }

  /**
   * Devuelve las entradas de contexto de todas las comunas de una región
   * (filtrando por el `regionCutCode` con `startsWith` sobre el CUT).
   *
   * Importante: el parámetro es un prefijo CUT (string), no una región
   * completa. Esto permite pedir, por ejemplo, sólo las comunas '13*'
   * (RM) o '13' (que también coincidiría con el código de región).
   * Si la región no existe en el catálogo territorial, devuelve `[]`.
   */
  listForRegion(regionCut: string): readonly SantiagoMetroCommuneContext[] {
    const trimmed = regionCut.trim();
    if (trimmed.length === 0) return [];
    if (!this.territory.findRegionByCut(trimmed)) return [];
    const region = this.territory.findRegionByCut(trimmed);
    if (!region) return [];
    const regionCommunes = this.territory.listCommunesByRegion(region.cutCode);
    const result: SantiagoMetroCommuneContext[] = [];
    for (const commune of regionCommunes) {
      const entry = this.index.get(commune.cutCode);
      if (entry) result.push(entry);
    }
    return result;
  }

  /**
   * Devuelve las 10 comunas vecinas con mayor `avgHouseholdIncomeCLP`
   * estimado dentro de la Región Metropolitana de Santiago. La comuna
   * consultada se excluye del resultado.
   *
   * Si la comuna no pertenece a la RM o no existe, devuelve `[]`.
   * Si la comuna pertenece a la RM pero no tiene contexto cargado, se
   * devuelve el ranking de las otras 51 comunas igualmente.
   */
  compareNeighborCommunes(cut: string): readonly SantiagoMetroCommuneContext[] {
    const trimmed = cut.trim();
    if (trimmed.length === 0) return [];
    const commune = this.territory.findCommuneByCut(trimmed);
    if (!commune) return [];
    if (commune.regionCutCode !== '13') return [];
    return SANTIAGO_METRO_CONTEXT
      .filter((entry) => entry.cutCode !== commune.cutCode)
      .slice()
      .sort((a, b) => b.avgHouseholdIncomeCLP - a.avgHouseholdIncomeCLP)
      .slice(0, 10);
  }

  /**
   * Devuelve el total de comunas con contexto cargado. Útil para tests
   * y para que la UI pueda mostrar "Cubrimos N comunas de la RM".
   */
  count(): number {
    return this.index.size;
  }

  /**
   * Devuelve todas las entradas (ordenadas por `cutCode` ascendente).
   * Pensado para serializar en el endpoint de resumen regional.
   */
  listAll(): readonly SantiagoMetroCommuneContext[] {
    return SANTIAGO_METRO_CONTEXT.slice().sort((a, b) =>
      a.cutCode.localeCompare(b.cutCode),
    );
  }
}