import type { OpenAISummarizer } from './openai.client';

/**
 * Token de inyección que expone el cliente de OpenAI (`OpenAISummarizer`)
 * utilizado por `AnalyzeService`. Permite que las pruebas de integración
 * sustituyan el cliente real por un mock determinista sin necesidad de
 * tocar el código de producción.
 *
 * En producción, `AnalyzeModule` registra este símbolo con un `useFactory`
 * que construye un `OpenAIClient` real leyendo `process.env.OPENAI_API_KEY`.
 * En tests, basta con hacer `Test.createTestingModule({ imports: [AppModule] })
 *   .overrideProvider(OPENAI_CLIENT)
 *   .useValue({ isConfigured, getModel, summarize })`
 * antes de `compile()`.
 */
export const OPENAI_CLIENT = Symbol('OPENAI_CLIENT');

/**
 * Tipo del valor asociado al token `OPENAI_CLIENT`. Coincide con el
 * contrato `OpenAISummarizer` para que tanto la implementación real como
 * los mocks de tests sean intercambiables sin casts adicionales.
 */
export type OpenAIClientToken = OpenAISummarizer;
