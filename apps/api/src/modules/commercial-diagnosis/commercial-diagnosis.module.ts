import { Module } from '@nestjs/common';
import { AnalyzeModule } from '../analyze/analyze.module';
import { BusinessProfileModule } from '../business-profile/business-profile.module';
import { CampaignBriefModule } from '../campaign-brief/campaign-brief.module';
import { BusinessContextModule } from '../../shared/business-context/business-context.module';
import { CommercialDiagnosisController } from './commercial-diagnosis.controller';
import { CommercialDiagnosisService } from './commercial-diagnosis.service';
import { DiagnosisEvidenceService } from './diagnosis-evidence.service';
import { BudgetRecommendationService } from './budget-recommendation.service';

/**
 * Módulo que expone el flujo de "diagnóstico comercial" del negocio:
 *
 *  - Toma la situación actual del negocio como texto libre.
 *  - Dialoga con la IA hasta un máximo de 3 preguntas aclaratorias.
 *  - Cuando la IA tiene suficiente información, propone una meta medible.
 *  - Al aceptar, genera un `CampaignBrief` aprobado y lo vincula.
 *
 * Sigue el mismo patrón que `CampaignBriefModule`:
 *
 *  - `AnalyzeModule` expone el `OPENAI_CLIENT` (compartido).
 *  - `BusinessProfileModule` expone `BUSINESS_PROFILE_SERVICE`.
 *  - `CampaignBriefModule` expone `CampaignBriefService` (necesario para
 *    materializar la diagnosis aceptada).
 *
 * `BusinessContextModule` es `@Global`; lo declaramos aquí para que Nest
 * valide la dependencia en tiempo de bootstrap.
 */
@Module({
  imports: [
    BusinessContextModule,
    AnalyzeModule,
    BusinessProfileModule,
    CampaignBriefModule,
  ],
  controllers: [CommercialDiagnosisController],
  providers: [CommercialDiagnosisService, DiagnosisEvidenceService, BudgetRecommendationService],
})
export class CommercialDiagnosisModule {}