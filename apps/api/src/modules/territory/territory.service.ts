import { Injectable } from '@nestjs/common';
import {
  REGIONS,
  findCommune,
  findRegion,
  regionByCommune,
  searchCommunes,
  communesByRegion,
} from './data/chile-territory';
import type { Commune, Region } from './data/chile-territory.types';

/**
 * Servicio de sólo lectura que expone el catálogo territorial de Chile.
 *
 * Es deliberadamente "stateless": los datos viven en el módulo
 * `data/chile-territory.ts` y se cargan en memoria al bootear el
 * backend. No persiste nada en Prisma: cuando llegue el momento de
 * guardar la comuna/región preferida por un negocio (en `BusinessProfile`
 * o en un futuro selector de audiencia), se seguirá almacenando como
 * `cutCode` (string) en la columna correspondiente.
 *
 * Se expone como `@Global()` desde `TerritoryModule` para que cualquier
 * módulo futuro (analítica, segmentación por audiencia, etc.) pueda
 * inyectarlo sin tener que volver a declararlo en `imports`.
 */
@Injectable()
export class TerritoryService {
  /** Devuelve las 16 regiones ordenadas por `cutCode` ascendente. */
  listRegions(): readonly Region[] {
    return REGIONS;
  }

  /**
   * Devuelve las comunas de la región identificada por CUT.
   * Devuelve `[]` si la región no existe (NO lanza) para que el
   * controlador pueda responder 404 desde el caller.
   */
  listCommunesByRegion(regionCut: string): readonly Commune[] {
    return communesByRegion(regionCut);
  }

  /**
   * Búsqueda parcial por nombre de comuna. Si se entrega `regionCut`,
   * filtra adicionalmente por región. Vacío → array vacío.
   */
  searchCommunes(query: string, regionCut?: string): readonly Commune[] {
    return searchCommunes(query, regionCut);
  }

  /**
   * Resuelve la región a la que pertenece una comuna. Devuelve `null` si
   * la comuna no existe (el controlador traduce a 404).
   */
  getRegionByCommune(communeCut: string): Region | null {
    return regionByCommune(communeCut) ?? null;
  }

  /**
   * Búsqueda parcial por nombre de región. Misma semántica que
   * `searchCommunes` pero aplicada a `REGIONS`. Sin paginación por ahora
   * (sólo son 16 filas).
   */
  searchRegions(query: string): readonly Region[] {
    const needle = query
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
    if (needle.length === 0) return REGIONS;
    const matches = REGIONS.filter((r) =>
      r.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .includes(needle),
    );
    return matches;
  }

  /**
   * Helper expuesto por simetría con `searchCommunes`: dada un CUT de
   * comuna, devuelve la ficha serializada. Si no existe, devuelve
   * `null`. Se usa desde el endpoint `GET /communes/:cut`.
   */
  findCommuneByCut(cut: string): Commune | null {
    return findCommune(cut) ?? null;
  }

  /**
   * Helper expuesto por simetría: devuelve la región a partir de su CUT
   * o `null` si no existe (el controlador responde 404).
   */
  findRegionByCut(cut: string): Region | null {
    return findRegion(cut) ?? null;
  }
}