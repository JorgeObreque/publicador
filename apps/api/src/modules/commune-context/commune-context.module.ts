import { Global, Module } from '@nestjs/common';
import { CommuneContextController } from './commune-context.controller';
import { CommuneContextService } from './commune-context.service';

/**
 * Módulo que expone la capa de contexto socioeconómico orientativo de las
 * 52 comunas de la Región Metropolitana de Santiago.
 *
 * Carga en memoria las entradas desde
 * `data/santiago-metro.context.ts` (sin tocar Prisma) y las expone vía:
 *  - HTTP: `GET /api/v1/commune-context/*` (sin autenticación, ver
 *    controlador).
 *  - DI: `CommuneContextService`, pensado para que `BusinessProfileService`
 *    y futuros módulos (segmentación, briefs) lo reutilicen sin tener
 *    que volver a importar este módulo.
 *
 * Se declara `@Global()` siguiendo el mismo patrón que `TerritoryModule`,
 * porque la información es transversal al producto.
 *
 * `TerritoryModule` también es `@Global`, por lo que el catálogo
 * territorial queda accesible automáticamente desde este módulo.
 */
@Global()
@Module({
  controllers: [CommuneContextController],
  providers: [CommuneContextService],
  exports: [CommuneContextService],
})
export class CommuneContextModule {}