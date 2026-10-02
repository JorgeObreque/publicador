import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { TerritoryService } from './territory.service';

/**
 * Endpoints HTTP del catálogo territorial de Chile.
 *
 * Son de libre acceso (sin autenticación): el catálogo es público y se
 * usa para alimentar formularios y, en el futuro, selectores de
 * audiencia. El prefijo global lo aplica `main.ts` (`api/v1`).
 *
 * Rutas:
 * - `GET /api/v1/territory/regions` → lista las 16 regiones.
 * - `GET /api/v1/territory/regions/:cut/communes` → comunas de la región.
 * - `GET /api/v1/territory/communes?query=&region=` → búsqueda parcial.
 * - `GET /api/v1/territory/communes/:cut` → ficha de una comuna (incluye
 *   la región a la que pertenece para que el cliente web pueda
 *   preseleccionar el selector jerárquico).
 *
 * Nota sobre los códigos: los CUT son strings (`'01'`, `'13114'`, etc.)
 * porque preservan ceros a la izquierda; NestJS los entrega tal cual
 * desde el path. No se hace coerción numérica.
 */
@Controller('territory')
export class TerritoryController {
  constructor(private readonly territory: TerritoryService) {}

  @Get('regions')
  listRegions() {
    return { regions: this.territory.listRegions() };
  }

  @Get('regions/:cut/communes')
  listCommunesByRegion(@Param('cut') cut: string) {
    const region = this.territory.findRegionByCut(cut);
    if (!region) {
      throw new NotFoundException(`Región ${cut} no encontrada`);
    }
    return {
      region,
      communes: this.territory.listCommunesByRegion(cut),
    };
  }

  @Get('communes')
  searchCommunes(
    @Query('query') query?: string,
    @Query('region') region?: string,
  ) {
    const trimmedQuery = (query ?? '').trim();
    const trimmedRegion = (region ?? '').trim();
    if (trimmedRegion.length > 0 && !this.territory.findRegionByCut(trimmedRegion)) {
      throw new BadRequestException(`Región inválida: ${trimmedRegion}`);
    }
    return {
      query: trimmedQuery,
      region: trimmedRegion.length > 0 ? trimmedRegion : null,
      communes: this.territory.searchCommunes(
        trimmedQuery,
        trimmedRegion.length > 0 ? trimmedRegion : undefined,
      ),
    };
  }

  @Get('communes/:cut')
  getCommune(@Param('cut') cut: string) {
    const commune = this.territory.findCommuneByCut(cut);
    if (!commune) {
      throw new NotFoundException(`Comuna ${cut} no encontrada`);
    }
    const region = this.territory.getRegionByCommune(cut);
    return { commune, region };
  }
}