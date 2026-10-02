import { OPEN_AI_DECISION_SCHEMA } from './commercial-diagnosis.dto';

/**
 * Cobertura específica del refactor CPA objetivo / tope:
 *
 *  - `cpaTarget <= 0` → rechazo (no tiene sentido proponer un CPA
 *    objetivo nulo o negativo).
 *  - `cpaCap < cpaTarget` → rechazo (el tope no puede ser menor que el
 *    objetivo, eso contradice el rol de cada uno).
 *  - `cpaRationale > 200` → rechazo (alineado con el límite por
 *    entrada de `assumptions`; el rationale se persiste codificado ahí).
 *  - `priceJustification > 200` → rechazo (alineado con strings cortos).
 *
 * Estos casos se aplican al shape que la IA entrega cuando
 * `decision === 'READY'` con un `strategy` adjunto. Validamos contra
 * `OPEN_AI_DECISION_SCHEMA.safeParse(...)`.
 */

const buildReadyShape = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  decision: 'READY',
  situation: 'Demasiada disponibilidad entre semana',
  opportunity: 'Hay demanda latente los lunes',
  primaryGoal: '6 clientes nuevos por semana',
  primaryConversion: 'Reservas',
  recommendedTitle: 'Plan lunes y martes',
  recommendedWeeklyAdd: 6,
  availableCapacity: 10,
  ...overrides,
});

describe('OPEN_AI_DECISION_SCHEMA (CPA objetivo vs tope)', () => {
  it('acepta cpaTarget positivo, cpaCap mayor y cpaRationale ≤ 200 caracteres', () => {
    const shape = buildReadyShape({
      strategy: {
        businessObjective: 'Conseguir 6 clientes nuevos por semana.',
        offer: 'Reserva con 20% de descuento para evaluaciones los lunes.',
        primaryKpi: 'Reservas',
        qualifyingQuestions: [],
        constraints: [],
        initialDurationDays: 14,
        initialCpaTargetCLP: 2500,
        initialCpaCapCLP: 4000,
        cpaRationale: 'Servicio premium en Las Condes con ticket de $95.500 CLP.',
        progressionSteps: [3, 4, 6],
      },
    });
    const result = OPEN_AI_DECISION_SCHEMA.safeParse(shape);
    expect(result.success).toBe(true);
  });

  it('rechaza cpaTarget <= 0', () => {
    const shape = buildReadyShape({
      strategy: {
        businessObjective: 'Conseguir 6 clientes nuevos por semana.',
        offer: 'Reserva con 20% de descuento para evaluaciones los lunes.',
        primaryKpi: 'Reservas',
        qualifyingQuestions: [],
        constraints: [],
        initialDurationDays: 14,
        initialCpaTargetCLP: 0,
        initialCpaCapCLP: 4000,
        progressionSteps: [3, 4, 6],
      },
    });
    const result = OPEN_AI_DECISION_SCHEMA.safeParse(shape);
    expect(result.success).toBe(false);
  });

  it('rechaza cuando cpaCap < cpaTarget', () => {
    const shape = buildReadyShape({
      strategy: {
        businessObjective: 'Conseguir 6 clientes nuevos por semana.',
        offer: 'Reserva con 20% de descuento para evaluaciones los lunes.',
        primaryKpi: 'Reservas',
        qualifyingQuestions: [],
        constraints: [],
        initialDurationDays: 14,
        initialCpaTargetCLP: 4000,
        initialCpaCapCLP: 2500,
        progressionSteps: [3, 4, 6],
      },
    });
    const result = OPEN_AI_DECISION_SCHEMA.safeParse(shape);
    expect(result.success).toBe(false);
  });

  it('rechaza cpaRationale > 200 caracteres', () => {
    const shape = buildReadyShape({
      strategy: {
        businessObjective: 'Conseguir 6 clientes nuevos por semana.',
        offer: 'Reserva con 20% de descuento para evaluaciones los lunes.',
        primaryKpi: 'Reservas',
        qualifyingQuestions: [],
        constraints: [],
        initialDurationDays: 14,
        initialCpaTargetCLP: 2500,
        initialCpaCapCLP: 4000,
        cpaRationale: 'a'.repeat(201),
        progressionSteps: [3, 4, 6],
      },
    });
    const result = OPEN_AI_DECISION_SCHEMA.safeParse(shape);
    expect(result.success).toBe(false);
  });

  it('permite cpaCap y cpaTarget como null (modo sin propuesta)', () => {
    const shape = buildReadyShape({
      strategy: {
        businessObjective: 'Conseguir 6 clientes nuevos por semana.',
        offer: 'Reserva con 20% de descuento para evaluaciones los lunes.',
        primaryKpi: 'Reservas',
        qualifyingQuestions: [],
        constraints: [],
        initialDurationDays: 14,
        initialCpaTargetCLP: null,
        initialCpaCapCLP: null,
        progressionSteps: [3, 4, 6],
      },
    });
    const result = OPEN_AI_DECISION_SCHEMA.safeParse(shape);
    expect(result.success).toBe(true);
  });

  it('acepta priceJustification ≤ 200 caracteres', () => {
    const shape = buildReadyShape({
      strategy: {
        businessObjective: 'Conseguir 6 clientes nuevos por semana.',
        offer: 'Reserva con 20% de descuento para evaluaciones los lunes.',
        primaryKpi: 'Reservas',
        qualifyingQuestions: [],
        constraints: [],
        initialDurationDays: 14,
        initialCpaTargetCLP: 2500,
        initialCpaCapCLP: 4000,
        priceJustification: 'Servicio premium en Las Condes con ticket promedio de $95.500 CLP.',
        progressionSteps: [3, 4, 6],
      },
    });
    const result = OPEN_AI_DECISION_SCHEMA.safeParse(shape);
    expect(result.success).toBe(true);
  });

  it('rechaza priceJustification > 200 caracteres', () => {
    const shape = buildReadyShape({
      strategy: {
        businessObjective: 'Conseguir 6 clientes nuevos por semana.',
        offer: 'Reserva con 20% de descuento para evaluaciones los lunes.',
        primaryKpi: 'Reservas',
        qualifyingQuestions: [],
        constraints: [],
        initialDurationDays: 14,
        initialCpaTargetCLP: 2500,
        initialCpaCapCLP: 4000,
        priceJustification: 'a'.repeat(201),
        progressionSteps: [3, 4, 6],
      },
    });
    const result = OPEN_AI_DECISION_SCHEMA.safeParse(shape);
    expect(result.success).toBe(false);
  });
});