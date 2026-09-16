import { compareVariants, computeMetrics } from './metrics';

describe('analytics metrics', () => {
  it('computes core metrics with safe division', () => {
    const metrics = computeMetrics({
      impressions: 1000,
      clicks: 100,
      spend: 5000,
      conversions: 10,
      revenue: 25000,
    });
    expect(metrics.ctr).toBeCloseTo(0.1);
    expect(metrics.cpc).toBe(50);
    expect(metrics.cvr).toBeCloseTo(0.1);
    expect(metrics.cpl).toBe(500);
    expect(metrics.roas).toBe(5);
  });

  it('handles zero denominators', () => {
    const metrics = computeMetrics({ impressions: 0, clicks: 0, spend: 0, conversions: 0 });
    expect(metrics.ctr).toBe(0);
    expect(metrics.cpc).toBe(0);
    expect(metrics.cpl).toBe(0);
    expect(metrics.roas).toBeUndefined();
  });

  it('compares variants and reports lift', () => {
    const result = compareVariants([
      {
        variantCode: 'A',
        metrics: computeMetrics({ impressions: 1000, clicks: 100, spend: 1000, conversions: 4 }),
      },
      {
        variantCode: 'B',
        metrics: computeMetrics({ impressions: 1000, clicks: 100, spend: 1000, conversions: 5 }),
      },
    ]);
    expect(result.winner?.variantCode).toBe('B');
    expect(result.lift).toBeCloseTo(0.25);
  });
});
