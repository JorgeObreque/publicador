import type { BusinessProfileService } from './business-profile.service';

/**
 * Token de inyección que expone el servicio de `BusinessProfile`. Permite que
 las pruebas de integración sustituyan la implementación real por un mock
 determinista sin necesidad de tocar el código de producción.
 *
 * En producción, `BusinessProfileModule` registra este símbolo con
 `BusinessProfileService`. En tests basta con hacer
 `Test.createTestingModule({ imports: [AppModule] })
   .overrideProvider(BUSINESS_PROFILE_SERVICE)
   .useValue(mock)`
 antes de `compile()`.
 */
export const BUSINESS_PROFILE_SERVICE = Symbol('BUSINESS_PROFILE_SERVICE');

export type BusinessProfileServiceToken = BusinessProfileService;