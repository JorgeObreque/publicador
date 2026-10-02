import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Prisma, prisma } from '@publicador/database';
import { PerformanceService } from '../performance/performance.service';
import type { CampaignPerformance, DailyPerformance, PerformanceComparison, PerformanceTotals } from '../performance/performance.types';
import { BusinessContextResolver } from '../../shared/business-context/business-context.resolver';
import {
  analyzeRunResultSchema,
  performanceAnalysisSchema,
  type AnalyzeRunResult,
  type PerformanceAnalysis,
  type PerformancePromptPayload,
} from './analyze.types';
import { buildPerformancePrompt } from './analyze.prompt';
import { OPENAI_CLIENT, type OpenAIClientToken } from './analyze.tokens';

const ALLOWED_PERIOD_DAYS = [7, 30, 90] as const;
type AllowedPeriodDays = (typeof ALLOWED_PERIOD_DAYS)[number];

interface Range {
  from: string;
  to: string;
  days: number;
}

interface CampaignMetaRow {
  metaCampaignId: string;
  name: string;
  status: string | null;
  effectiveStatus: string | null;
  dailyBudget: string | null;
  lifetimeBudget: string | null;
}

const toNumber = (value: Prisma.Decimal | number | string | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return Number(value.toString());
};

const civilDayKey = (value: Date): string => value.toISOString().slice(0, 10);

const computeRange = (days: number, now: Date = new Date()): Range => {
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const from = new Date(to.getTime());
  from.setUTCDate(from.getUTCDate() - (days - 1));
  return {
    from: civilDayKey(from),
    to: civilDayKey(to),
    days,
  };
};

const hasPreviousPeriodData = (comparison: PerformanceComparison): boolean => {
  return (
    comparison.spendDelta !== null ||
    comparison.resultsDelta !== null ||
    comparison.cplDelta !== null ||
    comparison.ctrDelta !== null ||
    comparison.cpcDelta !== null
  );
};

@Injectable()
export class AnalyzeService {
  private readonly logger = new Logger(AnalyseService.name);

  constructor(
    private readonly businessContext: BusinessContextResolver,
    private readonly performance: PerformanceService,
    @Inject(OPENAI_CLIENT) private readonly client: OpenAIClientToken,
  ) {}

  private get businessId(): string {
    return this.businessContext.resolve().businessId;
  }

  isConfigured(): boolean {
    return this.client.isConfigured();
  }

  async analyzeCampaign(
    metaCampaignId: string,
    periodDays: number = 30,
  ): Promise<AnalyzeRunResult> {
    if (!ALLOWED_PERIOD_DAYS.includes(periodDays as AllowedPeriodDays)) {
      periodDays = 30;
    }
    const range = computeRange(periodDays);

    const performance = await this.performance.campaignPerformance(metaCampaignId, range.from, range.to);
    const campaign = await this.fetchCampaignRow(metaCampaignId);
    const totals = performance.totals;
    const hasActivity = totals.impressions > 0 || totals.results > 0 || totals.clicks > 0;

    if (!hasActivity) {
      const result: AnalyzeRunResult = {
        campaignId: campaign?.metaCampaignId ?? metaCampaignId,
        periodFrom: range.from,
        periodTo: range.to,
        analysis: {
          summary:
            'La campaña no registra impresiones, clics ni resultados en el período seleccionado; no es posible emitir un diagnóstico publicitario.',
          diagnosis:
            'No hay datos suficientes para evaluar el rendimiento. La campaña podría estar recién creada, pausada, fuera del presupuesto o sin entrega.',
          action: 'NEEDS_MORE_DATA',
          recommendedVariable: 'NONE',
          confidence: 'LOW',
          evidence: [
            'Impresiones acumuladas en el período: 0.',
            'Clics acumulados en el período: 0.',
            'Resultados acumulados en el período: 0.',
          ],
          caveats: [
            'No se contactó a OpenAI porque la campaña no entrega datos.',
          ],
          recommendedNextStep:
            'Confirmar el estado de la campaña en Meta Ads Manager y revisar la entrega antes de volver a solicitar un análisis.',
        },
      };
      return result;
    }

    if (!this.client.isConfigured()) {
      throw new ServiceUnavailableException('No se pudo consultar OpenAI: cliente no configurado');
    }

    const payload = this.buildPayload(performance, campaign, range);
    const prompts = buildPerformancePrompt(payload);

    const summary = await this.client.summarize(payload, prompts);

    const normalized = this.normalizeModelOutput(summary.parsed);
    const analysisResult = performanceAnalysisSchema.safeParse(normalized);
    if (!analysisResult.success) {
      this.logger.error(
        `La respuesta de OpenAI no cumple el esquema esperado: ${analysisResult.error.message}`,
      );
      throw new ServiceUnavailableException(
        'No se pudo consultar OpenAI: respuesta no cumple el formato esperado',
      );
    }
    const analysis: PerformanceAnalysis = analysisResult.data;

    const runResult: AnalyzeRunResult = {
      campaignId: campaign?.metaCampaignId ?? metaCampaignId,
      periodFrom: range.from,
      periodTo: range.to,
      analysis,
    };

    const validated = analyzeRunResultSchema.safeParse(runResult);
    if (!validated.success) {
      throw new ServiceUnavailableException(
        'No se pudo construir el resultado del análisis con el formato esperado',
      );
    }

    // TODO: persistir Insight + OptimizationRecommendation + DecisionLog tras aprobación.
    return validated.data;
  }

  private normalizeModelOutput(input: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = { ...input };
    const coerceStringArray = (value: unknown): string[] => {
      if (Array.isArray(value)) return value.map((entry) => String(entry));
      if (typeof value === 'string') {
        if (value.trim().length === 0) return [];
        const newline = String.fromCharCode(10);
        const splitted = value.split(newline).map((piece) => piece.trim()).filter((piece) => piece.length > 0);
        return splitted.length > 0 ? splitted : [value];
      }
      return [String(value)];
    };
    if (!Array.isArray(result['evidence'])) {
      result['evidence'] = coerceStringArray(result['evidence']);
    }
    if (!Array.isArray(result['caveats'])) {
      result['caveats'] = coerceStringArray(result['caveats']);
    }
    return result;
  }
  private async fetchCampaignRow(metaCampaignId: string): Promise<CampaignMetaRow | null> {
    return prisma.metaRemoteCampaign.findFirst({
      where: { businessId: this.businessId, metaCampaignId },
      select: {
        metaCampaignId: true,
        name: true,
        status: true,
        effectiveStatus: true,
        dailyBudget: true,
        lifetimeBudget: true,
      },
    });
  }

  private buildPayload(
    performance: CampaignPerformance,
    campaign: CampaignMetaRow | null,
    range: Range,
  ): PerformancePromptPayload {
    const totals: PerformanceTotals = performance.totals;
    const comparison: PerformanceComparison = performance.comparison;
    const dailyLimited = this.limitDailySeries(performance.daily);
    const dailyBudgetValue = campaign?.dailyBudget ? toNumber(campaign.dailyBudget) : null;
    const lifetimeBudgetValue = campaign?.lifetimeBudget ? toNumber(campaign.lifetimeBudget) : null;

    return {
      campaign: {
        metaCampaignId: campaign?.metaCampaignId ?? performance.range.from,
        name: campaign?.name ?? 'Campaña Meta',
        status: campaign?.effectiveStatus ?? campaign?.status ?? null,
        dailyBudget: dailyBudgetValue,
        lifetimeBudget: lifetimeBudgetValue,
      },
      period: {
        from: range.from,
        to: range.to,
        days: range.days,
      },
      currency: totals.currency,
      totals: {
        spend: totals.spend,
        impressions: totals.impressions,
        clicks: totals.clicks,
        results: totals.results,
        ctr: totals.ctr,
        cpc: totals.cpc,
        cpl: totals.cpl,
        conversionRate: totals.conversionRate,
      },
      comparison: {
        spendDelta: comparison.spendDelta,
        resultsDelta: comparison.resultsDelta,
        cplDelta: comparison.cplDelta,
        ctrDelta: comparison.ctrDelta,
        cpcDelta: comparison.cpcDelta,
      },
      daily: dailyLimited,
      hasPreviousPeriod: hasPreviousPeriodData(comparison),
      hasDailyBreakdown: dailyLimited.length > 0,
    };
  }

  private limitDailySeries(daily: DailyPerformance[]): DailyPerformance[] {
    if (!Array.isArray(daily) || daily.length === 0) return [];
    if (daily.length <= 30) return daily;
    const head = daily.slice(0, 15);
    const tail = daily.slice(daily.length - 15);
    return [...head, ...tail];
  }
}

/**
 * Alias británico para conservar el nombre del logger pedido por el
 * enunciado sin alterar el identificador público de la clase.
 */
export const AnalyseService = AnalyzeService;
