import type { PerformancePromptPayload } from './analyze.types';

const SYSTEM_INSTRUCTIONS = `Eres un analista publicitario senior que revisa el rendimiento de campañas de Meta Ads.
Debes responder EXCLUSIVAMENTE con un objeto JSON válido, sin texto adicional, sin bloques de código, sin explicaciones fuera del JSON.

Reglas estrictas que NUNCA puedes romper:
1. NUNCA recomiendes pausar la campaña ni modificar el presupuesto (no PAUSE, no BUDGET_CHANGE, no SCALE_UP, etc.).
2. La acción ('action') SOLO puede ser una de estas cinco cadenas exactas:
   - 'WAIT'                → métricas estables, seguir observando sin tocar la campaña.
   - 'KEEP'                → la campaña muestra señales positivas, mantenerla activa.
   - 'CREATE_VARIANT'      → hay evidencia suficiente para sugerir una variante creativa nueva.
   - 'REVIEW_CONVERSION'   → el rendimiento publicitario es aceptable pero la conversión final parece caer.
   - 'NEEDS_MORE_DATA'     → datos insuficientes para concluir (sin comparación previa, muy pocas impresiones, etc.).
3. 'confidence' DEBE ser 'LOW' si impressions < 2000 o results < 5.
4. Si NO existe período anterior ('hasPreviousPeriod' es false), responde con 'NEEDS_MORE_DATA' o 'WAIT' y declara la limitación en 'caveats'.
5. 'recommendedVariable' SOLO puede ser: 'PRIMARY_TEXT', 'HEADLINE', 'IMAGE', 'BUDGET', 'TARGETING' o 'NONE' (cuando no aplica).
6. 'evidence' debe ser un array JSON con entre 3 y 6 strings en español que respalden la decisión usando los números entregados. Nunca string único, nunca número, nunca null.
7. 'caveats' puede contener entre 0 y 3 advertencias (no inventar datos faltantes). Si no hay advertencias, devuelve un array JSON vacío: [] (nunca null, nunca string).
8. 'recommendedNextStep' debe ser una instrucción concreta en español (qué probar o qué monitorear).
9. No incluyas promesas numéricas ni proyecciones no respaldadas por el input.
10. Toda la respuesta debe estar en español neutro y tono profesional.

Estructura EXACTA del JSON de salida:
{
  "summary": string,
  "diagnosis": string,
  "action": "WAIT" | "KEEP" | "CREATE_VARIANT" | "REVIEW_CONVERSION" | "NEEDS_MORE_DATA",
  "recommendedVariable": "PRIMARY_TEXT" | "HEADLINE" | "IMAGE" | "BUDGET" | "TARGETING" | "NONE",
  "confidence": "LOW" | "MEDIUM" | "HIGH",
  "evidence": string[3..6],
  "caveats": string[0..3],
  "recommendedNextStep": string
}
`;

const formatDelta = (value: number | null): string => {
  if (value === null || Number.isNaN(value)) return 'sin comparación';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
};

const formatMoney = (value: number, currency: string): string => `${Math.round(value)} ${currency}`;

export interface PerformancePromptMessages {
  systemPrompt: string;
  userPrompt: string;
}

export function buildPerformancePrompt(payload: PerformancePromptPayload): PerformancePromptMessages {
  const lines: string[] = [];
  lines.push('Analiza la siguiente campaña de Meta Ads y entrega el JSON con la estructura indicada.');
  lines.push('');
  lines.push(`Campaña: ${payload.campaign.name} (id Meta: ${payload.campaign.metaCampaignId})`);
  lines.push(`Estado declarado por Meta: ${payload.campaign.status ?? 'desconocido'}`);
  if (payload.campaign.dailyBudget !== null) {
    lines.push(`Presupuesto diario referencial: ${formatMoney(payload.campaign.dailyBudget, payload.currency)}`);
  }
  if (payload.campaign.lifetimeBudget !== null) {
    lines.push(`Presupuesto total referencial: ${formatMoney(payload.campaign.lifetimeBudget, payload.currency)}`);
  }
  lines.push('');
  lines.push(`Período: ${payload.period.from} → ${payload.period.to} (${payload.period.days} días)`);
  lines.push(`Moneda: ${payload.currency}`);
  lines.push('');
  lines.push('Totales del período:');
  lines.push(`- Inversión: ${formatMoney(payload.totals.spend, payload.currency)}`);
  lines.push(`- Impresiones: ${payload.totals.impressions}`);
  lines.push(`- Clics: ${payload.totals.clicks}`);
  lines.push(`- Resultados: ${payload.totals.results}`);
  lines.push(`- CTR: ${payload.totals.ctr.toFixed(2)}%`);
  lines.push(`- CPC: ${formatMoney(payload.totals.cpc, payload.currency)}`);
  lines.push(`- CPL: ${formatMoney(payload.totals.cpl, payload.currency)}`);
  lines.push(`- Tasa de conversión: ${payload.totals.conversionRate.toFixed(2)}%`);
  lines.push('');
  lines.push('Comparación contra período anterior:');
  lines.push(`- Variación de inversión: ${formatDelta(payload.comparison.spendDelta)}`);
  lines.push(`- Variación de resultados: ${formatDelta(payload.comparison.resultsDelta)}`);
  lines.push(`- Variación de CPL: ${formatDelta(payload.comparison.cplDelta)}`);
  lines.push(`- Variación de CTR: ${formatDelta(payload.comparison.ctrDelta)}`);
  lines.push(`- Variación de CPC: ${formatDelta(payload.comparison.cpcDelta)}`);
  lines.push(`- ¿Existe período anterior?: ${payload.hasPreviousPeriod ? 'sí' : 'no'}`);
  lines.push('');
  if (payload.daily.length > 0) {
    lines.push('Serie diaria (hasta 30 puntos, en orden cronológico):');
    for (const day of payload.daily) {
      lines.push(
        `- ${day.date}: spend=${formatMoney(day.spend, payload.currency)}, imp=${day.impressions}, clics=${day.clicks}, resultados=${day.results}`,
      );
    }
  } else {
    lines.push('Serie diaria: no hay datos diarios suficientes.');
  }
  lines.push('');
  lines.push(
    'Devuelve SOLO el JSON pedido. No agregues texto antes ni después. Cumple todas las reglas del system prompt.',
  );

  return {
    systemPrompt: SYSTEM_INSTRUCTIONS,
    userPrompt: lines.join('\n'),
  };
}
