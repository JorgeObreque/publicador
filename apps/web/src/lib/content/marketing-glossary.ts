export type GlossaryCategory = 'perfil' | 'campaign' | 'metric' | 'meta-status' | 'ai';

export interface GlossaryEntry {
  everydayLabel: string;
  technicalTerm?: string;
  short: string;
  example?: string;
  warning?: string;
  formula?: string;
  category?: GlossaryCategory;
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  brief: {
    everydayLabel: 'Plan inicial de campaña',
    technicalTerm: 'Brief',
    short:
      'Documento donde defines qué servicio ofreces, a quién le hablas y qué quieres lograr antes de crear un anuncio.',
    example:
      'Tu brief puede decir: "Balayage para mujeres de 25 a 45 años en Santiago, objetivo: conseguir citas por WhatsApp esta semana".',
    category: 'campaign',
  },
  kpi: {
    everydayLabel: 'Cómo sabremos si funciona',
    technicalTerm: 'Indicador clave de rendimiento (KPI) principal',
    short:
      'La cifra concreta que te dice si la campaña está cumpliendo el objetivo (citas, mensajes, reservas o ventas).',
    example:
      'Si tu objetivo es conseguir citas, tu KPI principal es la cantidad de citas con código de seguimiento recibidas.',
    category: 'campaign',
  },
  cpa: {
    everydayLabel: 'Costo por cada reserva o venta efectiva',
    technicalTerm: 'Costo por adquisición (CPA)',
    short:
      'Cuánto te cuesta en promedio cada reserva o venta confirmada atribuida a la campaña.',
    formula:
      'Costo por adquisición (CPA) = gasto total de la campaña / cantidad de reservas o ventas efectivas',
    example:
      'Si una campaña gastó $60.000 y produjo 12 reservas, el costo por adquisición es $5.000 por reserva.',
    category: 'metric',
  },
  cpl: {
    everydayLabel: 'Costo por cada mensaje recibido',
    technicalTerm: 'Costo por lead (CPL)',
    short:
      'Cuánto cuesta conseguir una persona que escribió a tu WhatsApp, sin ser cumplida.',
    formula:
      'Costo por lead (CPL) = gasto total / cantidad de mensajes recibidos con código de seguimiento',
    example:
      'Si gastaste $40.000 y llegaron 8 mensajes, el CPL es $5.000 por cada mensaje recibido.',
    category: 'metric',
  },
  ctr: {
    everydayLabel: 'Porcentaje de personas que hicieron clic',
    technicalTerm: 'Tasa de clics (CTR)',
    short:
      'De cada 100 personas que vieron el anuncio, cuántas hicieron clic en el botón de WhatsApp.',
    formula:
      'Tasa de clics (CTR) = clics en el botón / impresiones del anuncio × 100',
    warning:
      'Meta reporta el CTR como agregado del anuncio; no distingue si el clic vino de una persona realmente interesada.',
    category: 'metric',
  },
  cpc: {
    everydayLabel: 'Costo promedio por cada clic',
    technicalTerm: 'Costo por clic (CPC)',
    short:
      'Cuánto pagas en promedio cada vez que alguien hace clic en el botón del anuncio.',
    formula: 'Costo por clic (CPC) = gasto total de la campaña / cantidad total de clics',
    warning:
      'Meta calcula el CPC con datos agregados y puede incluir clics que nunca se traducen en una conversación de WhatsApp.',
    category: 'metric',
  },
  conversionRate: {
    everydayLabel: 'Porcentaje de personas que escribieron al WhatsApp',
    technicalTerm: 'Tasa de conversión',
    short:
      'De cada 100 personas que hicieron clic en el anuncio, cuántas terminaron escribiendo un mensaje en tu WhatsApp.',
    formula: 'Tasa de conversión = mensajes recibidos / clics en el botón × 100',
    warning:
      'La atribución es aproximada: Meta puede atribuirte mensajes que llegaron por otro canal o perderte mensajes reales.',
    category: 'metric',
  },
  impressions: {
    everydayLabel: 'Veces que Meta mostró el anuncio',
    technicalTerm: 'Impresiones',
    short:
      'Cada vez que el anuncio apareció en la pantalla de alguien, sin importar si lo miró o no.',
    example:
      'Si tu anuncio salió 1.000 veces significa que Meta lo puso en pantalla 1.000 veces, no que 1.000 personas distintas lo hayan visto.',
    warning:
      'Una misma persona puede acumular decenas de impresiones en un día si sigue navegando en sus redes.',
    category: 'metric',
  },
  results: {
    everydayLabel: 'Eventos que Meta considera resultados',
    technicalTerm: 'Resultados',
    short:
      'Clics, mensajes u otras acciones que Meta cuenta como "resultado" según el objetivo de tu campaña.',
    warning:
      'Meta no garantiza que cada resultado sea un contacto realmente interesado o una venta concreta.',
    category: 'metric',
  },
  attribution: {
    everydayLabel: 'Relación estimada entre una campaña y una cita',
    technicalTerm: 'Atribución',
    short:
      'Manera en que el sistema vincula una cita recibida con la campaña que la trajo, usando el código de seguimiento del WhatsApp.',
    warning:
      'La atribución es una relación estadística, no causalidad: no podemos asegurar al 100% que la cita vino por ese anuncio.',
    category: 'metric',
  },
  funnel: {
    everydayLabel: 'Recorrido desde que ven el anuncio hasta que contactan',
    technicalTerm: 'Embudo de conversión',
    short:
      'Camino que sigue una persona: ve el anuncio, hace clic, llega a tu WhatsApp, escribe y finalmente agenda.',
    example:
      'Embudo típico: 1.000 impresiones → 50 clics → 20 mensajes → 8 citas agendadas.',
    category: 'campaign',
  },
  target: {
    everydayLabel: 'Segmentación de audiencia',
    technicalTerm: 'Público objetivo',
    short:
      'Grupo de personas a las que Meta mostrará tu anuncio según edad, ubicación, intereses y comportamientos.',
    example:
      'Puedes elegir "mujeres de 25 a 45 años en Santiago que siguen cuentas de peluquerías y salones de belleza".',
    category: 'campaign',
  },
  variant: {
    everydayLabel: 'Variante de anuncio',
    technicalTerm: 'Variante creativa',
    short:
      'Cada versión distinta de tu anuncio (por ejemplo, una con foto y otra con video) que Meta prueba para ver cuál funciona mejor.',
    example:
      'Si tienes dos variantes, Meta reparte el presupuesto y muestra cuál consigue más citas.',
    category: 'campaign',
  },
  dailyBudget: {
    everydayLabel: 'Promedio diario',
    technicalTerm: 'Presupuesto diario',
    short:
      'Cantidad máxima que Meta puede gastar por día en tu campaña. En la práctica puede variar levemente día a día.',
    example:
      'Si defines USD 10 diarios, Meta gastará alrededor de USD 10 cada día, ajustando según oportunidades.',
    category: 'campaign',
  },
  lifetimeBudget: {
    everydayLabel: 'Presupuesto total',
    technicalTerm: 'Presupuesto de por vida',
    short:
      'Cantidad total que Meta puede gastar durante toda la vida de la campaña, sin importar cuánto dure.',
    example:
      'Si defines USD 300 de por vida y la campaña dura 30 días, Meta reparte ese total como le convenga.',
    category: 'campaign',
  },
  acquisition: {
    everydayLabel: 'Nuevo contacto o cliente',
    technicalTerm: 'Adquisición',
    short:
      'Una persona que llegó a tu WhatsApp y completó la pregunta de calificación, aunque todavía no haya reservado.',
    example:
      'Una adquisición es alguien que escribió, respondió tu pregunta de calificación y pasó el filtro mínimo.',
    category: 'campaign',
  },
  qualifyingQuestion: {
    everydayLabel: 'Pregunta para saber si el contacto es real',
    technicalTerm: 'Pregunta de calificación',
    short:
      'Pregunta que envías después del primer mensaje para confirmar que el contacto es una persona realmente interesada.',
    example:
      '"¿Buscas hacerte el balayage esta semana o más adelante?" ayuda a distinguir curiosidad real de un clic perdido.',
    category: 'campaign',
  },
  brandVoice: {
    everydayLabel: 'Forma en que tu marca habla y escribe',
    technicalTerm: 'Voz de marca',
    short:
      'Tono y estilo que usan tus anuncios y mensajes: cercana, formal, juvenil, técnica, etc.',
    example:
      'Un salón de barrio puede usar voz cercana y cálida, mientras que una clínica premium prefiere voz profesional y sobria.',
    category: 'perfil',
  },
  tagline: {
    everydayLabel: 'Frase corta que identifica al negocio',
    technicalTerm: 'Tagline',
    short:
      'Una frase memorable que resume qué haces y para quién, y que se repite en tus anuncios.',
    example:
      '"Balayage natural en 2 horas" es un tagline que comunica servicio, técnica y tiempo.',
    category: 'perfil',
  },
  idealCustomer: {
    everydayLabel: 'Cliente ideal',
    technicalTerm: 'Perfil de cliente ideal (ICP)',
    short:
      'Descripción concreta de la persona a la que le sirve perfecto tu servicio y que más probablemente va a comprar.',
    example:
      '"Mujer de 30 a 40 años, profesional, vive en Santiago y se hace mechas dos veces al año" es un perfil concreto.',
    category: 'perfil',
  },
  aiConfidence: {
    everydayLabel: 'Qué tan confiable es la sugerencia de la IA',
    technicalTerm: 'Nivel de confianza',
    short:
      'Indicador de Baja, Media o Alta que muestra cuán segura está la IA de que su propuesta es buena para tu negocio.',
    example:
      'Confianza Alta significa que la IA encontró mucha información consistente; Baja significa que se basó en suposiciones.',
    warning:
      'La confianza mide consistencia de los datos, no garantiza que la sugerencia sea correcta para tu negocio específico.',
    category: 'ai',
  },
  aiTokens: {
    everydayLabel: 'Créditos de uso de la IA',
    technicalTerm: 'Tokens consumidos',
    short:
      'Unidad que mide cuánto uso de IA hiciste: cada sugerencia consume tokens del plan que tengas contratado.',
    example:
      'Generar 3 propuestas puede consumir alrededor de 5.000 tokens, dependiendo del tamaño del texto que se analiza.',
    category: 'ai',
  },
  pausedPublication: {
    everydayLabel: 'La campaña aún no está gastando',
    technicalTerm: 'Publicación pausada',
    short:
      'Cuando envías la campaña a Meta, queda pausada: no muestra anuncios ni gasta dinero hasta que la operadora la active.',
    example:
      'Esto te permite revisar todo y recién después empezar a gastar cuando estés segura de que está lista.',
    category: 'meta-status',
  },
  trackingCode: {
    everydayLabel: 'Código de seguimiento que se añade al WhatsApp',
    technicalTerm: 'Código de atribución',
    short:
      'Texto corto (ej: ABC123) que se agrega al link de WhatsApp para saber qué campaña trajo cada mensaje.',
    example:
      'Cuando alguien hace clic, llega a tu WhatsApp con el mensaje "Hola, vengo del anuncio ABC123".',
    category: 'campaign',
  },
};
