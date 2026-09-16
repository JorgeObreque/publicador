export const formatCurrency = (value: number, currency = 'CLP') =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency }).format(value);

export const safeRatio = (numerator: number, denominator: number): number => {
  if (!denominator || Number.isNaN(denominator)) return 0;
  return numerator / denominator;
};
