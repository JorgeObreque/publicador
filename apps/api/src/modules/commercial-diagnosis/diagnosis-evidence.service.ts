import { Injectable, Logger } from '@nestjs/common';
import { ConversionStatus, Prisma } from '@prisma/client';
import { prisma } from '@publicador/database';

/**
 * Servicio determinista (sin IA) que agrega la evidencia histórica de
 * campañas y conversiones para alimentar al "diagnóstico comercial".
 *
 * A diferencia del `CommercialDiagnosisService` (que conversa con el
 * modelo y orquesta la diagnosis), este módulo sólo lee y agrega datos:
 *
 *  - Suma métricas (`AdMetricDaily`) y conversiones (`Conversion`) de las
 *    campañas del MISMO `serviceId` (vía la relación `campaign.serviceId`).
 *  - Filtra conversiones canceladas/no_show (status ∉
 *    {CANCELLED, NO_SHOW}) — sólo cuentan las efectivamente válidas.
 *  - Calcula promedios globales (CPA, CPC, CTR) y un desglose por día
 *    de la semana (UTC) que el recomendador consume para priorizar
 *    weekdays con mejor CPA histórico.
 *
 * Diseño:
 *
 *  - Sin estado: cada llamada devuelve un snapshot. El servicio es
 *    inyectable pero standalone — no se monta todavía en el módulo, se
 *    conectará cuando el recomendador principal lo necesite.
 *  - Determinista: el resultado depende sólo de los datos en BD y del
 *    input. No hay randomness, IA ni dependencias externas.
 *  - Zonas horarias: por simplicidad operativa se compara por día
 *    calendario UTC (que es como `AdMetricDaily.date` se almacena). Los
 *    días de la semana también son UTC (`date.getUTCDay()`). Esto es
 *    consistente con `performance.service.ts` y el resto del módulo.
 *
 * Contrato:
 *  - Entrada: `{ businessId, serviceId, lookbackDays }`. `serviceId`
 *    `null` significa "todos los servicios del negocio".
 *  - Salida: ver `DiagnosisEvidence`. Si no hay datos, los totales van
 *    en 0, `bestWeekdays = []` y `hasEnoughEvidence = false`.
 */
export interface DiagnosisEvidenceInput {
  businessId: string;
  serviceId: string | null;
  lookbackDays?: number;
}

export interface WeekdayEvidence {
  weekday: number;
  datesObserved: number;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  cpa: number | null;
  conversionRate: number;
}

export interface DiagnosisEvidence {
  windowStart: string;
  windowEnd: string;
  daysObserved: number;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  averageCpa: number;
  averageCpc: number;
  averageCtr: number;
  cpaByWeekday: WeekdayEvidence[];
  bestWeekdays: number[];
  hasEnoughEvidence: boolean;
}

const DEFAULT_LOOKBACK_DAYS = 56;
const MAX_LOOKBACK_DAYS = 365;
const MIN_LOOKBACK_DAYS = 1;

const MIN_DATES_OBSERVED_FOR_BEST_WEEKDAY = 4;
const MIN_CONVERSIONS_FOR_BEST_WEEKDAY = 5;

const EVIDENCE_MIN_DAYS = 14;
const EVIDENCE_MIN_CONVERSIONS = 5;
const EVIDENCE_MIN_IMPRESSIONS = 2000;

/**
 * Status de `Conversion` que cuentan como evidencia válida. CANCELLED
 * y NO_SHOW no cuentan (no representan valor para el negocio).
 */
const COUNTED_CONVERSION_STATUSES: ConversionStatus[] = [
  ConversionStatus.PENDING,
  ConversionStatus.DEPOSIT_CONFIRMED,
  ConversionStatus.ATTENDED,
];

/**
 * Normaliza una fecha a su día civil UTC (medianoche UTC). Acepta
 * strings ISO (`YYYY-MM-DD...`) y objetos Date. Esto nos permite operar
 * con `Date` directamente sin preocuparnos por la hora del día, ya que
 * `AdMetricDaily.date` viene como `@db.Date` (medianoche UTC por
 * convención de Prisma).
 */
const civilDay = (value: Date | string): Date => {
  if (typeof value === 'string') {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new Error(`Fecha inválida: ${value}`);
    }
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
};

const dateKey = (value: Date): string => value.toISOString().slice(0, 10);

const addDays = (value: Date, days: number): Date => {
  const result = new Date(value.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};

const toNumber = (value: Prisma.Decimal | number | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  return Number(value.toString());
};

const safeRatio = (numerator: number, denominator: number): number =>
  denominator > 0 ? numerator / denominator : 0;

const clampLookback = (raw: number | undefined): number => {
  if (raw === undefined || raw === null || !Number.isFinite(raw)) {
    return DEFAULT_LOOKBACK_DAYS;
  }
  const integer = Math.trunc(raw);
  if (integer < MIN_LOOKBACK_DAYS) return MIN_LOOKBACK_DAYS;
  if (integer > MAX_LOOKBACK_DAYS) return MAX_LOOKBACK_DAYS;
  return integer;
};

const emptyWeekday = (weekday: number): WeekdayEvidence => ({
  weekday,
  datesObserved: 0,
  impressions: 0,
  clicks: 0,
  spend: 0,
  conversions: 0,
  cpa: null,
  conversionRate: 0,
});

const allWeekdays = (): WeekdayEvidence[] =>
  Array.from({ length: 7 }, (_, weekday) => emptyWeekday(weekday));

@Injectable()
export class DiagnosisEvidenceService {
  private readonly logger = new Logger(DiagnosisEvidenceService.name);

  /**
   * Carga y agrega la evidencia histórica para el par
   * `(businessId, serviceId)` en la ventana móvil de `lookbackDays` días
   * que termina en el día civil UTC actual.
   */
  async load(input: DiagnosisEvidenceInput): Promise<DiagnosisEvidence> {
    const lookback = clampLookback(input.lookbackDays);
    const today = civilDay(new Date());
    const windowEnd = today;
    const windowStart = addDays(windowEnd, -(lookback - 1));

    const businessId = input.businessId;
    if (!businessId || businessId.trim().length === 0) {
      // Defensive: si llega vacío (no debería pasar porque el caller ya
      // lo validó), devolvemos evidencia vacía sin tocar la BD.
      return this.emptyEvidence(windowStart, windowEnd);
    }
    const serviceId = input.serviceId;

    // Filtro compartido por serviceId. Cuando NO hay servicio seleccionado
    // devolvemos TODO el negocio; cuando sí hay, restringimos por la
    // relación `campaign.serviceId` para que campañas de otros servicios
    // (o sin servicio) no contaminen la muestra.
    const serviceFilter: Prisma.AdMetricDailyWhereInput | Prisma.ConversionWhereInput =
      serviceId
        ? { campaign: { is: { serviceId } } }
        : {};

    const metrics = await prisma.adMetricDaily.findMany({
      where: {
        businessId,
        date: { gte: windowStart, lte: windowEnd },
        ...(serviceFilter as Prisma.AdMetricDailyWhereInput),
      },
      select: {
        date: true,
        impressions: true,
        clicks: true,
        spend: true,
      },
    });

    // `Conversion.occurredAt` es un `DateTime` (con hora), por lo que
    // usamos `[windowStart 00:00Z, windowEnd + 1 día 00:00Z)` para no
    // perder conversiones del último día por efecto de la hora.
    const conversionsWhere: Prisma.ConversionWhereInput = {
      businessId,
      status: { in: COUNTED_CONVERSION_STATUSES },
      occurredAt: {
        gte: windowStart,
        lt: addDays(windowEnd, 1),
      },
      ...(serviceFilter as Prisma.ConversionWhereInput),
    };
    const conversions = await prisma.conversion.findMany({
      where: conversionsWhere,
      select: { occurredAt: true },
    });

    return this.aggregate({
      metrics,
      conversions,
      windowStart,
      windowEnd,
      businessId,
      serviceId,
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers internos (puros — cubiertos por los tests sin tocar Prisma)
  // ---------------------------------------------------------------------------

  private aggregate(args: {
    metrics: Array<{
      date: Date;
      impressions: number;
      clicks: number;
      spend: Prisma.Decimal | number | null;
    }>;
    conversions: Array<{ occurredAt: Date }>;
    windowStart: Date;
    windowEnd: Date;
    businessId: string;
    serviceId: string | null;
  }): DiagnosisEvidence {
    const { metrics, conversions, windowStart, windowEnd, businessId, serviceId } = args;

    const weekdayStats = allWeekdays();
    // Mantenemos un Set por bucket para no contar dos veces la misma
    // fecha dentro del mismo weekday (varias campañas pueden aportar
    // métricas al mismo día). Como los buckets son objetos nuevos en
    // cada invocación, basta con un WeakMap local al método.
    const dateCounters = new WeakMap<WeekdayEvidence, Set<string>>();
    const totalDatesObserved = new Set<string>();

    let totalImpressions = 0;
    let totalClicks = 0;
    let totalSpend = 0;

    for (const metric of metrics) {
      const day = civilDay(metric.date);
      const weekday = day.getUTCDay();
      const bucket = weekdayStats[weekday];
      if (!bucket) continue;
      const key = dateKey(day);
      totalDatesObserved.add(key);
      // `datesObserved` por weekday debe contar fechas distintas que
      // aportaron métricas ESE día de la semana.
      const distinctKey = `${weekday}:${key}`;
      let set = dateCounters.get(bucket);
      if (!set) {
        set = new Set<string>();
        dateCounters.set(bucket, set);
      }
      if (!set.has(distinctKey)) {
        set.add(distinctKey);
        bucket.datesObserved += 1;
      }
      const impressions = metric.impressions;
      const clicks = metric.clicks;
      const spend = toNumber(metric.spend);
      bucket.impressions += impressions;
      bucket.clicks += clicks;
      bucket.spend += spend;
      totalImpressions += impressions;
      totalClicks += clicks;
      totalSpend += spend;
    }

    // Para conversiones: el día civil UTC se determina por
    // `occurredAt`. Esto es consistente con el manejo de métricas.
    let totalConversions = 0;
    for (const conversion of conversions) {
      const day = civilDay(conversion.occurredAt);
      const weekday = day.getUTCDay();
      const bucket = weekdayStats[weekday];
      if (!bucket) continue;
      bucket.conversions += 1;
      totalConversions += 1;
    }

    // Calcula CPA y conversionRate por weekday. CPA es `null` cuando no
    // hay conversiones (no podemos calcular un promedio real).
    for (const bucket of weekdayStats) {
      bucket.cpa = bucket.conversions > 0 ? bucket.spend / bucket.conversions : null;
      bucket.conversionRate = safeRatio(bucket.conversions, bucket.clicks);
    }

    const daysObserved = totalDatesObserved.size;
    const averageCpa = totalConversions > 0 ? totalSpend / totalConversions : 0;
    const averageCpc = safeRatio(totalSpend, totalClicks);
    const averageCtr = safeRatio(totalClicks, totalImpressions);

    // Filtra weekdays con muestra suficiente. El spec define el orden:
    // CPA ascendente, con `conversionRate` como desempate (mayor
    // conversionRate gana cuando el CPA empata — más eficiente primero).
    const candidates = weekdayStats.filter(
      (bucket) =>
        bucket.datesObserved >= MIN_DATES_OBSERVED_FOR_BEST_WEEKDAY &&
        bucket.conversions >= MIN_CONVERSIONS_FOR_BEST_WEEKDAY,
    );
    candidates.sort((a, b) => {
      const cpaA = a.cpa ?? Number.POSITIVE_INFINITY;
      const cpaB = b.cpa ?? Number.POSITIVE_INFINITY;
      if (cpaA !== cpaB) return cpaA - cpaB;
      return b.conversionRate - a.conversionRate;
    });
    const bestWeekdays = candidates.map((bucket) => bucket.weekday);

    const hasEnoughEvidence =
      daysObserved >= EVIDENCE_MIN_DAYS &&
      totalConversions >= EVIDENCE_MIN_CONVERSIONS &&
      totalImpressions >= EVIDENCE_MIN_IMPRESSIONS;

    if (daysObserved === 0 && totalConversions === 0) {
      this.logger.debug(
        `Sin evidencia para businessId=${this.redact(businessId)} serviceId=${serviceId ?? '∅'} window=[${dateKey(windowStart)},${dateKey(windowEnd)}]`,
      );
    }

    return {
      windowStart: dateKey(windowStart),
      windowEnd: dateKey(windowEnd),
      daysObserved,
      impressions: totalImpressions,
      clicks: totalClicks,
      spend: totalSpend,
      conversions: totalConversions,
      averageCpa,
      averageCpc,
      averageCtr,
      cpaByWeekday: weekdayStats,
      bestWeekdays,
      hasEnoughEvidence,
    };
  }

  private emptyEvidence(windowStart: Date, windowEnd: Date): DiagnosisEvidence {
    return {
      windowStart: dateKey(windowStart),
      windowEnd: dateKey(windowEnd),
      daysObserved: 0,
      impressions: 0,
      clicks: 0,
      spend: 0,
      conversions: 0,
      averageCpa: 0,
      averageCpc: 0,
      averageCtr: 0,
      cpaByWeekday: allWeekdays(),
      bestWeekdays: [],
      hasEnoughEvidence: false,
    };
  }

  /**
   * Trunca un identificador para los mensajes de log. Evita exponer
   * `businessId` completos en logs (un identificador tipo CUID no es
   * sensible pero la convención del repo es redactar).
   */
  private redact(value: string): string {
    if (value.length <= 6) return '***';
    return `${value.slice(0, 3)}…${value.slice(-3)}`;
  }
}