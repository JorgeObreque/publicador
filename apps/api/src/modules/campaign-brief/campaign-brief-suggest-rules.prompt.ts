import type { SuggestRulesPayload } from './campaign-brief-suggest-rules.types';

/**
 * Genera los prompts de sistema y usuario para el endpoint
 * `POST /api/v1/campaign-briefs/:id/suggest-rules`.
 *
 * El objetivo NO es escribir copy ni resumir la oferta, sino proponer DOS
 * reglas de decisión operativas basadas en el objetivo comercial y en el
 * contexto del negocio:
 *
 *  - `stopIf`     → cuándo el operador debería pausar la campaña (umbral
 *                   de fracaso razonables para el KPI).
 *  - `scaleIf`    → cuándo conviene aumentar la inversión (condición de
 *                   éxito medible y conservadora).
 *
 * Convenciones:
 *  - Idioma: español neutro cercano (no eslogan publicitario).
 *  - Sin nombrar la marca en las reglas.
 *  - Si la regla incluye un número monetario, formato CLP con separador de
 *    miles (ej: `$5.000`).
 *  - Sin emojis.
 *  - Cada regla ≤ 280 caracteres.
 *
 * El system prompt es determinista y NO depende del `BusinessProfile`:
 * todas las restricciones duras viven aquí dentro, lo que mantiene el
 * contrato simple y testeable.
 */

const SYSTEM_INSTRUCTIONS = `Eres un analista de medios digitales chileno que ayuda a operadores de pequeños negocios a definir reglas claras de "stop / scale" para sus campañas en Meta.

Debes responder EXCLUSIVAMENTE con un objeto JSON válido, sin texto adicional, sin bloques de código, sin explicaciones fuera del JSON.

Reglas estrictas que NUNCA puedes romper:
1. PROHIBIDO nombrar el nombre del negocio, la marca o variantes en ninguna de las dos reglas. Las reglas son operativas (umbral + condición), NO copy publicitario.
2. PROHIBIDO usar emojis en las reglas (stopIf y scaleIf).
3. PROHIBIDO mayúsculas sostenidas, signos de exclamación repetidos ("!!!") o lenguaje de eslogan publicitario. Tono: una conversación profesional en español neutro.
4. Si una regla incluye dinero, formato CLP con separador de miles con punto y SIN decimales, precedido de "$" (ej: "$5.000"). NO usar otros formatos.
5. PROHIBIDO inventar datos que no estén en el user prompt (presupuestos, CPL, nombre del servicio, KPIs). Si falta información, usa rangos razonables amplios ("menos de $10.000", "más de 5 conversaciones") sin inventar cifras exactas.
6. Cada regla (stopIf y scaleIf) debe tener entre 1 y 280 caracteres. Frases cortas, claras y operativas. Sin saltos de línea.
7. stopIf debe describir una condición de FRACASO basada en el KPI/objetivo comercial. Sugerencia de estructura: "Si en {N} días no hay {objetivo/KPI}" o "Si el CPL supera $X sin {Y} resultados".
8. scaleIf debe describir una condición de ÉXITO medible y conservadora. Sugerencia de estructura: "Si el CPL baja de $X con más de {Y} conversaciones calificadas" o "Si en {N} días hay {K} leads calificados".
9. Ambas reglas deben ser coherentes entre sí: stopIf marca el umbral de fracaso, scaleIf el umbral de éxito. NO deben decir cosas contradictorias.
10. Si el contexto socioeconómico está disponible, puedes usarlo para ajustar los umbrales (ej: comunas con menor ingreso estimado → umbrales más conservadores en CPL).
11. Devuelve EXACTAMENTE este JSON:
{
  "stopIf": string (1..280),
  "scaleIf": string (1..280)
}
12. NO incluyas campos extra. NO incluyas explicaciones. NO cierres con markdown.
`;

const formatClp = (value: number | null | undefined): string => {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) {
    return 'sin tope registrado';
  }
  const rounded = Math.round(value);
  const formatted = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `$${formatted}`;
};

const formatInteger = (value: number | null | undefined): string => {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) {
    return 'sin duración definida';
  }
  return `${Math.round(value)} días`;
};

export interface SuggestRulesPromptMessages {
  systemPrompt: string;
  userPrompt: string;
}

export function buildSuggestRulesPrompt(
  payload: SuggestRulesPayload,
): SuggestRulesPromptMessages {
  const context = payload.context;
  const lines: string[] = [];
  lines.push(
    'Genera las dos reglas de decisión (stopIf y scaleIf) para el siguiente plan de campaña publicitaria.',
  );
  lines.push('');

  lines.push('=== OBJETIVO COMERCIAL ===');
  lines.push(`Nombre del plan: ${payload.title}`);
  lines.push(`Objetivo comercial: ${payload.businessObjective}`);
  lines.push(`Oferta: ${payload.offer}`);
  lines.push(`KPI principal: ${payload.primaryKpi}`);
  if (payload.idealCustomerProfile) {
    lines.push(`Persona a atraer: ${payload.idealCustomerProfile}`);
  }
  if (payload.qualifyingQuestions.length > 0) {
    lines.push('Preguntas de calificación:');
    for (const q of payload.qualifyingQuestions) {
      lines.push(`- ${q}`);
    }
  }
  lines.push('');

  lines.push('=== ECONOMÍA DEL PLAN ===');
  lines.push(`Tope por adquisición (CPA cap): ${formatClp(payload.costPerAcquisitionCap)}`);
  lines.push(`Presupuesto diario: ${formatClp(payload.dailyBudgetCap)}`);
  lines.push(`Presupuesto total de la campaña: ${formatClp(payload.lifetimeBudgetCap)}`);
  lines.push(`Adquisición mensual esperada: ${
    payload.monthlyAcquisitionGoal && payload.monthlyAcquisitionGoal > 0
      ? `${payload.monthlyAcquisitionGoal} clientes/mes`
      : 'sin meta mensual registrada'
  }`);
  lines.push(`Duración planificada: ${formatInteger(payload.plannedDurationDays)}`);
  lines.push('');

  if (context) {
    lines.push('=== NEGOCIO Y SERVICIO ===');
    if (context.businessName) {
      lines.push(`Negocio: ${context.businessName}`);
    }
    if (context.serviceName) {
      lines.push(`Servicio: ${context.serviceName}`);
      if (context.serviceDescription) {
        lines.push(`Descripción del servicio: ${context.serviceDescription}`);
      }
    }
    lines.push('');

    lines.push('=== UBICACIÓN Y TERRITORIO ===');
    if (context.displayLocation) {
      lines.push(`Ubicación: ${context.displayLocation}`);
    } else {
      lines.push('Ubicación: sin dirección registrada en el perfil del negocio.');
    }
    if (context.communeName || context.regionName) {
      const parts: string[] = [];
      if (context.communeName) parts.push(`comuna ${context.communeName}`);
      if (context.regionName) parts.push(`región ${context.regionName}`);
      lines.push(`Contexto territorial: ${parts.join(', ')}.`);
    }
    if (context.population !== null) {
      lines.push(`Población estimada de la comuna: ${context.population.toLocaleString('es-CL')} habitantes.`);
    }
    if (context.income !== null) {
      lines.push(
        `Ingreso mensual estimado del hogar mediano en la comuna: ${formatClp(context.income)} CLP.`,
      );
    }
    if (context.profileDescription) {
      lines.push(`Perfil territorial (orientativo): ${context.profileDescription}`);
    }
    if (context.adultShare25_55 !== null) {
      lines.push(
        `Fracción estimada de adultos entre 25 y 55 años en la comuna: ${(context.adultShare25_55 * 100).toFixed(0)}%.`,
      );
    }
    lines.push('');
  }

  lines.push('=== INSTRUCCIONES FINALES ===');
  lines.push(
    'Devuelve SOLO el JSON con la estructura indicada (stopIf y scaleIf). NO agregues texto antes ni después. Cumple todas las reglas del system prompt. NO superes los 280 caracteres por regla. NO uses emojis. Si el contexto territorial aporta información, úsala para ajustar la sensibilidad de los umbrales (NO para inventar cifras).',
  );

  return {
    systemPrompt: SYSTEM_INSTRUCTIONS,
    userPrompt: lines.join('\n'),
  };
}