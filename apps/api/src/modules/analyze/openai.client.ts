import { Logger, ServiceUnavailableException } from '@nestjs/common';
import OpenAI from 'openai';
import type { ChatCompletion, ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions';
import type { PerformancePromptPayload } from './analyze.types';

export interface OpenAIClientConfig {
  apiKey?: string;
  project?: string;
  model?: string;
}

export interface OpenAISummaryUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model: string;
}

export interface OpenAISummaryResult {
  parsed: Record<string, unknown>;
  raw: ChatCompletion;
  usage: OpenAISummaryUsage;
}

export interface OpenAISummaryPrompt {
  systemPrompt: string;
  userPrompt: string;
}

export interface OpenAISummarizer {
  isConfigured(): boolean;
  getModel(): string;
  summarize(input: PerformancePromptPayload, prompts: OpenAISummaryPrompt): Promise<OpenAISummaryResult>;
}

const DEFAULT_MODEL = 'gpt-4o-mini';

export class OpenAIClient implements OpenAISummarizer {
  private readonly logger = new Logger(OpenAIClient.name);
  private readonly client: OpenAI | null;
  private readonly model: string;
  private readonly hasApiKey: boolean;

  constructor(config: OpenAIClientConfig = {}) {
    const apiKey = (config.apiKey ?? process.env.OPENAI_API_KEY ?? '').trim();
    const project = config.project ?? process.env.OPENAI_PROJECT_ID ?? undefined;
    const model = config.model ?? process.env.OPENAI_MODEL ?? DEFAULT_MODEL;
    this.hasApiKey = apiKey.length > 0;
    this.model = model;
    this.client = this.hasApiKey
      ? new OpenAI({ apiKey, project: project ?? undefined })
      : null;
  }

  isConfigured(): boolean {
    return this.hasApiKey;
  }

  getModel(): string {
    return this.model;
  }

  async summarize(
    input: PerformancePromptPayload,
    prompts: OpenAISummaryPrompt,
  ): Promise<OpenAISummaryResult> {
    if (!this.client) {
      throw new ServiceUnavailableException('No se pudo consultar OpenAI: cliente no inicializado');
    }
    const params: ChatCompletionCreateParamsNonStreaming = {
      model: this.model,
      response_format: { type: 'json_object' },
      temperature: 0.2,
      messages: [
        { role: 'system', content: prompts.systemPrompt },
        { role: 'user', content: prompts.userPrompt },
      ],
    };
    // `input` se mantiene en la firma para que la firma del contrato sea
    // estable y para permitir trazabilidad por payload sin alterar la lógica.
    void input;
    try {
      const response = await this.client.chat.completions.create(params);
      const choice = response.choices[0];
      const rawContent = choice?.message?.content;
      if (typeof rawContent !== 'string' || rawContent.trim().length === 0) {
        throw new ServiceUnavailableException(
          'No se pudo consultar OpenAI: la respuesta llegó vacía',
        );
      }
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(rawContent) as Record<string, unknown>;
      } catch (error) {
        this.logger.error(`OpenAI devolvió JSON inválido: ${(error as Error).message}`);
        throw new ServiceUnavailableException(
          'No se pudo consultar OpenAI: respuesta no es JSON válido',
        );
      }
      const usage = response.usage;
      return {
        parsed,
        raw: response,
        usage: {
          promptTokens: usage?.prompt_tokens ?? 0,
          completionTokens: usage?.completion_tokens ?? 0,
          totalTokens: usage?.total_tokens ?? 0,
          model: response.model,
        },
      };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error llamando a OpenAI (modelo=${this.model}): ${message}`);
      throw new ServiceUnavailableException(`No se pudo consultar OpenAI: ${message}`);
    }
  }
}

export class OpenAIClientMock implements OpenAISummarizer {
  public lastInput: PerformancePromptPayload | null = null;
  public lastPrompts: OpenAISummaryPrompt | null = null;
  public response: OpenAISummaryResult | null = null;
  public error: Error | null = null;
  public configured = true;
  public model = 'gpt-4o-mini';

  isConfigured(): boolean {
    return this.configured;
  }

  getModel(): string {
    return this.model;
  }

  async summarize(
    input: PerformancePromptPayload,
    prompts: OpenAISummaryPrompt,
  ): Promise<OpenAISummaryResult> {
    this.lastInput = input;
    this.lastPrompts = prompts;
    if (this.error) {
      throw this.error;
    }
    if (this.response) {
      return this.response;
    }
    return {
      parsed: {},
      raw: {} as ChatCompletion,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, model: 'gpt-4o-mini' },
    };
  }
}

export const openAIClientMock = new OpenAIClientMock();
