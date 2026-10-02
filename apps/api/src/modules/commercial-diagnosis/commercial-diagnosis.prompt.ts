import type {
  DiagnosisAdjustment,
  DiagnosisContext,
  DiagnosisPayload,
} from './commercial-diagnosis.types';

/**
 * Genera los prompts de sistema y usuario para el módulo
 * `CommercialDiagnosis`. Sigue el mismo patrón que
 * `campaign-brief-suggest-rules.prompt.ts` y `analyze.prompt.ts`: el
 * `SYSTEM_INSTRUCTIONS` es determinista y concentra todas las reglas
 * duras; el `userPrompt` se compone a partir del payload específico del
 * negocio.
 *
 * El objetivo NO es escribir copy ni resumir la oferta: es dialogar con
 * el operador para identificar el problema comercial concreto y proponer
 * una meta medible. La IA puede responder con dos formas:
 *
 *  - `READY`: ya tiene suficiente información para proponer `situation`,
 *    `opportunity`, `primaryGoal`, `primaryConversion`,
 *    `recommendedTitle`, `recommendedWeeklyAdd`, `availableCapacity` (más
 *    la estrategia derivada, si la incluye). El servicio marca la
 *    diagnosis como `READY` y persiste los valores.
 *  - `ASK`:  necesita UNA sola pregunta concreta para destrabar la
 *    decisión. El servicio persiste la pregunta como
 *    `DiagnosticAnswer` con `wasClarification: true` y
 *    `answerText: null`.
 *
 * Convenciones de estilo:
 *  - Idioma: español neutro.
 *  - PROHIBIDO usar el nombre del negocio en la `recommended` (la marca
 *    se inyecta al `CampaignBrief` en otra capa).
 *  - Sin emojis en la `recommended` ni en `provenance`.
 *  - Cada string de la respuesta ≤ 1000 caracteres.
 *
 * El prompt builder también expone `buildAdjustmentPrompt` para el
 * endpoint `POST /commercial-diagnoses/:id/adjust`. En ese caso la IA
 * debe devolver la `recommended` actualizada respetando el contexto y la
 * instrucción libre del operador.
 */

export interface DiagnosisPromptMessages {
  systemPrompt: string;
  userPrompt: string;
}

const SYSTEM_INSTRUCTIONS = `Eres un estratega comercial chileno que ayuda a operadores de pequeños negocios a traducir su "situación actual" en una meta publicitaria medible.

Debes responder EXCLUSIVAMENTE con un objeto JSON válido, sin texto adicional, sin bloques de código, sin explicaciones fuera del JSON.

Reglas estrictas que NUNCA puedes romper:
1. PROHIBIDO usar el nombre del negocio, la marca o variantes en cualquier campo de "recommended". La marca se inyecta en otra capa del sistema.
2. PROHIBIDO usar emojis en cualquier campo de "recommended", "provenance" ni "strategy".
3. PROHIBIDO mayúsculas sostenidas, signos de exclamación repetidos ("!!!") o lenguaje de eslogan publicitario. Tono: una conversación profesional en español neutro.
4. PROHIBIDO dar respuestas genéricas como "conseguir más clientes", "vender más", "aumentar las ventas" o equivalentes. Tu respuesta debe nombrar el problema comercial concreto (por ejemplo: "no llegan evaluaciones agendadas los lunes", "el ticket promedio se quedó bajo", "los clientes vuelven una sola vez").
5. La "primaryGoal" debe ser una meta medible (un volumen y un plazo), p.ej. "conseguir 8 evaluaciones agendadas por semana". PROHIBIDO devolver metas abstractas ("dar a conocer", "posicionar", "ser más visible").
6. "recommendedWeeklyAdd" debe ser un entero positivo (clientes nuevos o conversiones nuevas por semana que el negocio puede absorber según su capacidad). Si no puedes estimarlo, devuelve null.
7. "availableCapacity" debe coincidir con "weeklyServiceCapacity" del perfil del negocio. Si no hay capacidad registrada, devuelve null (NO inventes números).
8. "primaryConversion" es la acción concreta que la campaña busca: "Reservas", "Leads por WhatsApp", "Reservas online", etc. Una frase corta en español.
9. "recommendedTitle" es un nombre interno del plan (≤ 120 caracteres). No es copy publicitario.
10. PROHIBIDO inventar datos que no estén en el user prompt (presupuestos, Costo por lead (CPL), Indicadores clave de rendimiento (KPI), métricas), EXCEPTO cuando "Modo sin evidencia" esté activo, en cuyo caso PUEDES proponer Costo por adquisición (CPA) objetivo inicial, máximo aceptable y justificación breve.
11. Si necesitas UNA sola pregunta concreta para destrabar la decisión, devuelve "decision": "ASK" y completa "pendingQuestion" con un "key" estable (≤ 80 caracteres, snake_case) y un "text" claro para la operadora. NO devuelvas preguntas múltiples.
12. Si ya tienes suficiente información (situación, oportunidad, objetivo, conversión, título y volumen semanal), devuelve "decision": "READY" SIN pendingQuestion.
13. "provenance" mapea los campos de "recommended" a su origen (USER_CURRENT_SITUATION, USER_PROFILE, AI_INFERENCE, SYSTEM_CALCULATION). Usa AI_INFERENCE cuando lo infieras del contexto, SYSTEM_CALCULATION cuando derives de una capacidad registrada, y USER_CURRENT_SITUATION cuando lo tomes literalmente del texto de la operadora.
14. Si tienes toda la información necesaria, incluye también un bloque "strategy" con: businessObjective (≤ 1000), offer (≤ 1000), primaryKpi (≤ 80), idealCustomerProfile (≤ 2000 o null), qualifyingQuestions (array de strings), constraints (array de strings, incluye "No usar X" si el perfil aporta palabras prohibidas), stopIf (≤ 1000 o null), scaleIf (≤ 1000 o null), initialDurationDays (entero positivo, default 14), initialDailyBudgetCLP (null si no hay dato), initialLifetimeBudgetCLP (null si no hay dato), initialCpaTargetCLP (null si no hay dato), initialCpaCapCLP (número o null), cpaRationale (string ≤ 500 caracteres; breve justificación del CPA objetivo propuesto, sólo cuando Modo sin evidencia esté activo), priceJustification (string ≤ 500 caracteres; justificación opcional del precio objetivo de la oferta), progressionSteps (array de enteros positivos).
15. Devuelve EXACTAMENTE este JSON:
{
  "decision": "READY" | "ASK",
  "recommended": {
    "situation": string | null,
    "opportunity": string | null,
    "primaryGoal": string | null,
    "primaryConversion": string | null,
    "recommendedTitle": string | null,
    "recommendedWeeklyAdd": number | null,
    "availableCapacity": number | null,
    "pendingQuestion": { "key": string, "text": string } | null
  },
  "provenance": {
    "situation": { "value": string | number | boolean | null, "source": "USER_PROFILE" | "USER_CURRENT_SITUATION" | "AI_INFERENCE" | "SYSTEM_CALCULATION" | "AI_RECOMMENDATION" | "CAMPAIGN_OBSERVED_DATA" },
    "opportunity": { "value": ..., "source": ... },
    ...
  },
  "strategy": { ... } | null
}
16. NO incluyas campos extra. NO incluyas explicaciones. NO cierres con markdown. NO uses "AQUI" ni placeholders.
`;

const ADJUSTMENT_SYSTEM_INSTRUCTIONS = `Eres un estratega comercial chileno. Tu trabajo es APLICAR una instrucción de ajuste del operador sobre una "recommended" previa.

Debes responder EXCLUSIVAMENTE con un objeto JSON válido, sin texto adicional, sin bloques de código, sin explicaciones fuera del JSON.

Reglas estrictas que NUNCA puedes romper:
1. PROHIBIDO usar el nombre del negocio o marca en cualquier campo devuelto.
2. PROHIBIDO usar emojis.
3. PROHIBIDO mayúsculas sostenidas y signos de exclamación repetidos.
4. PROHIBIDO dar respuestas genéricas ("vender más", "conseguir más clientes"). Nombra el cambio concreto que aplicas.
5. Mantén los campos que la instrucción NO pida modificar. Si cambias "primaryGoal" o "recommendedWeeklyAdd", asegúrate de que la "recommended" siga siendo coherente.
6. "provenance" debe marcar con source "AI_RECOMMENDATION" los campos que toques en este ajuste y mantener el source original en los demás.
7. Devuelve EXACTAMENTE este JSON:
{
  "decision": "READY",
  "recommended": {
    "situation": string | null,
    "opportunity": string | null,
    "primaryGoal": string | null,
    "primaryConversion": string | null,
    "recommendedTitle": string | null,
    "recommendedWeeklyAdd": number | null,
    "availableCapacity": number | null,
    "pendingQuestion": null
  },
  "provenance": { ... },
  "strategy": { ... } | null
}
8. NO devuelvas "decision": "ASK". El endpoint /adjust exige una respuesta READY.
10. PROHIBIDO inventar datos que no estén en el user prompt (presupuestos, Costo por lead (CPL), Indicadores clave de rendimiento (KPI), métricas), EXCEPTO cuando "Modo sin evidencia" esté activo, en cuyo caso PUEDES proponer Costo por adquisición (CPA) objetivo inicial, máximo aceptable y justificación breve.
11. NO incluyas campos extra. NO incluyas explicaciones. NO cierres con markdown.
`;

const formatInteger = (value: number | null | undefined): string => {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) {
    return 'sin registrar';
  }
  return `${Math.round(value)}`;
};

const formatClp = (value: number | null | undefined): string => {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) {
    return 'sin tope registrado';
  }
  const rounded = Math.round(value);
  const formatted = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `$${formatted} CLP`;
};

const buildUserPrompt = (payload: DiagnosisPayload): string => {
  const context = payload.context;
  const lines: string[] = [];
  lines.push('Analiza la siguiente situación del negocio y propón una meta medible o pide UNA pregunta concreta.');
  lines.push('');

  lines.push('=== PERFIL DEL NEGOCIO ===');
  lines.push(
    `Perfil completado: ${context.profileReady ? 'sí' : 'no (operadora aún no ha cerrado el contexto)'}.`,
  );
  lines.push(`Clienta ideal: ${context.primaryCustomerProfile || 'sin descripción'}.`);
  if (context.brandVoiceKeywords.length > 0) {
    lines.push(`Voz de marca (palabras clave): ${context.brandVoiceKeywords.join(', ')}.`);
  }
  if (context.wordsToAvoid.length > 0) {
    lines.push(`Palabras prohibidas: ${context.wordsToAvoid.join(', ')}.`);
  }
  if (context.qualifyingQuestions.length > 0) {
    lines.push('Preguntas de calificación registradas:');
    for (const q of context.qualifyingQuestions) {
      lines.push(`- ${q}`);
    }
  } else {
    lines.push('Preguntas de calificación: ninguna registrada.');
  }
  lines.push(`Capacidad semanal estimada: ${formatInteger(context.weeklyServiceCapacity)} clientes.`);
  lines.push(`Meta mensual de adquisiciones: ${formatInteger(context.monthlyAcquisitionGoal)} clientes/mes.`);
  lines.push(`Máximo aceptable por adquisición (tope de CPA): ${formatClp(context.costPerAcquisitionCap)}.`);
  lines.push('');

  lines.push('=== UBICACIÓN Y TERRITORIO ===');
  if (context.displayLocation) {
    lines.push(`Ubicación del negocio: ${context.displayLocation}.`);
  } else {
    lines.push('Ubicación del negocio: sin dirección registrada en el perfil.');
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
      `Ingreso mensual estimado del hogar mediano en la comuna: ${formatClp(context.income)}.`,
    );
  }
  if (context.profileDescription) {
    lines.push(`Perfil territorial (orientativo): ${context.profileDescription}`);
  }
  lines.push(
    `Modo estimación: ${
      context.evidenceMode === 'EVIDENCE'
        ? 'soportado por evidencia histórica'
        : 'sin evidencia histórica - puede proponer Costo por adquisición (CPA) objetivo e inicializable basado en servicio, capacidad, oferta y meta'
    }.`,
  );
  lines.push('');

  lines.push('=== SERVICIOS DISPONIBLES ===');
  if (context.services.length === 0) {
    lines.push('El negocio aún no tiene servicios activos registrados.');
  } else {
    for (const service of context.services) {
      const description = service.description ? ` — ${service.description}` : '';
      const price =
        service.price !== null && service.price !== undefined
          ? ` (precio referencial ${formatClp(Number(service.price.toString()))})`
          : '';
      const duration = service.duration !== null && service.duration !== undefined
        ? ` · ${service.duration} min`
        : '';
      lines.push(`- ${service.name}${description}${price}${duration}.`);
    }
  }
  // P1-Hallazgo 8: explicitamos el precio del servicio principal en una
  // línea aparte para que la IA lo vea al proponer el Costo por
  // adquisición (CPA) objetivo. Sin esto, el precio sólo se listaba
  // embebido en la descripción del servicio y podía pasar desapercibido.
  if (context.primaryServicePrice !== null && context.primaryServicePrice > 0) {
    lines.push(`Precio del servicio principal: ${formatClp(context.primaryServicePrice)}.`);
  }
  lines.push('');

  lines.push('=== SITUACIÓN DECLARADA POR LA OPERADORA ===');
  lines.push(payload.currentSituation.trim());
  lines.push('');

  if (payload.serviceId) {
    lines.push(`=== SERVICIO SELECCIONADO ===`);
    lines.push(`ID: ${payload.serviceId}.`);
    lines.push('');
  }

  if (payload.conversation.length > 0) {
    lines.push('=== RESPUESTAS PREVIAS DE LA OPERADORA ===');
    for (const entry of payload.conversation) {
      const answer = entry.answerText ? ` → ${entry.answerText}` : ' → (pendiente)';
      lines.push(`- Pregunta (${entry.questionKey}): ${entry.questionText}${answer}`);
    }
    lines.push('');
  }

  if (payload.existingRecommended) {
    lines.push('=== RECOMENDACIÓN ACTUAL (PARA REFERENCIA) ===');
    const r = payload.existingRecommended;
    lines.push(`Situación: ${r.situation ?? 'no definida'}.`);
    lines.push(`Oportunidad: ${r.opportunity ?? 'no definida'}.`);
    lines.push(`Objetivo principal: ${r.primaryGoal ?? 'no definido'}.`);
    lines.push(`Conversión: ${r.primaryConversion ?? 'no definida'}.`);
    lines.push(`Título: ${r.recommendedTitle ?? 'no definido'}.`);
    lines.push(
      `Volumen semanal recomendado: ${r.recommendedWeeklyAdd !== null ? `${r.recommendedWeeklyAdd} clientes/semana` : 'sin definir'}.`,
    );
    lines.push(
      `Capacidad disponible: ${r.availableCapacity !== null ? `${r.availableCapacity} clientes/semana` : 'sin definir'}.`,
    );
    lines.push('');
  }

  lines.push('=== INSTRUCCIONES FINALES ===');
  lines.push(
    'Devuelve SOLO el JSON con la estructura indicada. NO agregues texto antes ni después. Cumple todas las reglas del system prompt. Si el contexto territorial aporta información, úsala para ajustar la sensibilidad de los volúmenes (NO para inventar cifras). Si la situación declarada ya contiene un dolor concreto y una meta implícita, devuelve READY sin preguntar.',
  );

  return lines.join('\n');
};

export function buildDiagnosisPrompt(payload: DiagnosisPayload): DiagnosisPromptMessages {
  return {
    systemPrompt: SYSTEM_INSTRUCTIONS,
    userPrompt: buildUserPrompt(payload),
  };
}

export function buildAdjustmentPrompt(params: DiagnosisAdjustment): DiagnosisPromptMessages {
  const lines: string[] = [];
  lines.push('Aplica el siguiente ajuste sobre la "recommended" actual del diagnóstico comercial.');
  lines.push('');
  lines.push('=== INSTRUCCIÓN DEL OPERADOR ===');
  lines.push(params.instruction.trim());
  lines.push('');
  lines.push('=== CONTEXTO RESUMIDO ===');
  lines.push(buildUserPrompt(params.payload));
  return {
    systemPrompt: ADJUSTMENT_SYSTEM_INSTRUCTIONS,
    userPrompt: lines.join('\n'),
  };
}

/**
 * Helper público para tests: serializa el contexto en una forma textual
 * estable. Se usa únicamente desde specs (no desde el flujo de negocio).
 */
export const serializeDiagnosisContext = (context: DiagnosisContext): string => {
  const parts: string[] = [];
  parts.push(`profileReady=${context.profileReady}`);
  parts.push(`weeklyServiceCapacity=${context.weeklyServiceCapacity ?? 'null'}`);
  parts.push(`monthlyAcquisitionGoal=${context.monthlyAcquisitionGoal ?? 'null'}`);
  parts.push(`services=${context.services.length}`);
  parts.push(`qualifyingQuestions=${context.qualifyingQuestions.length}`);
  return parts.join(';');
};