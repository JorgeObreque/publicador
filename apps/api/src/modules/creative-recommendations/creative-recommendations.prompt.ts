import {
  HEADLINE_MAX,
  PRIMARY_TEXT_MAX,
  SUGGESTIONS_LENGTH,
  type BusinessProfileSnapshot,
  type RecommendationPayload,
} from './creative-recommendations.types';
import { findCommune, findRegion } from '../territory/data/chile-territory';

/**
 * Genera los prompts de sistema y usuario para el endpoint de
 * recomendaciones de copy. Sigue el mismo patrón que `analyze.prompt.ts`
 * para mantener consistencia entre los módulos que consumen OpenAI.
 *
 * El prompt se adapta al `mode` del request:
 *
 * - `INITIAL`: 3 propuestas completas (primaryText + headline) con
 *   dirección fija al final de cada primaryText.
 * - `REGENERATE_PRIMARY_TEXT`: 3 textos alternativos; se mantiene
 *   exactamente el `headline` del `currentCopy` y se añade la dirección
 *   fija al final de cada variante.
 * - `REGENERATE_HEADLINE`: 3 títulos alternativos sin modificar el
 *   `primaryText` ni la dirección fija original.
 *
 * Visión creativa (v2): las propuestas deben sonar como una estilista
 * imaginando el resultado junto a la clienta (no como un anuncio). El
 * `primaryText` arranca con un relato aspiracional/humano de 2-4 frases y
 * luego suma personalización opcional, bloque de precio opcional,
 * bullets con beneficios y un CTA amable. La marca "Blondor" SOLO puede
 * aparecer en los hashtags (al menos `#Blondor` o `#BlondorPeluquería`)
 * y en la línea de ubicación 📍. Nunca en el relato, ni en los bullets,
 * ni en el CTA, ni en el `headline`.
 *
 * Convenciones del `primaryText` (también aplicadas en `REGENERATE_PRIMARY_TEXT`):
 *
 * - Bloque 1: relato aspiracional (2-4 frases) sin nombrar la marca.
 * - Bloque 2 (opcional): personalización cálida adaptada a ella.
 * - Bloque 3 (opcional): precio SOLO si `service.price` positivo,
 *   formato CLP precedido de "desde" y línea literal de evaluación.
 * - Bloque 4: 3-5 bullets "- 🤍 ..." breves, sin repetir el relato.
 * - Bloque 5: CTA amable con ✨ o 📩 ("contáctanos" o "te esperamos",
 *   nunca "reserva" agresivo).
 * - Bloque 6: UNA línea de 8-12 hashtags separados por un solo espacio,
 *   incluyendo `#Blondor` o `#BlondorPeluquería`.
 * - Bloque 7: dirección fija literal en dos líneas:
 *     📍 <addressLine>, <neighborhood> · <city>
 *     Atención exclusiva con agenda previa.
 * - Bloque 8: NADA. El `primaryText` TERMINA EXACTAMENTE en la línea
 *   "Atención exclusiva con agenda previa.". Está ESTRICTAMENTE
 *   PROHIBIDO agregar párrafos sueltos, frases de cierre adicionales o
 *   texto complementario después de esa línea.
 *
 * Reglas dinámicas del `BusinessProfile` (inyectadas en `SYSTEM_INSTRUCTIONS`
 * solo si el perfil aporta restricciones):
 *   - `preferredEmojiSemantics`: limita los emojis semánticos permitidos.
 *   - `wordsToAvoid`: prohibiciones de vocabulario.
 *   - `addressLine/neighborhood/city`: dirección exacta del bloque 7.
 *
 * Si el perfil está vacío o no se aporta, el `SYSTEM_INSTRUCTIONS` se
 * mantiene determinista con los valores por defecto del MVP (Blondor).
 *
 * Compatibilidad con snapshots legacy (antes del corte territorial
 * SUBDERE 2018): si el snapshot aún trae `city/country`, los usamos como
 * fallback. El `getDisplayLocation()` del service es la fuente preferente
 * cuando está disponible.
 */

export const BUSINESS_LOCATION_NOTE =
  '📍 Las Condes · Centro Comercial Omnium\nAtención exclusiva con agenda previa.';

export const DEFAULT_EMOJI_SEMANTICS = ['✨', '🤍', '📍'] as const;
export const DEFAULT_PROHIBITED_EMOJIS = [
  '🌸',
  '💕',
  '🤗',
  '🙂',
  '😊',
  '🥰',
  '🎁',
  '🎉',
  '💖',
  '💗',
  '💜',
  '💛',
  '🌟',
  '⭐',
] as const;

/**
 * Construye la línea de dirección fija (`📍 …`) a partir del perfil, con
 * fallback hardcoded cuando el perfil está vacío. Se usa tanto en el
 * `userPrompt` (`businessLocationNote`) como en el bloque 7 del
 * `SYSTEM_INSTRUCTIONS` para mantener ambos sincronizados.
 *
 * Prioriza la nueva información territorial (`regionName`/`communeName`/
 * `regionCutCode`/`communeCutCode`) y cae al fallback legacy `city`/
 * `country` si los nuevos campos no están disponibles. Esto permite que
 * snapshots pre-territorio sigan funcionando idénticamente.
 */
export function buildBusinessLocationLine(profile: BusinessProfileSnapshot | undefined): string {
  const parts: string[] = [];
  const communeName =
    profile?.communeName ??
    (profile?.communeCutCode
      ? lookupCommuneName(profile.communeCutCode)
      : null);
  const regionName =
    profile?.regionName ??
    (profile?.regionCutCode ? lookupRegionName(profile.regionCutCode) : null);
  const addressParts: string[] = [];
  if (profile?.addressLine) addressParts.push(profile.addressLine);
  if (profile?.neighborhood) addressParts.push(profile.neighborhood);
  const legacyCity = profile?.city ?? null;
  const legacyCountry = profile?.country ?? null;

  if (addressParts.length > 0) {
    parts.push(addressParts.join(', '));
    if (communeName) {
      parts.push(communeName);
    } else if (legacyCity) {
      parts.push(legacyCity);
    }
    if (regionName) {
      parts.push(regionName);
    } else if (legacyCountry) {
      parts.push(legacyCountry);
    }
    return `📍 ${parts.join(' · ')}`;
  }
  return '📍 Las Condes · Centro Comercial Omnium';
}

// === Helpers de resolución de nombres SUBDERE 2018 (snapshot only) =========
// Estos helpers son opacos y opcionales: si el snapshot ya trae los nombres
// resueltos por el backend, se usan directamente. Si sólo trae los CUTs, los
// resolvemos aquí mismo. Como el catálogo territorial es estático y pequeño
// (16 regiones, 346 comunas), lo más simple y determinista es importarlo
// directamente.

function lookupRegionName(cutCode: string): string | null {
  try {
    const region = findRegion(cutCode);
    return region?.name ?? null;
  } catch {
    return null;
  }
}

function lookupCommuneName(cutCode: string): string | null {
  try {
    const commune = findCommune(cutCode);
    return commune?.name ?? null;
  } catch {
    return null;
  }
}

function resolveEmojiSemantics(profile: BusinessProfileSnapshot | undefined): string[] {
  if (profile?.preferredEmojiSemantics && profile.preferredEmojiSemantics.length > 0) {
    return profile.preferredEmojiSemantics;
  }
  return [...DEFAULT_EMOJI_SEMANTICS];
}

/**
 * Construye el bloque de "Reglas dinámicas" que se añade al final del
 * `SYSTEM_INSTRUCTIONS` cuando el perfil aporta restricciones. Si no hay
 * restricciones, devuelve `null` y el prompt se mantiene idéntico al
 * estático (cero impacto sobre los consumidores existentes).
 */
function buildDynamicRules(profile: BusinessProfileSnapshot | undefined): string | null {
  if (!profile) return null;
  const rules: string[] = [];
  const semantics = resolveEmojiSemantics(profile);
  if (profile.preferredEmojiSemantics && profile.preferredEmojiSemantics.length > 0) {
    rules.push(
      `- Iconografía del negocio: SOLO emojis semánticos ${semantics.join(' ')}. PROHIBIDO cualquier otro emoji decorativo o de cara/corazón/regalo.`,
    );
  }
  if (profile.wordsToAvoid && profile.wordsToAvoid.length > 0) {
    const list = profile.wordsToAvoid.map((w) => `"${w}"`).join(', ');
    rules.push(
      `- Vocabulario prohibido por el negocio: NO uses estas palabras en ningún bloque del \`primaryText\` ni en el \`headline\`: ${list}.`,
    );
  }
  if (profile.addressLine || profile.neighborhood) {
    rules.push(
      `- Dirección fija del negocio (proporcionada por el perfil): la línea de bloque 7 debe ser EXACTAMENTE esta: "${buildBusinessLocationLine(profile)}" seguida de "Atención exclusiva con agenda previa.".`,
    );
  }
  return rules.length > 0 ? rules.join('\n') : null;
}

const BASE_SYSTEM_INSTRUCTIONS = `Eres una estilista experimentada que imagina junto a cada clienta el resultado que logrará con el servicio. Tu voz NO es la de un anuncio: es la de una conversación cercana, entre amigas, como si estuvieras asesorándola por WhatsApp mientras le describes cómo se va a ver y cómo se va a sentir con el cambio.

Tono y contexto:
- Idioma: español chileno.
- Estilo: conversacional, cálido, persuasivo sin ser vendedor. Hablas de tú. Nada de tecnicismos: "mechas", "iluminación", "color", "balayage", "visos" es OK; "decoloración controlada con oxidante 20vol" NO.
- Personalización SIEMPRE: cada propuesta debe recalcar que el servicio es 100% personalizado (consulta previa, evaluación del cabello, diseño a medida). Puedes mencionarlo en el relato aspiracional o en una frase cálida de personalización.
- Imaginación: desarrolla el resultado en el primaryText usando fórmulas como "Imagina salir con un cabello que…", "Te imaginas verte con…", "Ese color que llevas tiempo queriendo probar…". El relato es lo primero y debe sonar a conversación, no a eslogan publicitario.
- Iconografía: SOLO emojis con función semántica ✨ 🤍 📍 (y 📩 opcional en CTA). PROHIBIDO 🌸 💕 🤗 🙂 😊 🥰 🎁 🎉 💖 💗 💜 💛 🌟 ⭐.
- Dirección: SIEMPRE cierra con la dirección fija provista en el user prompt (ver bloque "Dirección fija del negocio"). No inventar otra dirección.
- Precio: SOLO si el servicio tiene precio. Formato CLP con separador de miles con punto, sin decimales, y PRECEDIDO de la palabra "desde" (ej: "Desde $55.000"). Línea siguiente EXACTA: "Valor sujeto a evaluación según largo, cantidad y técnica.".
- Hashtags: 8 a 12 etiquetas en una sola línea, separadas por un solo espacio. DEBE aparecer al menos \`#Blondor\` o \`#BlondorPeluquería\`.

Reglas estrictas — REGLA CRÍTICA DE MARCA:
- PROHIBIDO nombrar la marca "Blondor", "Blondor Peluquería" o cualquier variante en el \`primaryText\` (relato, personalización, precio, bullets, CTA) ni en el \`headline\`.
- La marca SOLO puede aparecer en estos dos lugares del \`primaryText\`:
  a) El bloque de hashtags (al menos \`#Blondor\` o \`#BlondorPeluquería\`).
  b) La línea de ubicación \`📍 Las Condes · Centro Comercial Omnium\` (entregada literal, no la redactas tú).
- En el relato, en la personalización, en los bullets, en el CTA y en el \`headline\` puedes referirte al servicio por su nombre genérico (balayage, visos, corte, color, iluminación, mechas, etc.) sin problema, pero NUNCA al negocio.
- El \`headline\` debe ser corto, SIN emojis, SIN nombrar la marca. Máximo 8 palabras (≤ ${HEADLINE_MAX} caracteres). Ejemplos válidos: "Imagina tu color soñado", "Tu próximo balayage empieza aquí", "Ese cambio que llevas buscando", "El cabello que llevas imaginando".

Estructura OBLIGATORIA del \`primaryText\` en este orden y SIN texto suelto entre los bloques:
1) Relato aspiracional/humano (2 a 4 frases): imagina el resultado junto a la clienta. NO nombrar la marca. Puedes usar "Imagina…", "Te imaginas verte con…", "Ese color que llevas tiempo queriendo probar…".
2) (Opcional) Personalización: una frase cálida que recalque que es adaptado a ella (ej: "Lo evaluamos contigo para que sea 100% a tu medida.").
3) Bloque de precio SOLO si hay \`service.price\` (si no, omitir TODO el bloque, incluida la línea de evaluación):
   Desde $X.XXX
   Valor sujeto a evaluación según largo, cantidad y técnica.
4) Lista corta de 3 a 5 bullets empezando con 🤍 (formato "- 🤍 ..."). Cada bullet breve, sin repetir lo del relato.
5) CTA amable, idealmente con ✨ o 📩 (ej: "✨ Contáctanos por WhatsApp y te asesoramos."). Sin "reserva" agresivo: prefiere "contáctanos" o "te esperamos".
6) Línea ÚNICA de hashtags en una sola línea, 8–12 separados por un solo espacio. Incluir \`#Blondor\` o \`#BlondorPeluquería\` al menos una vez.
7) Línea de la dirección fija, copiada EXACTA en dos líneas literales:
   📍 Las Condes · Centro Comercial Omnium
   Atención exclusiva con agenda previa.
8) NADA después de la dirección — el primaryText TERMINA ahí. Está ESTRICTAMENTE PROHIBIDO agregar párrafos sueltos, frases de cierre adicionales o texto complementario después de "Atención exclusiva con agenda previa.".

Otras reglas:
1. REGLA CRÍTICA #1: El campo "headline" es OBLIGATORIO. SIEMPRE debes entregar UN titular corto (1 frase, ≤ 8 palabras, ≤ ${HEADLINE_MAX} caracteres), sin emojis, sin comillas, sin punto final, sin línea vacía, SIN mencionar el nombre del negocio. Ningún headline puede quedar en blanco o como string vacío "".
2. "primaryText" 1..${PRIMARY_TEXT_MAX} caracteres.
3. Estructura OBLIGATORIA del primaryText en orden y SIN texto suelto entre los hashtags y la dirección (ver bloque 1-8 arriba).
4. Devuelve EXACTAMENTE ${SUGGESTIONS_LENGTH} sugerencias en "suggestions" (ni 2 ni 4), cada una apuntando a un ángulo distinto entre: resultado (la transformación visible que la clienta imagina), problema (dolor o necesidad real) o invitación (llamado a la acción amable, ej: "te regalamos una evaluación", "contáctanos por WhatsApp").
5. "headline" 1..${HEADLINE_MAX} caracteres, MUY corto y resumido (≤ 8 palabras ideal), SIN emojis, SIN nombrar la marca.
6. NO mayúsculas sostenidas, NO spam, NO "!!!", todo en tono natural.
7. NO inventar datos: usar solo lo entregado en el prompt. Si el servicio no tiene precio, omitir bloque de precio por completo (no mostrar $0).
8. NO inventar dirección: usar exactamente la "Dirección fija del negocio" provista.
9. NO inventar promociones, descuentos ni disponibilidad.
10. NO emojis decorativos. Solo ✨ 🤍 📍 📩 permitidos.
11. SIEMPRE recalcar que el servicio es personalizado: al menos una mención explícita en el primaryText (ej: "evaluación personalizada", "diseñado para ti", "adaptado a tu cabello").

Modos:
- INITIAL: 3 propuestas completas (cada una con primaryText y headline). Tres ángulos distintos (resultado/problema/invitación) y tres sets distintos de hashtags (mismo conjunto base, distinto orden). El primaryText SIEMPRE termina con la dirección fija del negocio. NI el primaryText NI el headline pueden mencionar la marca.
- REGENERATE_PRIMARY_TEXT: 3 variantes SOLO de "primaryText", manteniendo exactamente el headline del currentCopy. Cada variante DEBE terminar con la dirección fija del negocio en dos líneas literales ("📍 Las Condes · Centro Comercial Omnium" y "Atención exclusiva con agenda previa."). Cada variante con su propio set de hashtags, las reglas de estructura, y los 3 ángulos. NO nombrar la marca en el primaryText regenerado.
- REGENERATE_HEADLINE: 3 títulos alternativos SIN emojis, máximo ${HEADLINE_MAX} caracteres, SIN mencionar la marca, SIN cambiar el primaryText existente. NO agregues ni quites la dirección fija: el primaryText se mantiene tal cual.

JSON de salida:
{
  "suggestions": [
    {
      "primaryText": string (1..${PRIMARY_TEXT_MAX}),
      "headline": string (1..${HEADLINE_MAX})
    }
  ]
}
IMPORTANTE: NINGÚN "headline" puede quedar como "", null ni faltar. Cada uno de los 3 "headline" debe ser una cadena no vacía que NO mencione el nombre del negocio (Blondor / Blondor Peluquería).
`;

export function buildSystemInstructions(
  profile: BusinessProfileSnapshot | undefined,
): string {
  const dynamicRules = buildDynamicRules(profile);
  if (!dynamicRules) {
    return BASE_SYSTEM_INSTRUCTIONS;
  }
  return `${BASE_SYSTEM_INSTRUCTIONS}\n\nReglas dinámicas del BusinessProfile del negocio (sobre-escriben o complementan las anteriores, sin perder la estructura fija):\n${dynamicRules}\n`;
}

const formatPrice = (price: number | null): string => {
  if (price === null || !Number.isFinite(price) || price <= 0) {
    return 'Sin precio referencial — omitir bloque de precio';
  }
  const formatted = Math.round(price)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `desde $${formatted}`;
};

const formatServiceLine = (name: string, description: string | null): string => {
  const trimmed = description?.trim() ?? '';
  return trimmed.length > 0 ? `Servicio: ${name} (${trimmed})` : `Servicio: ${name}`;
};

const formatBusinessLine = (name: string, description: string | null | undefined): string => {
  const trimmed = description?.trim() ?? '';
  return trimmed.length > 0 ? `Negocio: ${name} (${trimmed})` : `Negocio: ${name}`;
};

const describeCurrentCopy = (payload: RecommendationPayload): string => {
  if (payload.mode === 'INITIAL') {
    return '- (no aplica en modo INITIAL: la copia actual solo se referencia en modos REGENERATE)';
  }
  const copy = payload.currentCopy;
  const lines: string[] = [];
  if (copy.primaryText && copy.primaryText.trim().length > 0) {
    lines.push(`- Texto principal actual: "${copy.primaryText.trim()}"`);
  }
  if (copy.headline && copy.headline.trim().length > 0) {
    lines.push(`- Titular actual: "${copy.headline.trim()}"`);
  }
  return lines.length > 0 ? lines.join('\n') : '- (no hay copia previa)';
};

export interface RecommendationPromptMessages {
  systemPrompt: string;
  userPrompt: string;
}

const initialInstructions = (): string[] => [
  'Para cada sugerencia entrega "primaryText" Y "headline". El "headline" debe',
  'ser una frase corta (≤ 8 palabras, sin emojis, sin punto final, SIN',
  'mencionar el nombre del negocio).',
  'Cada sugerencia con un ángulo distinto (resultado, problema, invitación)',
  'y su propio set de hashtags (no repitas los 10 mismos en las 3).',
  'La dirección fija del negocio va al final del primaryText. El "primaryText"',
  'SIEMPRE termina en la línea "Atención exclusiva con agenda previa."',
  'PROHIBIDO nombrar el negocio ("Blondor", "Blondor Peluquería") en el',
  '"primaryText" o en el "headline": la marca SOLO puede aparecer en el',
  'bloque de hashtags (al menos #Blondor o #BlondorPeluquería) y en la',
  'línea de ubicación 📍. Cada uno de los 3 "headline" debe ser una cadena',
  'NO VACÍA. Confirma que ninguno quedó en blanco antes de cerrar el JSON.',
];

const regeneratePrimaryTextInstructions = (): string[] => [
  'Mantén exactamente el mismo "headline" provisto en la copia actual y',
  'entrega 3 variantes distintas de "primaryText", cada una con un ángulo',
  'diferente (resultado, problema, invitación).',
  '',
  'IMPORTANTE: cada variante de "primaryText" debe terminar EXACTAMENTE',
  'igual que en INITIAL: la dirección fija del negocio SIEMPRE va al final,',
  'copiada LITERAL, en sus propias líneas:',
  '"📍 Las Condes · Centro Comercial Omnium"',
  '"Atención exclusiva con agenda previa."',
  'Las dos líneas son obligatorias en cada una de las 3 variantes. Sin la',
  'dirección fija, la variante NO es válida y debes regenerarla.',
  '',
  'PROHIBIDO nombrar el negocio ("Blondor", "Blondor Peluquería") en el',
  '"primaryText" regenerado. La marca SOLO puede aparecer en el bloque de',
  'hashtags (al menos #Blondor o #BlondorPeluquería) y en la línea de',
  'ubicación 📍. Mantén el tono de una estilista imaginando el resultado',
  'junto a la clienta: nada de eslogan publicitario.',
];

const regenerateHeadlineInstructions = (): string[] => [
  'Mantén el mismo "primaryText" provisto en la copia actual (incluyendo',
  'la dirección fija del negocio que ya contiene) y entrega 3 variantes',
  'distintas de "headline", cada una con un ángulo diferente',
  '(resultado, problema, invitación).',
  'NO agregues ni quites hashtags ni la dirección: solo se regenera el headline.',
  'PROHIBIDO nombrar el negocio ("Blondor", "Blondor Peluquería") en el',
  '"headline". Cada "headline" debe ser una sola frase, sin emojis, sin',
  'comillas, sin punto final, sin línea vacía.',
];

export function buildRecommendationPrompt(
  payload: RecommendationPayload,
): RecommendationPromptMessages {
  const profile = payload.businessProfile;
  const lines: string[] = [];
  lines.push('Genera recomendaciones de copy para el siguiente anuncio de peluquería.');
  lines.push('');
  lines.push(formatServiceLine(payload.service.name, payload.service.description));
  lines.push(`Precio referencial en CLP: ${formatPrice(payload.service.price)}`);
  lines.push(formatBusinessLine(payload.business.name, payload.business.description));
  lines.push(`Imagen seleccionada: ${payload.mediaAsset.mimeType} (tipo genérico)`);
  lines.push(`Modo actual: ${payload.mode}`);
  lines.push('');
  if (profile && profile.brandVoiceKeywords && profile.brandVoiceKeywords.length > 0) {
    lines.push('Voz de marca del negocio (úsala como guía de tono y personalidad):');
    for (const keyword of profile.brandVoiceKeywords) {
      lines.push(`- ${keyword}`);
    }
    lines.push('');
  }
  if (profile && profile.primaryCustomerProfile && profile.primaryCustomerProfile.trim().length > 0) {
    lines.push('Cliente ideal del negocio (a quién le hablamos):');
    lines.push(profile.primaryCustomerProfile.trim());
    lines.push('');
  }
  if (payload.briefContext && payload.briefContext.businessObjective) {
    lines.push(
      'Estrategia del plan (la usuaria aprobó esta meta comercial en su diagnóstico, respétala):',
    );
    if (payload.briefContext.businessObjective) {
      lines.push(`- Objetivo comercial: ${payload.briefContext.businessObjective}`);
    }
    if (payload.briefContext.primaryGoal) {
      lines.push(`- Meta principal: ${payload.briefContext.primaryGoal}`);
    }
    if (payload.briefContext.primaryConversion) {
      lines.push(`- Conversión esperada: ${payload.briefContext.primaryConversion}`);
    }
    if (
      payload.briefContext.recommendedWeeklyAdd !== undefined &&
      payload.briefContext.recommendedWeeklyAdd !== null
    ) {
      lines.push(
        `- Meta semanal sugerida: ${payload.briefContext.recommendedWeeklyAdd} reservas/semana adicionales`,
      );
    }
    if (payload.briefContext.offer) {
      lines.push(`- Oferta propuesta: ${payload.briefContext.offer}`);
    }
    if (payload.briefContext.primaryKpi) {
      lines.push(`- KPI principal: ${payload.briefContext.primaryKpi}`);
    }
    if (payload.briefContext.stopIf) {
      lines.push(`- Detener si: ${payload.briefContext.stopIf}`);
    }
    if (payload.briefContext.scaleIf) {
      lines.push(`- Aumentar inversión si: ${payload.briefContext.scaleIf}`);
    }
    lines.push('');
  }
  if (profile && profile.commonObjections && profile.commonObjections.length > 0) {
    lines.push('Objeciones reales que podemos mencionar o anticipar en el copy:');
    for (const objection of profile.commonObjections) {
      lines.push(`- ${objection}`);
    }
    lines.push('');
  }
  lines.push('Dirección fija del negocio (úsala EXACTA en cada sugerencia, dos líneas, sin modificarla):');
  lines.push(payload.businessLocationNote);
  lines.push('');
  if (payload.mode !== 'INITIAL') {
    lines.push('Copia actual entregada por el operador (referencia a mejorar):');
    lines.push(describeCurrentCopy(payload));
    lines.push('');
  }
  if (payload.context?.campaignNotes && payload.context.campaignNotes.trim().length > 0) {
    lines.push(`Notas de campaña del operador: "${payload.context.campaignNotes.trim()}"`);
    lines.push('');
  }
  lines.push(
    'Indicaciones: cada propuesta debe sonar como una estilista imaginando el resultado junto a la clienta, NO como un anuncio. PROHIBIDO nombrar el negocio ("Blondor", "Blondor Peluquería") en el "primaryText" o en el "headline": la marca SOLO puede aparecer en el bloque de hashtags (al menos #Blondor o #BlondorPeluquería) y en la línea de ubicación 📍. Además, cada propuesta debe recalcar que el servicio es 100% personalizado y debe cerrar con la dirección fija del negocio. El "primaryText" SIEMPRE termina en la línea "Atención exclusiva con agenda previa." y no debe contener párrafos sueltos después.',
  );
  lines.push('');
  lines.push('Instrucciones específicas del modo:');
  const modeInstructions =
    payload.mode === 'INITIAL'
      ? initialInstructions()
      : payload.mode === 'REGENERATE_PRIMARY_TEXT'
        ? regeneratePrimaryTextInstructions()
        : regenerateHeadlineInstructions();
  for (const instruction of modeInstructions) {
    lines.push(`- ${instruction}`);
  }
  lines.push('');
  lines.push(
    'Recuerda: los 3 "headline" deben ser cadenas NO VACÍAS y NO pueden mencionar el nombre del negocio. Si dudas, escríbelo mejor.',
  );
  lines.push(
    'Devuelve SOLO el JSON con la estructura indicada. No agregues texto antes ni después. Cumple todas las reglas del system prompt.',
  );

  return {
    systemPrompt: buildSystemInstructions(profile),
    userPrompt: lines.join('\n'),
  };
}
