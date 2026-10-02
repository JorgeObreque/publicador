/**
 * Re-exports públicos del módulo `CommercialDiagnosis`.
 *
 * La UI consume estos tipos para tipar las llamadas a la API. El
 * servicio y el módulo NO se re-exportan aquí porque el resto del
 * backend sólo los referencia por ruta relativa dentro del módulo.
 */
export * from './dto/commercial-diagnosis.dto';
export { CommercialDiagnosisService } from './commercial-diagnosis.service';
export { CommercialDiagnosisController } from './commercial-diagnosis.controller';
export { CommercialDiagnosisModule } from './commercial-diagnosis.module';
export {
  buildDiagnosisPayload,
  type DiagnosisAdjustment,
  type DiagnosisContext,
  type DiagnosisPayload,
  type DiagnosticConversationEntry,
  type ParsedDiagnosisDecision,
  type StrategyShape,
} from './commercial-diagnosis.types';
export {
  buildAdjustmentPrompt,
  buildDiagnosisPrompt,
} from './commercial-diagnosis.prompt';