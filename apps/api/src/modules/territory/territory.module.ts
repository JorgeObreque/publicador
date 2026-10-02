import { Global, Module } from '@nestjs/common';
import { TerritoryController } from './territory.controller';
import { TerritoryService } from './territory.service';

/**
 * Módulo del catálogo territorial de Chile.
 *
 * Carga en memoria las 16 regiones y 346 comunas (ver
 * `data/chile-territory.ts`) y las expone vía:
 * - HTTP: `GET /api/v1/territory/*` (sin autenticación, ver controlador).
 * - DI: `TerritoryService`, pensado para que módulos futuros (segmentación
 *   de audiencia, validaciones de dirección, formularios de targeting
 *   geográfico en Meta) lo reutilicen sin tener que volver a importar
 *   este módulo.
 *
 * Por eso va con `@Global()`: cualquier módulo que inyecte
 * `TerritoryService` lo obtiene sin declararlo en su array de `imports`,
 * igual que ya ocurre con `BusinessContextResolver`.
 */
@Global()
@Module({
  controllers: [TerritoryController],
  providers: [TerritoryService],
  exports: [TerritoryService],
})
export class TerritoryModule {}