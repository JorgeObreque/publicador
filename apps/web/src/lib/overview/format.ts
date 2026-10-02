import type { PerformanceTotals } from './api';

const CLP = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
  currencyDisplay: 'code',
});

const intFmt = new Intl.NumberFormat('es-CL');

export const formatCurrency = (value: number, currency: string = 'CLP'): string => {
  if (!Number.isFinite(value) || value === 0) return `${currency} 0`;
  if (currency === 'CLP') return CLP.format(Math.round(value)).replace('CLP', '\$');
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Math.round(value));
};

export const formatInteger = (value: number): string => intFmt.format(value);

export const formatPercent = (value: number, fractionDigits = 2): string =>
  `${intFmt.format(Number(value.toFixed(fractionDigits)))} %`;

export const formatDelta = (delta: number | null): string => {
  if (delta === null || Number.isNaN(delta)) return '—';
  const rounded = Math.round(delta);
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${intFmt.format(rounded)} %`;
};

export const formatDate = (value: string | null): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium' }).format(date);
};

export const emptyTotals = (currency: string = 'CLP'): PerformanceTotals => ({
  spend: 0,
  impressions: 0,
  clicks: 0,
  results: 0,
  ctr: 0,
  cpc: 0,
  cpl: 0,
  conversionRate: 0,
  currency,
});
