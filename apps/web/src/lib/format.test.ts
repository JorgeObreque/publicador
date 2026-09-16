import { formatCurrency, safeRatio } from '@/lib/format';

describe('format utilities', () => {
  it('formats CLP currency', () => {
    expect(formatCurrency(123456)).toMatch(/123/);
  });

  it('avoids division by zero', () => {
    expect(safeRatio(10, 0)).toBe(0);
    expect(safeRatio(10, 2)).toBe(5);
  });
});
