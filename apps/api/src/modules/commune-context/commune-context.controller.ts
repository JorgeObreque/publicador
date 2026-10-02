import {
  Controller,
  Get,
  NotFoundException,
  Param,
} from '@nestjs/common';
import { TerritoryService } from '../territory/territory.service';
import { CommuneContextService } from './commune-context.service';
import type { SantiagoMetroCommuneContext } from './data/santiago-metro.context';

/**
 * Endpoints HTTP de la capa de contexto socioeconómico orientativo.
 *
 * Son de libre acceso (sin autenticación), igual que los endpoints de
 * `TerritoryController`: la información es pública y agregada a nivel
 * comunal (no son datos personales).
 *
 * Rutas:
 * - `GET /api/v1/commune-context/communes/:cut` → ficha de contexto de
 *   una comuna. 404 si la comuna no existe o no tiene contexto.
 * - `GET /api/v1/commune-context/regions/:cut/summary` → resumen
 *   agregado de las comunas con contexto dentro de una región.
 *
 * El prefijo global lo aplica `main.ts` (`api/v1`).
 */
@Controller('commune-context')
export class CommuneContextController {
  constructor(
    private readonly communeContext: CommuneContextService,
    private readonly territory: TerritoryService,
  ) {}

  @Get('communes/:cut')
  getCommuneContext(@Param('cut') cut: string) {
    const entry = this.communeContext.getContext(cut);
    if (!entry) {
      throw new NotFoundException(
        `Sin contexto socioeconómico disponible para la comuna ${cut}`,
      );
    }
    const commune = this.territory.findCommuneByCut(entry.cutCode);
    return {
      context: entry,
      commune,
      neighbors: this.communeContext.compareNeighborCommunes(entry.cutCode),
    };
  }

  @Get('regions/:cut/summary')
  getRegionSummary(@Param('cut') cut: string) {
    const region = this.territory.findRegionByCut(cut);
    if (!region) {
      throw new NotFoundException(`Región ${cut} no encontrada`);
    }
    const entries: readonly SantiagoMetroCommuneContext[] =
      this.communeContext.listForRegion(region.cutCode);
    return {
      region,
      totalCommunes: entries.length,
      entries,
    };
  }
}