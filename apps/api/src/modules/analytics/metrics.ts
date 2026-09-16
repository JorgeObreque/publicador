export interface MetricInputs {
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  revenue?: number;
}

export interface MetricResults extends MetricInputs {
  ctr: number;
  cpc: number;
  cvr: number;
  cpl: number;
  roas?: number;
}

const safe = (numerator: number, denominator: number): number =>
  denominator > 0 ? numerator / denominator : 0;

export function computeMetrics(inputs: MetricInputs): MetricResults {
  const ctr = safe(inputs.clicks, inputs.impressions);
  const cpc = safe(inputs.spend, inputs.clicks);
  const cvr = safe(inputs.conversions, inputs.clicks);
  const cpl = safe(inputs.spend, inputs.conversions);
  const roas = inputs.revenue !== undefined ? safe(inputs.revenue, inputs.spend) : undefined;
  return { ...inputs, ctr, cpc, cvr, cpl, roas };
}

export interface VariantResult {
  variantCode: string;
  metrics: MetricResults;
}

export interface ComparisonResult {
  winner: VariantResult | null;
  lift: number | null;
}

export function compareVariants(variants: VariantResult[]): ComparisonResult {
  if (variants.length < 2) return { winner: null, lift: null };
  const sorted = [...variants].sort((a, b) => b.metrics.conversions - a.metrics.conversions);
  const [best, second] = sorted;
  const lift = second.metrics.conversions > 0
    ? (best.metrics.conversions - second.metrics.conversions) / second.metrics.conversions
    : null;
  return { winner: best, lift };
}
