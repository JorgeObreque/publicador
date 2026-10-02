import { ConversionStatus, Prisma } from '@prisma/client';
import { prisma } from '@publicador/database';
import {
  DiagnosisEvidenceService,
  type WeekdayEvidence,
} from './diagnosis-evidence.service';

interface MetricRow {
  id?: string;
  date: Date;
  impressions: number;
  clicks: number;
  spend: Prisma.Decimal | number | null;
}

interface ConversionRow {
  id?: string;
  occurredAt: Date;
  status?: ConversionStatus;
}

/**
 * Construye un objeto `Date` en UTC midnight a partir de un string ISO
 * (YYYY-MM-DD). Útil para sembrar datos deterministas en los tests sin
 * arrastrar offsets de zona horaria local.
 */
const utcDate = (isoDay: string): Date => new Date(`${isoDay}T00:00:00.000Z`);

/**
 * Convierte un valor de gasto (`number`, `string` o `Prisma.Decimal`) a
 * `Prisma.Decimal` para que el mock entregue la misma forma que Prisma.
 */
const toDecimal = (value: number | string): Prisma.Decimal => new Prisma.Decimal(value);

interface PrismaMockOptions {
  metrics?: MetricRow[];
  conversions?: ConversionRow[];
}

interface PrismaMock {
  adMetricDaily: { findMany: jest.Mock };
  conversion: { findMany: jest.Mock };
}

function attachPrismaMock(options: PrismaMockOptions): PrismaMock {
  const metricsRows = options.metrics ?? [];
  const conversionsRows = options.conversions ?? [];

  // Helper: extrae el `serviceId` pedido por el `where` aunque venga
  // en cualquiera de las formas que Prisma acepta para el filtro
  // `campaign.serviceId` (top-level o dentro de `is`/`isNot`).
  const extractWantedServiceId = (where: unknown): string | undefined => {
    if (!where || typeof where !== 'object') return undefined;
    const campaign = (where as { campaign?: unknown }).campaign;
    if (!campaign || typeof campaign !== 'object') return undefined;
    const obj = campaign as {
      serviceId?: string;
      is?: { serviceId?: string };
      isNot?: { serviceId?: string };
    };
    if (typeof obj.serviceId === 'string') return obj.serviceId;
    if (obj.is && typeof obj.is.serviceId === 'string') return obj.is.serviceId;
    return undefined;
  };

  const adMetricFindMany = jest.fn(
    async ({ where }: { where: Prisma.AdMetricDailyWhereInput }) => {
      // Filtramos manualmente para emular el JOIN con `campaign.serviceId`
      // que Prisma haría en producción: si el where incluye
      // `campaign.serviceId`, descartamos las filas con `_serviceId`
      // distinto (sembrado en el row como campo auxiliar, sólo en tests).
      const wantedServiceId = extractWantedServiceId(where);
      return metricsRows.filter((row) => {
        const rowServiceId = (row as { _serviceId?: string })._serviceId;
        if (wantedServiceId && rowServiceId && rowServiceId !== wantedServiceId) {
          return false;
        }
        return true;
      });
    },
  );
  const conversionFindMany = jest.fn(
    async ({ where }: { where: Prisma.ConversionWhereInput }) => {
      const statusFilter = where.status;
      const wantedStatuses = new Set<ConversionStatus>();
      if (statusFilter && 'in' in statusFilter && Array.isArray(statusFilter.in)) {
        for (const entry of statusFilter.in) {
          wantedStatuses.add(entry);
        }
      }
      const wantedServiceId = extractWantedServiceId(where);
      return conversionsRows.filter((row) => {
        if (wantedStatuses.size > 0) {
          const status = row.status ?? ConversionStatus.PENDING;
          if (!wantedStatuses.has(status)) return false;
        }
        const rowServiceId = (row as { _serviceId?: string })._serviceId;
        if (wantedServiceId && rowServiceId && rowServiceId !== wantedServiceId) {
          return false;
        }
        return true;
      });
    },
  );

  (prisma as unknown as { adMetricDaily: PrismaMock['adMetricDaily'] }).adMetricDaily = {
    findMany: adMetricFindMany,
  };
  (prisma as unknown as { conversion: PrismaMock['conversion'] }).conversion = {
    findMany: conversionFindMany,
  };

  return { adMetricDaily: { findMany: adMetricFindMany }, conversion: { findMany: conversionFindMany } };
}

describe('DiagnosisEvidenceService', () => {
  const originalBusinessId = process.env.BUSINESS_ID;

  beforeEach(() => {
    process.env.BUSINESS_ID = 'test-business';
  });

  afterEach(() => {
    if (originalBusinessId === undefined) {
      delete process.env.BUSINESS_ID;
    } else {
      process.env.BUSINESS_ID = originalBusinessId;
    }
  });

  // ---------------------------------------------------------------------------
  // Caso 1: sin campañas en el periodo → totales vacíos
  // ---------------------------------------------------------------------------
  describe('sin campañas en el periodo', () => {
    it('devuelve evidencia vacía con ceros y bestWeekdays=[]', async () => {
      const mocks = attachPrismaMock({ metrics: [], conversions: [] });
      const service = new DiagnosisEvidenceService();

      const result = await service.load({
        businessId: 'test-business',
        serviceId: 'svc-balayage',
        lookbackDays: 56,
      });

      // 56 días hacia atrás desde hoy → windowStart existe.
      expect(result.windowStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result.windowEnd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(result.windowStart).getTime()).toBeLessThanOrEqual(
        new Date(result.windowEnd).getTime(),
      );
      expect(result.daysObserved).toBe(0);
      expect(result.impressions).toBe(0);
      expect(result.clicks).toBe(0);
      expect(result.spend).toBe(0);
      expect(result.conversions).toBe(0);
      expect(result.averageCpa).toBe(0);
      expect(result.averageCpc).toBe(0);
      expect(result.averageCtr).toBe(0);
      expect(result.cpaByWeekday).toHaveLength(7);
      result.cpaByWeekday.forEach((bucket: WeekdayEvidence) => {
        expect(bucket.datesObserved).toBe(0);
        expect(bucket.impressions).toBe(0);
        expect(bucket.clicks).toBe(0);
        expect(bucket.spend).toBe(0);
        expect(bucket.conversions).toBe(0);
        expect(bucket.cpa).toBeNull();
        expect(bucket.conversionRate).toBe(0);
      });
      expect(result.bestWeekdays).toEqual([]);
      expect(result.hasEnoughEvidence).toBe(false);
      // Ambas colecciones se consultan exactamente una vez.
      expect(mocks.adMetricDaily.findMany).toHaveBeenCalledTimes(1);
      expect(mocks.conversion.findMany).toHaveBeenCalledTimes(1);
    });

    it('cap de lookbackDays a 365', async () => {
      attachPrismaMock({ metrics: [], conversions: [] });
      const service = new DiagnosisEvidenceService();

      const result = await service.load({
        businessId: 'test-business',
        serviceId: null,
        lookbackDays: 10_000,
      });

      const span =
        (new Date(result.windowEnd).getTime() - new Date(result.windowStart).getTime()) /
          86_400_000 +
        1;
      expect(span).toBe(365);
    });

    it('aplica el default de 56 días cuando no se entrega lookbackDays', async () => {
      attachPrismaMock({ metrics: [], conversions: [] });
      const service = new DiagnosisEvidenceService();

      const result = await service.load({
        businessId: 'test-business',
        serviceId: null,
      });

      const span =
        (new Date(result.windowEnd).getTime() - new Date(result.windowStart).getTime()) /
          86_400_000 +
        1;
      expect(span).toBe(56);
    });
  });

  // ---------------------------------------------------------------------------
  // Caso 2: con campañas pero sin conversiones
  // ---------------------------------------------------------------------------
  describe('con campañas pero sin conversiones', () => {
    it('suma métricas, marca conversiones en 0 y hasEnoughEvidence=false', async () => {
      const metrics: MetricRow[] = [
        {
          date: utcDate('2026-01-05'), // Monday
          impressions: 1_000,
          clicks: 50,
          spend: toDecimal('5_000'),
        },
        {
          date: utcDate('2026-01-06'), // Tuesday
          impressions: 1_500,
          clicks: 80,
          spend: toDecimal('8_000'),
        },
        {
          date: utcDate('2026-01-07'), // Wednesday
          impressions: 2_000,
          clicks: 100,
          spend: toDecimal('12_000'),
        },
      ];
      attachPrismaMock({ metrics, conversions: [] });
      const service = new DiagnosisEvidenceService();

      const result = await service.load({
        businessId: 'test-business',
        serviceId: 'svc-balayage',
      });

      expect(result.daysObserved).toBe(3);
      expect(result.impressions).toBe(4_500);
      expect(result.clicks).toBe(230);
      expect(result.spend).toBe(25_000);
      expect(result.conversions).toBe(0);
      expect(result.averageCpa).toBe(0);
      expect(result.averageCpc).toBeCloseTo(25_000 / 230, 6);
      expect(result.averageCtr).toBeCloseTo(230 / 4_500, 6);
      expect(result.bestWeekdays).toEqual([]);
      expect(result.hasEnoughEvidence).toBe(false);

      // Cada weekday tiene su bucket populated (1, 2, 3) con cpa=null.
      const monday = result.cpaByWeekday[1];
      expect(monday?.weekday).toBe(1);
      expect(monday?.datesObserved).toBe(1);
      expect(monday?.impressions).toBe(1_000);
      expect(monday?.clicks).toBe(50);
      expect(monday?.spend).toBe(5_000);
      expect(monday?.conversions).toBe(0);
      expect(monday?.cpa).toBeNull();
      expect(monday?.conversionRate).toBe(0);

      const wednesday = result.cpaByWeekday[3];
      expect(wednesday?.weekday).toBe(3);
      expect(wednesday?.datesObserved).toBe(1);
      expect(wednesday?.impressions).toBe(2_000);
    });
  });

  // ---------------------------------------------------------------------------
  // Caso 3: conversiones con muestra insuficiente por día
  // ---------------------------------------------------------------------------
  describe('con conversiones pero muestra insuficiente por día', () => {
    it('bestWeekdays=[] si ningún weekday cumple 4 fechas observadas y 5 conversiones', async () => {
      // 3 fechas en lunes, 2 en martes. Ninguno llega a 4 fechas
      // observadas. Hay conversiones pero el mínimo por weekday es >=5
      // y >=4 fechas — no hay weekday que califique.
      const metrics: MetricRow[] = [
        { date: utcDate('2026-01-05'), impressions: 1_000, clicks: 50,  spend: toDecimal('5_000') },
        { date: utcDate('2026-01-12'), impressions: 1_000, clicks: 50,  spend: toDecimal('5_000') },
        { date: utcDate('2026-01-19'), impressions: 1_000, clicks: 50,  spend: toDecimal('5_000') },
        { date: utcDate('2026-01-06'), impressions: 1_000, clicks: 50,  spend: toDecimal('5_000') },
        { date: utcDate('2026-01-13'), impressions: 1_000, clicks: 50,  spend: toDecimal('5_000') },
      ];
      // 3 conversiones en lunes y 2 en martes → ambos <5 por weekday.
      const conversions: ConversionRow[] = [
        { occurredAt: utcDate('2026-01-05'), status: ConversionStatus.ATTENDED },
        { occurredAt: utcDate('2026-01-12'), status: ConversionStatus.ATTENDED },
        { occurredAt: utcDate('2026-01-19'), status: ConversionStatus.ATTENDED },
        { occurredAt: utcDate('2026-01-06'), status: ConversionStatus.DEPOSIT_CONFIRMED },
        { occurredAt: utcDate('2026-01-13'), status: ConversionStatus.DEPOSIT_CONFIRMED },
      ];
      attachPrismaMock({ metrics, conversions });
      const service = new DiagnosisEvidenceService();

      const result = await service.load({
        businessId: 'test-business',
        serviceId: 'svc-balayage',
      });

      expect(result.conversions).toBe(5);
      // Lunes: 3 fechas observadas, 3 conversiones.
      expect(result.cpaByWeekday[1]?.datesObserved).toBe(3);
      expect(result.cpaByWeekday[1]?.conversions).toBe(3);
      // Martes: 2 fechas observadas, 2 conversiones.
      expect(result.cpaByWeekday[2]?.datesObserved).toBe(2);
      expect(result.cpaByWeekday[2]?.conversions).toBe(2);
      // Ninguno llega al umbral → bestWeekdays vacío.
      expect(result.bestWeekdays).toEqual([]);
      // Aunque hay actividad, no llega al umbral global (14 días, 5 conv, 2000 imp).
      expect(result.hasEnoughEvidence).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Caso 4: muestra suficiente → mejores weekdays ordenados por CPA
  // ---------------------------------------------------------------------------
  describe('con muestra suficiente', () => {
    it('bestWeekdays contiene los weekdays ordenados por CPA ascendente', async () => {
      // Lunes: bajo CPA. Miércoles: alto CPA. Viernes: CPA intermedio.
      // Cada weekday tiene >=4 fechas observadas y >=5 conversiones.
      const metrics: MetricRow[] = [];
      const conversions: ConversionRow[] = [];

      // Helper: agrega N fechas de un weekday (separadas por 7 días para
      // que caigan siempre en el mismo día de la semana).
      const pushWeek = (
        weekdayIsoDay: string,
        weeks: number,
        perDayImpressions: number,
        perDayClicks: number,
        perDaySpend: number,
        perDayConversions: number,
      ): void => {
        const baseDate = new Date(`${weekdayIsoDay}T00:00:00.000Z`);
        for (let i = 0; i < weeks; i += 1) {
          const date = new Date(baseDate.getTime() + i * 7 * 86_400_000);
          const isoDay = date.toISOString().slice(0, 10);
          metrics.push({
            date: utcDate(isoDay),
            impressions: perDayImpressions,
            clicks: perDayClicks,
            spend: toDecimal(perDaySpend),
          });
          for (let c = 0; c < perDayConversions; c += 1) {
            conversions.push({
              occurredAt: utcDate(isoDay),
              status: ConversionStatus.ATTENDED,
            });
          }
        }
      };

      // Lunes 2026-01-05: 5 semanas, $1000/día, 1 conv/día → CPA = 1000.
      pushWeek('2026-01-05', 5, 1_000, 50, 1_000, 1);
      // Miércoles 2026-01-07: 5 semanas con spend alto ($5000/día) para
      // forzar un CPA alto (5000), 1 conv/día → CPA = 5000.
      pushWeek('2026-01-07', 5, 1_000, 50, 5_000, 1);
      // Viernes 2026-01-09: 5 semanas con spend intermedio ($2500/día) →
      // CPA = 2500.
      pushWeek('2026-01-09', 5, 1_000, 50, 2_500, 1);

      attachPrismaMock({ metrics, conversions });
      const service = new DiagnosisEvidenceService();

      const result = await service.load({
        businessId: 'test-business',
        serviceId: 'svc-balayage',
      });

      // Esperamos 3 weekdays: lunes (1), viernes (5), miércoles (3)
      expect(result.bestWeekdays).toEqual([1, 5, 3]);
      // Cada uno cumple el mínimo.
      expect(result.cpaByWeekday[1]?.datesObserved).toBe(5);
      expect(result.cpaByWeekday[1]?.conversions).toBe(5);
      expect(result.cpaByWeekday[1]?.cpa).toBeCloseTo(1_000, 6);
      expect(result.cpaByWeekday[5]?.datesObserved).toBe(5);
      expect(result.cpaByWeekday[5]?.conversions).toBe(5);
      expect(result.cpaByWeekday[5]?.cpa).toBeCloseTo(2_500, 6);
      expect(result.cpaByWeekday[3]?.datesObserved).toBe(5);
      expect(result.cpaByWeekday[3]?.conversions).toBe(5);
      expect(result.cpaByWeekday[3]?.cpa).toBeCloseTo(5_000, 6);

      // Total conversions = 15, days observed = 15 (5 semanas × 3 weekdays).
      expect(result.conversions).toBe(15);
      expect(result.daysObserved).toBe(15);
      // Impressions globales = 15_000 (supera el mínimo de 2000), 15 días
      // observados (>= 14) y 15 conversiones (>= 5) → hasEnoughEvidence true.
      expect(result.hasEnoughEvidence).toBe(true);
    });

    it('usa conversionRate como desempate cuando dos weekdays tienen el mismo CPA', async () => {
      // Dos weekdays con idéntico CPA pero distinta conversionRate.
      const metrics: MetricRow[] = [];
      const conversions: ConversionRow[] = [];

      const pushWeek = (
        firstIsoDay: string,
        weeks: number,
        perDayImpressions: number,
        perDayClicks: number,
        perDaySpend: number,
        perDayConversions: number,
      ): void => {
        const baseDate = new Date(`${firstIsoDay}T00:00:00.000Z`);
        for (let i = 0; i < weeks; i += 1) {
          const date = new Date(baseDate.getTime() + i * 7 * 86_400_000);
          const isoDay = date.toISOString().slice(0, 10);
          metrics.push({
            date: utcDate(isoDay),
            impressions: perDayImpressions,
            clicks: perDayClicks,
            spend: toDecimal(perDaySpend),
          });
          for (let c = 0; c < perDayConversions; c += 1) {
            conversions.push({
              occurredAt: utcDate(isoDay),
              status: ConversionStatus.ATTENDED,
            });
          }
        }
      };

      // Lunes: 5 fechas × 1 conv/día = 5 conv totales, spend 1_000/día →
      // CPA = (1_000×5)/5 = 1_000; conversionRate = 5/(50×5) = 0.02
      pushWeek('2026-01-05', 5, 1_000, 50, 1_000, 1);
      // Viernes: 5 fechas × 1 conv/día = 5 conv totales, spend 1_000/día →
      // CPA = 1_000; conversionRate = 5/(100×5) = 0.01 (clicks más altos → ratio menor)
      pushWeek('2026-01-09', 5, 1_000, 100, 1_000, 1);

      attachPrismaMock({ metrics, conversions });
      const service = new DiagnosisEvidenceService();

      const result = await service.load({
        businessId: 'test-business',
        serviceId: 'svc-balayage',
      });

      // Mismo CPA → gana el de mayor conversionRate (lunes).
      expect(result.bestWeekdays).toEqual([1, 5]);
      expect(result.cpaByWeekday[1]?.cpa).toBeCloseTo(1_000, 6);
      expect(result.cpaByWeekday[5]?.cpa).toBeCloseTo(1_000, 6);
      expect(result.cpaByWeekday[1]?.conversionRate).toBeGreaterThan(
        result.cpaByWeekday[5]?.conversionRate ?? 0,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Caso 5: filtrado por serviceId (campañas de otro servicio se excluyen)
  // ---------------------------------------------------------------------------
  describe('filtrado por serviceId', () => {
    it('pasa campaign.serviceId al filtro de AdMetricDaily.findMany', async () => {
      const mocks = attachPrismaMock({ metrics: [], conversions: [] });
      const service = new DiagnosisEvidenceService();

      await service.load({
        businessId: 'test-business',
        serviceId: 'svc-balayage',
        lookbackDays: 28,
      });

      expect(mocks.adMetricDaily.findMany).toHaveBeenCalledTimes(1);
      const adArgs = mocks.adMetricDaily.findMany.mock.calls[0]![0] as {
        where: Prisma.AdMetricDailyWhereInput;
      };
      expect(adArgs.where.businessId).toBe('test-business');
      expect(adArgs.where.date).toEqual(
        expect.objectContaining({
          gte: expect.any(Date),
          lte: expect.any(Date),
        }),
      );
      expect(adArgs.where.campaign).toEqual({ is: { serviceId: 'svc-balayage' } });

      expect(mocks.conversion.findMany).toHaveBeenCalledTimes(1);
      const convArgs = mocks.conversion.findMany.mock.calls[0]![0] as {
        where: Prisma.ConversionWhereInput;
      };
      expect(convArgs.where.businessId).toBe('test-business');
      expect(convArgs.where.campaign).toEqual({ is: { serviceId: 'svc-balayage' } });
    });

    it('omite el filtro de campaign cuando serviceId es null', async () => {
      const mocks = attachPrismaMock({ metrics: [], conversions: [] });
      const service = new DiagnosisEvidenceService();

      await service.load({
        businessId: 'test-business',
        serviceId: null,
      });

      const adArgs = mocks.adMetricDaily.findMany.mock.calls[0]![0] as {
        where: Prisma.AdMetricDailyWhereInput;
      };
      expect(adArgs.where.businessId).toBe('test-business');
      expect(adArgs.where.campaign).toBeUndefined();

      const convArgs = mocks.conversion.findMany.mock.calls[0]![0] as {
        where: Prisma.ConversionWhereInput;
      };
      expect(convArgs.where.businessId).toBe('test-business');
      expect(convArgs.where.campaign).toBeUndefined();
    });

    it('excluye métricas y conversiones del servicio equivocado cuando el filtro está activo', async () => {
      // Sembramos métricas y conversiones para dos servicios distintos.
      // El mock emula el JOIN y descarta las filas con _serviceId distinto.
      const metrics: MetricRow[] = [
        { date: utcDate('2026-01-05'), impressions: 1_000, clicks: 50, spend: toDecimal('5_000'), _serviceId: 'svc-balayage' as never } as MetricRow,
        { date: utcDate('2026-01-06'), impressions: 9_999, clicks: 99, spend: toDecimal('99_999'), _serviceId: 'svc-otro' as never } as MetricRow,
      ];
      const conversions: ConversionRow[] = [
        { occurredAt: utcDate('2026-01-05'), status: ConversionStatus.ATTENDED, _serviceId: 'svc-balayage' as never } as ConversionRow,
        { occurredAt: utcDate('2026-01-06'), status: ConversionStatus.ATTENDED, _serviceId: 'svc-otro' as never } as ConversionRow,
      ];
      attachPrismaMock({ metrics, conversions });
      const service = new DiagnosisEvidenceService();

      const result = await service.load({
        businessId: 'test-business',
        serviceId: 'svc-balayage',
      });

      // Sólo debe contar svc-balayage.
      expect(result.impressions).toBe(1_000);
      expect(result.clicks).toBe(50);
      expect(result.spend).toBe(5_000);
      expect(result.conversions).toBe(1);
      expect(result.daysObserved).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Caso 6: conversiones canceladas/no_show se excluyen
  // ---------------------------------------------------------------------------
  describe('filtrado de status de Conversion', () => {
    it('sólo cuenta status ∈ {PENDING, DEPOSIT_CONFIRMED, ATTENDED}', async () => {
      const mocks = attachPrismaMock({ metrics: [], conversions: [] });
      const service = new DiagnosisEvidenceService();

      await service.load({
        businessId: 'test-business',
        serviceId: 'svc-balayage',
      });

      const convArgs = mocks.conversion.findMany.mock.calls[0]![0] as {
        where: Prisma.ConversionWhereInput;
      };
      const statusFilter = convArgs.where.status;
      expect(statusFilter).toBeDefined();
      // Prisma tipa `in` cuando se usa `{ in: [...] }`.
      const inList = (statusFilter as { in?: ConversionStatus[] }).in;
      expect(inList).toEqual(
        expect.arrayContaining([
          ConversionStatus.PENDING,
          ConversionStatus.DEPOSIT_CONFIRMED,
          ConversionStatus.ATTENDED,
        ]),
      );
      expect(inList).not.toContain(ConversionStatus.CANCELLED);
      expect(inList).not.toContain(ConversionStatus.NO_SHOW);
    });

    it('no suma CANCELLED ni NO_SHOW al total ni a los weekdays', async () => {
      // Sembramos 5 conversiones válidas (PENDING + ATTENDED) y 5
      // inválidas (CANCELLED + NO_SHOW) en la misma fecha.
      const metrics: MetricRow[] = [
        {
          date: utcDate('2026-01-05'),
          impressions: 1_000,
          clicks: 100,
          spend: toDecimal('10_000'),
        },
      ];
      const conversions: ConversionRow[] = [
        { occurredAt: utcDate('2026-01-05'), status: ConversionStatus.PENDING },
        { occurredAt: utcDate('2026-01-05'), status: ConversionStatus.PENDING },
        { occurredAt: utcDate('2026-01-05'), status: ConversionStatus.DEPOSIT_CONFIRMED },
        { occurredAt: utcDate('2026-01-05'), status: ConversionStatus.ATTENDED },
        { occurredAt: utcDate('2026-01-05'), status: ConversionStatus.ATTENDED },
        // Inválidas — el mock las filtra antes de devolver.
        { occurredAt: utcDate('2026-01-05'), status: ConversionStatus.CANCELLED },
        { occurredAt: utcDate('2026-01-05'), status: ConversionStatus.CANCELLED },
        { occurredAt: utcDate('2026-01-05'), status: ConversionStatus.NO_SHOW },
        { occurredAt: utcDate('2026-01-05'), status: ConversionStatus.NO_SHOW },
        { occurredAt: utcDate('2026-01-05'), status: ConversionStatus.NO_SHOW },
      ];
      attachPrismaMock({ metrics, conversions });
      const service = new DiagnosisEvidenceService();

      const result = await service.load({
        businessId: 'test-business',
        serviceId: 'svc-balayage',
      });

      expect(result.conversions).toBe(5);
      expect(result.cpaByWeekday[1]?.conversions).toBe(5);
      expect(result.averageCpa).toBeCloseTo(10_000 / 5, 6);
    });
  });

  // ---------------------------------------------------------------------------
  // Sanity: contrato general del método
  // ---------------------------------------------------------------------------
  describe('contrato general', () => {
    it('windowStart es estrictamente anterior a windowEnd para lookbackDays > 1', async () => {
      attachPrismaMock({ metrics: [], conversions: [] });
      const service = new DiagnosisEvidenceService();

      const result = await service.load({
        businessId: 'test-business',
        serviceId: null,
        lookbackDays: 28,
      });

      expect(result.windowStart < result.windowEnd).toBe(true);
    });

    it('cpaByWeekday siempre tiene 7 entradas en orden weekday=0..6', async () => {
      attachPrismaMock({ metrics: [], conversions: [] });
      const service = new DiagnosisEvidenceService();

      const result = await service.load({
        businessId: 'test-business',
        serviceId: null,
      });

      expect(result.cpaByWeekday.map((bucket) => bucket.weekday)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });

    it('hasEnoughEvidence=false cuando impressions < 2000', async () => {
      // 14 días distintos, 5 conversiones, pero impressions globales bajas.
      const metrics: MetricRow[] = [];
      const conversions: ConversionRow[] = [];
      for (let i = 0; i < 14; i += 1) {
        const isoDay = new Date(utcDate('2026-01-05').getTime() + i * 86_400_000)
          .toISOString()
          .slice(0, 10);
        metrics.push({
          date: utcDate(isoDay),
          impressions: 50,
          clicks: 10,
          spend: toDecimal('1_000'),
        });
        conversions.push({
          occurredAt: utcDate(isoDay),
          status: ConversionStatus.ATTENDED,
        });
      }
      attachPrismaMock({ metrics, conversions });
      const service = new DiagnosisEvidenceService();

      const result = await service.load({
        businessId: 'test-business',
        serviceId: 'svc-balayage',
      });

      expect(result.daysObserved).toBe(14);
      expect(result.conversions).toBe(14);
      expect(result.impressions).toBe(14 * 50);
      expect(result.impressions).toBeLessThan(2_000);
      expect(result.hasEnoughEvidence).toBe(false);
    });
  });
});