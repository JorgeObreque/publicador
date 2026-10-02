import { Module } from '@nestjs/common';
import { BusinessContextModule } from '../../shared/business-context/business-context.module';
import { BusinessProfileController } from './business-profile.controller';
import { BusinessProfileService } from './business-profile.service';
import { BUSINESS_PROFILE_SERVICE } from './business-profile.tokens';

/**
 * Módulo que expone el `BusinessProfile` persistente del negocio.
 *
 * Registra `BusinessProfileService` y lo expone bajo el token
 * `BUSINESS_PROFILE_SERVICE` para que el resto de módulos (especialmente
 * `creative-recommendations`) puedan consumirlo. Los tests de integración
 * pueden sustituirlo mockeando el provider con la misma técnica ya usada
 * para `OPENAI_CLIENT`:
 *
 *   `Test.createTestingModule({ imports: [AppModule] })
 *      .overrideProvider(BUSINESS_PROFILE_SERVICE)
 *      .useValue(mock)`
 *
 * `BusinessContextModule` y `TerritoryModule` ya son `@Global`, por lo que
 * basta con declararlos en `imports` para que Nest valide la dependencia
 * en tiempo de bootstrap.
 */
@Module({
  imports: [BusinessContextModule],
  controllers: [BusinessProfileController],
  providers: [
    BusinessProfileService,
    {
      provide: BUSINESS_PROFILE_SERVICE,
      useExisting: BusinessProfileService,
    },
  ],
  exports: [BusinessProfileService, BUSINESS_PROFILE_SERVICE],
})
export class BusinessProfileModule {}
