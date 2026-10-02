import { Module } from '@nestjs/common';
import { AnalyzeModule } from '../analyze/analyze.module';
import { BusinessProfileModule } from '../business-profile/business-profile.module';
import { BusinessContextModule } from '../../shared/business-context/business-context.module';
import { CampaignBriefController } from './campaign-brief.controller';
import { CampaignBriefService } from './campaign-brief.service';
import { CampaignBriefSuggestRulesService } from './campaign-brief-suggest-rules.service';

/**
 * Módulo que expone el `CampaignBrief` persistente del negocio. Es el
 * segundo paso del plan publicitario estratégico (la ficha que define qué
 * se quiere conseguir en una campaña concreta antes de tocar Meta).
 *
 * El resto de módulos (especialmente el siguiente paso de "recomendaciones
 * de copy") consumirá `CampaignBriefService` en modo lectura. Por ahora
 * sólo se expone aquí el `@Controller`.
 *
 * `AnalyzeModule` y `BusinessProfileModule` se importan aquí para que
 * `CampaignBriefSuggestRulesService` pueda inyectar `OPENAI_CLIENT` y
 * `BUSINESS_PROFILE_SERVICE` (mismo patrón que usa
 * `CreativeRecommendationsModule`).
 *
 * `BusinessContextModule` es `@Global`, pero lo declaramos en `imports`
 * para que Nest valide la dependencia en tiempo de bootstrap.
 */
@Module({
  imports: [BusinessContextModule, AnalyzeModule, BusinessProfileModule],
  controllers: [CampaignBriefController],
  providers: [CampaignBriefService, CampaignBriefSuggestRulesService],
  exports: [CampaignBriefService],
})
export class CampaignBriefModule {}
