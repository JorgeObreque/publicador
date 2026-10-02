import { buildDiagnosisPrompt, buildAdjustmentPrompt } from './commercial-diagnosis.prompt';
import { buildDiagnosisPayload } from './commercial-diagnosis.types';
import type {
  DiagnosisContext,
  DiagnosisPayload,
  DiagnosticConversationEntry,
} from './commercial-diagnosis.types';

const baseContext = (overrides: Partial<DiagnosisContext> = {}): DiagnosisContext => ({
  profileReady: true,
  primaryCustomerProfile: 'Mujeres 30-45 que buscan balayage natural',
  brandVoiceKeywords: ['profesional', 'cercana'],
  wordsToAvoid: ['barato'],
  qualifyingQuestions: ['¿Cabello tinturado?'],
  weeklyServiceCapacity: 10,
  monthlyAcquisitionGoal: 20,
  costPerAcquisitionCap: 5000,
  displayLocation: 'Las Condes, Región Metropolitana de Santiago',
  communeName: 'Las Condes',
  regionName: 'Región Metropolitana de Santiago',
  income: 1_500_000,
  population: 280_000,
  profileDescription: 'Comuna de ingresos altos',
  evidenceMode: 'NO_EVIDENCE',
  primaryServicePrice: 95_500,
  services: [
    {
      id: 'svc-balayage',
      name: 'Balayage personalizado',
      description: 'Diagnóstico + aplicación + sellado.',
      price: 95_500,
      currency: 'CLP',
      duration: 120,
    },
  ],
  ...overrides,
});

describe('buildDiagnosisPrompt', () => {
  it('incluye el nombre comercial del servicio y el bloque de situación declarada', () => {
    const payload: DiagnosisPayload = buildDiagnosisPayload({
      context: baseContext(),
      currentSituation:
        'Tengo clientas principalmente jueves a domingo; lunes a miércoles tengo bastante disponibilidad.',
      serviceId: 'svc-balayage',
    });

    const { systemPrompt, userPrompt } = buildDiagnosisPrompt(payload);

    expect(systemPrompt).toContain('PROHIBIDO usar el nombre del negocio');
    expect(systemPrompt).toContain('decision');
    expect(userPrompt).toContain('=== SITUACIÓN DECLARADA POR LA OPERADORA ===');
    expect(userPrompt).toContain(
      'Tengo clientas principalmente jueves a domingo; lunes a miércoles tengo bastante disponibilidad.',
    );
    expect(userPrompt).toContain('Balayage personalizado');
    expect(userPrompt).toContain('Diagnóstico + aplicación + sellado.');
    expect(userPrompt).toContain('=== UBICACIÓN Y TERRITORIO ===');
    expect(userPrompt).toContain('Las Condes, Región Metropolitana de Santiago');
    expect(userPrompt).toContain('comuna Las Condes');
    expect(userPrompt).toContain('región Región Metropolitana de Santiago');
    expect(userPrompt).toContain('280.000 habitantes');
    expect(userPrompt).toContain('$1.500.000 CLP');
  });

  it('incluye weeklyServiceCapacity cuando está presente en el perfil', () => {
    const payload = buildDiagnosisPayload({
      context: baseContext({ weeklyServiceCapacity: 12 }),
      currentSituation: 'Necesito más reservas entre semana',
      serviceId: null,
    });

    const { userPrompt } = buildDiagnosisPrompt(payload);

    expect(userPrompt).toContain('Capacidad semanal estimada: 12 clientes.');
  });

  it('etiqueta el tope de CPA como "Máximo aceptable por adquisición (tope de CPA)" y expone el modo de estimación', () => {
    const payload = buildDiagnosisPayload({
      context: baseContext({ evidenceMode: 'EVIDENCE' }),
      currentSituation: 'Necesito más reservas entre semana',
      serviceId: null,
    });

    const { userPrompt } = buildDiagnosisPrompt(payload);

    expect(userPrompt).toContain('Máximo aceptable por adquisición (tope de CPA): $5.000 CLP');
    expect(userPrompt).not.toContain('Tope CPA registrado:');
    // En modo EVIDENCE la línea "Modo estimación" refleja que hay soporte histórico.
    expect(userPrompt).toContain('Modo estimación: soportado por evidencia histórica');
  });

  it('etiqueta el modo de estimación como "sin evidencia" cuando evidenceMode=NO_EVIDENCE', () => {
    const payload = buildDiagnosisPayload({
      context: baseContext({ evidenceMode: 'NO_EVIDENCE' }),
      currentSituation: 'Necesito más reservas entre semana',
      serviceId: null,
    });

    const { userPrompt } = buildDiagnosisPrompt(payload);

    expect(userPrompt).toContain(
      'Modo estimación: sin evidencia histórica - puede proponer Costo por adquisición (CPA) objetivo e inicializable basado en servicio, capacidad, oferta y meta.',
    );
  });

  it('incluye qualifyingQuestions registradas en el perfil', () => {
    const payload = buildDiagnosisPayload({
      context: baseContext({
        qualifyingQuestions: ['¿Cabello tinturado?', '¿Pelo largo?'],
      }),
      currentSituation: 'Necesito más reservas entre semana',
      serviceId: null,
    });

    const { userPrompt } = buildDiagnosisPrompt(payload);

    expect(userPrompt).toContain('Preguntas de calificación registradas:');
    expect(userPrompt).toContain('- ¿Cabello tinturado?');
    expect(userPrompt).toContain('- ¿Pelo largo?');
  });

  it('marca "sin registrar" cuando weeklyServiceCapacity es null', () => {
    const payload = buildDiagnosisPayload({
      context: baseContext({ weeklyServiceCapacity: null }),
      currentSituation: 'Necesito más reservas entre semana',
      serviceId: null,
    });

    const { userPrompt } = buildDiagnosisPrompt(payload);

    expect(userPrompt).toContain('Capacidad semanal estimada: sin registrar clientes.');
  });

  it('sigue generando un userPrompt con marcadores de "sin perfil" cuando el contexto está vacío', () => {
    const emptyContext: DiagnosisContext = {
      profileReady: false,
      primaryCustomerProfile: '',
      brandVoiceKeywords: [],
      wordsToAvoid: [],
      qualifyingQuestions: [],
      weeklyServiceCapacity: null,
      monthlyAcquisitionGoal: null,
      costPerAcquisitionCap: null,
      displayLocation: '',
      communeName: null,
      regionName: null,
      income: null,
      population: null,
      profileDescription: null,
      evidenceMode: 'NO_EVIDENCE',
      primaryServicePrice: null,
      services: [],
    };
    const payload = buildDiagnosisPayload({
      context: emptyContext,
      currentSituation: 'Aún no tengo reservas estables',
      serviceId: null,
    });

    const { userPrompt } = buildDiagnosisPrompt(payload);

    expect(userPrompt).toContain('Perfil completado: no (operadora aún no ha cerrado el contexto).');
    expect(userPrompt).toContain('Clienta ideal: sin descripción.');
    expect(userPrompt).toContain('Preguntas de calificación: ninguna registrada.');
    expect(userPrompt).toContain('Ubicación del negocio: sin dirección registrada en el perfil.');
    expect(userPrompt).toContain('El negocio aún no tiene servicios activos registrados.');
    expect(userPrompt).toContain('Capacidad semanal estimada: sin registrar clientes.');
    expect(userPrompt).toContain('Meta mensual de adquisiciones: sin registrar clientes/mes.');
    expect(userPrompt).toContain('Máximo aceptable por adquisición (tope de CPA): sin tope registrado.');
    expect(userPrompt).toContain(
      'Modo estimación: sin evidencia histórica - puede proponer Costo por adquisición (CPA) objetivo e inicializable basado en servicio, capacidad, oferta y meta.',
    );
    expect(userPrompt).toContain('=== SITUACIÓN DECLARADA POR LA OPERADORA ===');
    expect(userPrompt).toContain('Aún no tengo reservas estables');
  });

  it('incluye cada respuesta previa con su questionKey en el bloque de conversación', () => {
    const conversation: DiagnosticConversationEntry[] = [
      {
        questionKey: 'pain_point',
        questionText: '¿Cuál es tu principal dolor esta semana?',
        answerText: 'No llegan evaluaciones los lunes.',
        wasClarification: true,
      },
      {
        questionKey: 'capacity_target',
        questionText: '¿Cuántos clientes nuevos puedes absorber por semana?',
        answerText: 'Alcanzo con 6 más por semana.',
        wasClarification: true,
      },
    ];

    const payload = buildDiagnosisPayload({
      context: baseContext(),
      currentSituation: 'Tengo disponibilidad lunes a miércoles',
      serviceId: null,
      conversation,
    });

    const { userPrompt } = buildDiagnosisPrompt(payload);

    expect(userPrompt).toContain('=== RESPUESTAS PREVIAS DE LA OPERADORA ===');
    expect(userPrompt).toContain(
      '- Pregunta (pain_point): ¿Cuál es tu principal dolor esta semana? → No llegan evaluaciones los lunes.',
    );
    expect(userPrompt).toContain(
      '- Pregunta (capacity_target): ¿Cuántos clientes nuevos puedes absorber por semana? → Alcanzo con 6 más por semana.',
    );
  });

  it('incluye la recomendación previa cuando se pasa existingRecommended', () => {
    const payload = buildDiagnosisPayload({
      context: baseContext(),
      currentSituation: 'Tengo disponibilidad lunes a miércoles',
      serviceId: 'svc-balayage',
      existingRecommended: {
        situation: 'Demasiada disponibilidad entre semana',
        opportunity: 'Hay demanda latente los lunes',
        primaryGoal: '6 clientes nuevos por semana',
        primaryConversion: 'Reservas',
        recommendedTitle: 'Plan lunes',
        recommendedWeeklyAdd: 6,
        availableCapacity: 10,
      },
    });

    const { userPrompt } = buildDiagnosisPrompt(payload);

    expect(userPrompt).toContain('=== RECOMENDACIÓN ACTUAL (PARA REFERENCIA) ===');
    expect(userPrompt).toContain('Situación: Demasiada disponibilidad entre semana.');
    expect(userPrompt).toContain('Objetivo principal: 6 clientes nuevos por semana.');
    expect(userPrompt).toContain('Volumen semanal recomendado: 6 clientes/semana');
    expect(userPrompt).toContain('Capacidad disponible: 10 clientes/semana');
  });
});

describe('buildAdjustmentPrompt', () => {
  it('incluye la instrucción literal del operador y la recommended previa', () => {
    const payload: DiagnosisPayload = buildDiagnosisPayload({
      context: baseContext(),
      currentSituation: 'Tengo disponibilidad lunes a miércoles',
      serviceId: 'svc-balayage',
      existingRecommended: {
        situation: 'Demasiada disponibilidad entre semana',
        opportunity: 'Hay demanda latente los lunes',
        primaryGoal: '6 clientes nuevos por semana',
        primaryConversion: 'Reservas',
        recommendedTitle: 'Plan lunes',
        recommendedWeeklyAdd: 6,
        availableCapacity: 10,
      },
    });

    const { systemPrompt, userPrompt } = buildAdjustmentPrompt({
      instruction: 'Enfoca la meta solo en lunes y martes.',
      payload,
    });

    expect(systemPrompt).toContain('AI_RECOMMENDATION');
    expect(systemPrompt).toContain('"decision": "READY"');
    expect(userPrompt).toContain('=== INSTRUCCIÓN DEL OPERADOR ===');
    expect(userPrompt).toContain('Enfoca la meta solo en lunes y martes.');
    expect(userPrompt).toContain('=== CONTEXTO RESUMIDO ===');
    expect(userPrompt).toContain('Tengo disponibilidad lunes a miércoles');
    expect(userPrompt).toContain('=== RECOMENDACIÓN ACTUAL (PARA REFERENCIA) ===');
    expect(userPrompt).toContain('Objetivo principal: 6 clientes nuevos por semana.');
    expect(userPrompt).toContain('Situación: Demasiada disponibilidad entre semana.');
  });

  it('incluye la instruction aunque no haya recommended previa', () => {
    const payload = buildDiagnosisPayload({
      context: baseContext(),
      currentSituation: 'Necesito ajustar la meta',
      serviceId: null,
    });

    const { userPrompt } = buildAdjustmentPrompt({
      instruction: 'Sube el objetivo a 8 clientes por semana.',
      payload,
    });

    expect(userPrompt).toContain('Sube el objetivo a 8 clientes por semana.');
    // No debe colarse la sección de recommended cuando no existe.
    expect(userPrompt).not.toContain('=== RECOMENDACIÓN ACTUAL (PARA REFERENCIA) ===');
  });

  it('preserva el contexto de preguntas pendientes cuando se ajusta una diagnosis con conversación', () => {
    const conversation: DiagnosticConversationEntry[] = [
      {
        questionKey: 'pain_point',
        questionText: '¿Cuál es tu principal dolor esta semana?',
        answerText: 'No llegan evaluaciones los lunes.',
        wasClarification: true,
      },
    ];
    const payload = buildDiagnosisPayload({
      context: baseContext(),
      currentSituation: 'Tengo disponibilidad lunes a miércoles',
      serviceId: null,
      conversation,
    });

    const { userPrompt } = buildAdjustmentPrompt({
      instruction: 'Baja el objetivo a 4 clientes por semana.',
      payload,
    });

    expect(userPrompt).toContain('=== RESPUESTAS PREVIAS DE LA OPERADORA ===');
    expect(userPrompt).toContain('- Pregunta (pain_point): ¿Cuál es tu principal dolor esta semana? → No llegan evaluaciones los lunes.');
    expect(userPrompt).toContain('Baja el objetivo a 4 clientes por semana.');
  });
});