import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommercialDiagnosisFlow } from './CommercialDiagnosisFlow';
import type {
  CommercialDiagnosis,
  CommercialDiagnosisAcceptResult,
} from '@/lib/commercial-diagnosis/api';
import type { ServiceSummary } from '@/lib/services/api';

jest.mock('@/app/commercial-diagnosis/actions', () => ({
  startCommercialDiagnosisAction: jest.fn(),
  answerCommercialDiagnosisAction: jest.fn(),
  adjustCommercialDiagnosisAction: jest.fn(),
  acceptCommercialDiagnosisAction: jest.fn(),
  getCommercialDiagnosisAction: jest.fn(),
}));

const mockRouterPush = jest.fn();
const mockRouterReplace = jest.fn();
const mockRouterRefresh = jest.fn();
const mockRouterBack = jest.fn();
const mockRouterForward = jest.fn();
const mockRouterPrefetch = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: mockRouterReplace,
    refresh: mockRouterRefresh,
    back: mockRouterBack,
    forward: mockRouterForward,
    prefetch: mockRouterPrefetch,
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/commercial-diagnosis',
}));

const {
  startCommercialDiagnosisAction,
  answerCommercialDiagnosisAction,
  adjustCommercialDiagnosisAction,
  acceptCommercialDiagnosisAction,
} = jest.requireMock('@/app/commercial-diagnosis/actions') as {
  startCommercialDiagnosisAction: jest.Mock;
  answerCommercialDiagnosisAction: jest.Mock;
  adjustCommercialDiagnosisAction: jest.Mock;
  acceptCommercialDiagnosisAction: jest.Mock;
};

const baseAnswersPending = [
  {
    id: 'ans-pending',
    questionKey: 'pain_point',
    questionText: '¿Cuál es tu principal dolor esta semana?',
    answerText: null,
    askedAt: '2026-09-27T00:00:00.000Z',
    answeredAt: null,
  },
];

// Por defecto los tests renderizan con un único servicio (P1-5: en
// ese caso el componente autosecciona y NO muestra el selector). Los
// tests específicos del selector pasan varias opciones.
const defaultServices: ServiceSummary[] = [
  {
    id: 'svc-balayage',
    name: 'Balayage personalizado',
    description: 'Diagnóstico + aplicación + sellado.',
    price: '95500',
    currency: 'CLP',
    duration: 120,
  },
];

const baseReadyDiagnosis: CommercialDiagnosis = {
  id: 'diag-1',
  businessId: 'test-business',
  status: 'READY',
  currentSituation: 'Tengo clientas principalmente jueves a domingo',
  serviceId: 'svc-balayage',
  situation: 'Demasiada disponibilidad entre semana',
  opportunity: 'Hay demanda latente los lunes',
  primaryGoal: '6 clientes nuevos por semana',
  primaryConversion: 'Reservas',
  recommendedTitle: 'Plan lunes y martes',
  recommendedWeeklyAdd: 6,
  availableCapacity: 10,
  recommended: {
    situation: 'Demasiada disponibilidad entre semana',
    opportunity: 'Hay demanda latente los lunes',
    primaryGoal: '6 clientes nuevos por semana',
    primaryConversion: 'Reservas',
    recommendedTitle: 'Plan lunes y martes',
    recommendedWeeklyAdd: 6,
    availableCapacity: 10,
    goalConfidence: 'SUPPORTED',
  },
  strategy: {
    businessObjective: 'Conseguir 6 clientes nuevos por semana los lunes y martes.',
    offer: 'Reserva con 20% de descuento para evaluaciones los lunes.',
    primaryKpi: 'Reservas',
    idealCustomerProfile: 'Mujer 30-45 que busca balayage natural',
    qualifyingQuestions: ['¿Cabello tinturado?'],
    constraints: ['No usar barato'],
    stopIf: null,
    scaleIf: null,
    initialDailyBudgetCLP: '5000',
    initialLifetimeBudgetCLP: '70000',
    initialDurationDays: 14,
    initialCpaTargetCLP: '5000',
    initialCpaCapCLP: '5000',
    cpaRationale:
      'Con 6 conversiones/semana y CPA histórico de $5.000, el CPA objetivo es coherente.',
    priceJustification:
      'Un CPA de $5.000 representa ~5% del precio del servicio ($95.500), alineado con el margen del sector.',
    primaryConversion: 'Reservas',
    progressionSteps: [3, 4, 6],
    provenance: {},
    recommendedStartDate: '2026-10-02',
    recommendedEndDate: '2026-10-15',
    recommendedWeekdays: [1, 2, 4],
    budgetExplanation:
      'Con 6 conversiones/semana y un CPA histórico de $5.000, el presupuesto es coherente con la evidencia.',
    scheduleExplanation:
      'Concentra la pauta en lunes, martes y jueves (los días con mejor CPA).',
    assumptions: [
      'CPA histórico observado: $5.000 CLP.',
      'Conversiones objetivo del periodo: 12.',
      'Volumen semanal declarado: 6 conversiones nuevas por semana.',
    ],
    goalAssessment: {
      status: 'SUPPORTED',
      explanation:
        'La meta de 6 conversiones/semana es coherente con la evidencia histórica del negocio y su capacidad registrada.',
      disclaimer:
        'La inversión propuesta no garantiza reservas ni ventas; el resultado depende de entrega, audiencia, creatividad y conversión.',
    },
  },
  answers: [],
  campaignBriefId: null,
  createdAt: '2026-09-27T00:00:00.000Z',
  updatedAt: '2026-09-27T00:00:00.000Z',
};

const baseInProgressDiagnosis: CommercialDiagnosis = {
  ...baseReadyDiagnosis,
  status: 'IN_PROGRESS',
  situation: null,
  opportunity: null,
  primaryGoal: null,
  primaryConversion: null,
  recommendedTitle: null,
  recommendedWeeklyAdd: null,
  recommended: {
    situation: null,
    opportunity: null,
    primaryGoal: null,
    primaryConversion: null,
    recommendedTitle: null,
    recommendedWeeklyAdd: null,
    availableCapacity: 10,
    pendingQuestion: {
      key: 'pain_point',
      text: '¿Cuál es tu principal dolor esta semana?',
    },
  },
  strategy: null,
  answers: baseAnswersPending,
};

const baseReadyDiagnosisInsufficientData: CommercialDiagnosis = {
  ...baseReadyDiagnosis,
  recommendedWeeklyAdd: null,
  recommended: {
    ...baseReadyDiagnosis.recommended,
    recommendedWeeklyAdd: null,
    goalConfidence: 'INSUFFICIENT_DATA',
  },
};

beforeEach(() => {
  startCommercialDiagnosisAction.mockReset();
  answerCommercialDiagnosisAction.mockReset();
  adjustCommercialDiagnosisAction.mockReset();
  acceptCommercialDiagnosisAction.mockReset();
  mockRouterPush.mockReset();
  mockRouterReplace.mockReset();
});

describe('CommercialDiagnosisFlow', () => {
  it('render inicial: muestra el header, el placeholder de ejemplo y el botón "Analizar mi situación" deshabilitado', async () => {
    const user = userEvent.setup();
    render(<CommercialDiagnosisFlow services={defaultServices} />);

    expect(
      screen.getByRole('heading', { name: /Busquemos la próxima oportunidad/i }),
    ).toBeInTheDocument();
    const textarea = screen.getByTestId('cdf-intro-textarea');
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveAttribute(
      'placeholder',
      expect.stringContaining('Tengo clientas principalmente jueves'),
    );
    expect(
      screen.getByText(/Por ejemplo:/i),
    ).toBeInTheDocument();

    const submitButton = screen.getByTestId('cdf-intro-submit');
    expect(submitButton).toBeDisabled();

    // Al escribir menos de 10 chars sigue deshabilitado.
    await user.type(textarea, 'corto');
    expect(submitButton).toBeDisabled();
  });

  it('habilita el botón "Analizar mi situación" cuando hay >= 10 caracteres', async () => {
    const user = userEvent.setup();
    render(<CommercialDiagnosisFlow services={defaultServices} />);

    const textarea = screen.getByTestId('cdf-intro-textarea');
    const submitButton = screen.getByTestId('cdf-intro-submit');

    await user.type(textarea, 'Tengo clientas principalmente jueves a domingo.');
    expect(submitButton).not.toBeDisabled();
  });

  it('click en "Analizar mi situación" llama a startCommercialDiagnosisAction y muestra estado analyzing', async () => {
    startCommercialDiagnosisAction.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(baseReadyDiagnosis), 50)),
    );
    const user = userEvent.setup();
    render(<CommercialDiagnosisFlow services={defaultServices} />);

    const textarea = screen.getByTestId('cdf-intro-textarea');
    await user.type(textarea, 'Tengo clientas principalmente jueves a domingo.');

    await user.click(screen.getByTestId('cdf-intro-submit'));

    // Mientras la promesa no resuelve debe verse la fase analyzing.
    expect(await screen.findByTestId('cdf-analyzing')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByTestId('cdf-analyzing-status')).toHaveTextContent(
      /Analizando tu situación/i,
    );

    await waitFor(() => {
      expect(startCommercialDiagnosisAction).toHaveBeenCalledTimes(1);
    });
    expect(startCommercialDiagnosisAction).toHaveBeenCalledWith({
      currentSituation: 'Tengo clientas principalmente jueves a domingo.',
      serviceId: 'svc-balayage',
    });

    // Al resolver la promesa, pasa a "result" con la diagnosis READY.
    expect(await screen.findByTestId('cdf-result-card')).toBeInTheDocument();
  });

  it('renderiza el bloque de resultado con situation/opportunity/primaryGoal/recommendedWeeklyAdd', async () => {
    startCommercialDiagnosisAction.mockResolvedValueOnce(baseReadyDiagnosis);
    const user = userEvent.setup();
    render(<CommercialDiagnosisFlow services={defaultServices} />);

    await user.type(
      screen.getByTestId('cdf-intro-textarea'),
      'Tengo clientas principalmente jueves a domingo.',
    );
    await user.click(screen.getByTestId('cdf-intro-submit'));

    const card = await screen.findByTestId('cdf-result-card');
    expect(card).toBeInTheDocument();
    expect(card).toHaveTextContent('Demasiada disponibilidad entre semana');
    expect(card).toHaveTextContent('Hay demanda latente los lunes');
    // El card transforma recommendedWeeklyAdd (6) en "6 reservas adicionales por semana".
    expect(card).toHaveTextContent('6 reservas adicionales por semana');
    expect(card).toHaveTextContent('Plan lunes y martes');

    // Y debe haber un botón "Usar esta meta" y "Ajustar con IA".
    expect(screen.getByTestId('cdf-result-accept')).toBeInTheDocument();
    expect(screen.getByTestId('cdf-result-adjust-toggle')).toBeInTheDocument();
  });

  it('muestra RecommendedBudgetCard con los nuevos campos cuando strategy trae la recomendación', async () => {
    startCommercialDiagnosisAction.mockResolvedValueOnce(baseReadyDiagnosis);
    const user = userEvent.setup();
    render(<CommercialDiagnosisFlow services={defaultServices} />);

    await user.type(
      screen.getByTestId('cdf-intro-textarea'),
      'Tengo clientas principalmente jueves a domingo.',
    );
    await user.click(screen.getByTestId('cdf-intro-submit'));

    const budgetCard = await screen.findByTestId('cdf-budget-card');
    expect(budgetCard).toBeInTheDocument();
    expect(budgetCard).toHaveTextContent('Inversión sugerida');
    expect(budgetCard).toHaveTextContent('Periodo recomendado: 2026-10-02 al 2026-10-15');
    expect(budgetCard).toHaveTextContent('lun');
    expect(budgetCard).toHaveTextContent('mar');
    expect(budgetCard).toHaveTextContent('jue');
    // Badge de confianza (status=SUPPORTED)
    const badge = screen.getByTestId('cdf-budget-confidence-badge');
    expect(badge).toHaveAttribute('data-status', 'SUPPORTED');
    // Disclaimer al pie siempre visible
    expect(screen.getByTestId('cdf-budget-disclaimer')).toBeInTheDocument();
    // Badge de confianza en la tarjeta de meta propuesta
    const goalBadge = screen.getByTestId('cdf-goal-confidence-badge');
    expect(goalBadge).toHaveAttribute('data-status', 'SUPPORTED');
    // Bloque "Costo por adquisición" con la unidad derivada del primaryConversion.
    const cpa = screen.getByTestId('cdf-budget-cpa');
    expect(cpa).toBeInTheDocument();
    expect(cpa).toHaveAttribute('data-variant', 'cpa');
    expect(cpa).toHaveTextContent('Reserva confirmada');
    expect(screen.getByTestId('cdf-budget-cpa-target')).toHaveTextContent(
      'Costo por adquisición (CPA) recomendado',
    );
    expect(screen.getByTestId('cdf-budget-cpa-cap')).toHaveTextContent(
      'Máximo aceptable (tope de CPA)',
    );
    expect(screen.getByTestId('cdf-budget-cpa-rationale')).toHaveTextContent(
      'CPA histórico de $5.000',
    );
    expect(screen.getByTestId('cdf-budget-cpa-price')).toHaveTextContent(
      '~5% del precio del servicio',
    );
  });

  it('muestra el fallback "Sin meta semanal recomendada" cuando recommendedWeeklyAdd es null', async () => {
    startCommercialDiagnosisAction.mockResolvedValueOnce(
      baseReadyDiagnosisInsufficientData,
    );
    const user = userEvent.setup();
    render(<CommercialDiagnosisFlow services={defaultServices} />);

    await user.type(
      screen.getByTestId('cdf-intro-textarea'),
      'Tengo clientas principalmente jueves a domingo.',
    );
    await user.click(screen.getByTestId('cdf-intro-submit'));

    const card = await screen.findByTestId('cdf-result-card');
    expect(card).toHaveTextContent(
      'Sin meta semanal recomendada por falta de evidencia histórica',
    );
    // No debe mostrar el texto de "reservas adicionales por semana" en este caso
    expect(card).not.toHaveTextContent('reservas adicionales por semana');
  });

  it('renderiza el textarea de clarificación con la pregunta pendiente cuando status=IN_PROGRESS', async () => {
    startCommercialDiagnosisAction.mockResolvedValueOnce(baseInProgressDiagnosis);
    const user = userEvent.setup();
    render(<CommercialDiagnosisFlow services={defaultServices} />);

    await user.type(
      screen.getByTestId('cdf-intro-textarea'),
      'Tengo clientas principalmente jueves a domingo.',
    );
    await user.click(screen.getByTestId('cdf-intro-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('cdf-clarification-textarea')).toBeInTheDocument();
    });
    expect(
      screen.getByRole('heading', {
        name: /¿Cuál es tu principal dolor esta semana\?/i,
      }),
    ).toBeInTheDocument();

    const submit = screen.getByTestId('cdf-clarification-submit');
    expect(submit).toBeDisabled();
  });

  it('responder la pregunta llama a answerCommercialDiagnosisAction con {questionKey, answerText}', async () => {
    startCommercialDiagnosisAction.mockResolvedValueOnce(baseInProgressDiagnosis);
    answerCommercialDiagnosisAction.mockResolvedValueOnce(baseReadyDiagnosis);

    const user = userEvent.setup();
    render(<CommercialDiagnosisFlow services={defaultServices} />);

    await user.type(
      screen.getByTestId('cdf-intro-textarea'),
      'Tengo clientas principalmente jueves a domingo.',
    );
    await user.click(screen.getByTestId('cdf-intro-submit'));

    const clarification = await screen.findByTestId('cdf-clarification-textarea');
    await user.type(clarification, 'No llegan evaluaciones los lunes');

    await user.click(screen.getByTestId('cdf-clarification-submit'));

    await waitFor(() => {
      expect(answerCommercialDiagnosisAction).toHaveBeenCalledTimes(1);
    });
    expect(answerCommercialDiagnosisAction).toHaveBeenCalledWith('diag-1', {
      questionKey: 'pain_point',
      answerText: 'No llegan evaluaciones los lunes',
    });

    // Después de resolver, debe pasar a la fase de resultado.
    expect(await screen.findByTestId('cdf-result-card')).toBeInTheDocument();
  });

  it('click en "Usar esta meta" llama a acceptCommercialDiagnosisAction y navega a /campaigns/new?briefId=<id>', async () => {
    startCommercialDiagnosisAction.mockResolvedValueOnce(baseReadyDiagnosis);
    const acceptResult: CommercialDiagnosisAcceptResult = {
      diagnosis: { ...baseReadyDiagnosis, status: 'ACCEPTED', campaignBriefId: 'brief-99' },
      campaignBrief: { id: 'brief-99' },
    };
    acceptCommercialDiagnosisAction.mockResolvedValueOnce(acceptResult);

    const user = userEvent.setup();
    render(<CommercialDiagnosisFlow services={defaultServices} />);

    await user.type(
      screen.getByTestId('cdf-intro-textarea'),
      'Tengo clientas principalmente jueves a domingo.',
    );
    await user.click(screen.getByTestId('cdf-intro-submit'));

    const acceptButton = await screen.findByTestId('cdf-result-accept');
    await user.click(acceptButton);

    await waitFor(() => {
      expect(acceptCommercialDiagnosisAction).toHaveBeenCalledTimes(1);
    });
    expect(acceptCommercialDiagnosisAction).toHaveBeenCalledWith('diag-1');
    expect(mockRouterPush).toHaveBeenCalledWith('/campaigns/new?briefId=brief-99');
  });

  it('click en "Ajustar con IA" abre el textarea secundario; enviar llama a adjustCommercialDiagnosisAction', async () => {
    startCommercialDiagnosisAction.mockResolvedValueOnce(baseReadyDiagnosis);
    adjustCommercialDiagnosisAction.mockResolvedValueOnce({
      ...baseReadyDiagnosis,
      primaryGoal: '8 clientes nuevos por semana',
      recommendedWeeklyAdd: 8,
      recommended: {
        ...baseReadyDiagnosis.recommended,
        primaryGoal: '8 clientes nuevos por semana',
        recommendedWeeklyAdd: 8,
      },
    });

    const user = userEvent.setup();
    render(<CommercialDiagnosisFlow services={defaultServices} />);

    await user.type(
      screen.getByTestId('cdf-intro-textarea'),
      'Tengo clientas principalmente jueves a domingo.',
    );
    await user.click(screen.getByTestId('cdf-intro-submit'));

    await screen.findByTestId('cdf-result-card');

    // Click en el botón "Ajustar con IA" → aparece el textarea secundario.
    await user.click(screen.getByTestId('cdf-result-adjust-toggle'));
    const adjustTextarea = await screen.findByTestId('cdf-result-adjust-textarea');
    expect(adjustTextarea).toBeInTheDocument();
    expect(screen.getByTestId('cdf-result-adjust-submit')).toBeDisabled();

    await user.type(adjustTextarea, 'Sube la meta a 8 clientes por semana.');
    expect(screen.getByTestId('cdf-result-adjust-submit')).not.toBeDisabled();

    await user.click(screen.getByTestId('cdf-result-adjust-submit'));

    await waitFor(() => {
      expect(adjustCommercialDiagnosisAction).toHaveBeenCalledTimes(1);
    });
    expect(adjustCommercialDiagnosisAction).toHaveBeenCalledWith('diag-1', {
      instruction: 'Sube la meta a 8 clientes por semana.',
    });

    // El bloque de resultado se actualiza con el nuevo recommendedWeeklyAdd (8).
    await waitFor(() => {
      expect(screen.getByTestId('cdf-result-card')).toHaveTextContent(
        '8 reservas adicionales por semana',
      );
    });
  });

  it('mock que lanza excepción → renderiza banner de error (role="alert") con botón "Reintentar"', async () => {
    startCommercialDiagnosisAction.mockRejectedValueOnce(
      new Error('OPENAI_API_KEY no configurada'),
    );
    const user = userEvent.setup();
    render(<CommercialDiagnosisFlow services={defaultServices} />);

    await user.type(
      screen.getByTestId('cdf-intro-textarea'),
      'Tengo clientas principalmente jueves a domingo.',
    );
    await user.click(screen.getByTestId('cdf-intro-submit'));

    const banner = await screen.findByTestId('cdf-error-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveAttribute('role', 'alert');
    expect(banner).toHaveTextContent('OPENAI_API_KEY no configurada');

    const retry = screen.getByTestId('cdf-error-retry');
    expect(retry).toBeInTheDocument();
    expect(retry).toHaveTextContent(/Reintentar/);
  });

  it('click en "Reintentar" tras un error vuelve al estado anterior (fase intro)', async () => {
    startCommercialDiagnosisAction
      .mockRejectedValueOnce(new Error('Falla inicial'))
      .mockResolvedValueOnce(baseReadyDiagnosis);

    const user = userEvent.setup();
    render(<CommercialDiagnosisFlow services={defaultServices} />);

    await user.type(
      screen.getByTestId('cdf-intro-textarea'),
      'Tengo clientas principalmente jueves a domingo.',
    );
    await user.click(screen.getByTestId('cdf-intro-submit'));

    await screen.findByTestId('cdf-error-banner');

    await user.click(screen.getByTestId('cdf-error-retry'));

    // Vuelve a fase intro: el textarea está presente, sin banner de error.
    await waitFor(() => {
      expect(screen.queryByTestId('cdf-error-banner')).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('cdf-intro-textarea')).toBeInTheDocument();

    // Reintentamos con éxito y aparece la tarjeta de resultado.
    await user.click(screen.getByTestId('cdf-intro-submit'));
    expect(await screen.findByTestId('cdf-result-card')).toBeInTheDocument();
  });
});

// -----------------------------------------------------------------------------
// P1-5: selector de servicio cuando hay 2+ servicios activos
// -----------------------------------------------------------------------------
describe('CommercialDiagnosisFlow — selector de servicio', () => {
  const multiServices: ServiceSummary[] = [
    {
      id: 'svc-balayage',
      name: 'Balayage personalizado',
      description: 'Diagnóstico + aplicación + sellado.',
      price: '95500',
      currency: 'CLP',
      duration: 120,
    },
    {
      id: 'svc-corte',
      name: 'Corte de cabello',
      description: 'Corte y peinado.',
      price: '25000',
      currency: 'CLP',
      duration: 60,
    },
  ];

  it('NO muestra el selector cuando hay un único servicio activo', () => {
    render(<CommercialDiagnosisFlow services={defaultServices} />);
    expect(screen.queryByTestId('cdf-intro-service-select')).not.toBeInTheDocument();
  });

  it('muestra el selector cuando hay 2+ servicios activos y deshabilita "Analizar mi situación" hasta elegir uno', async () => {
    const user = userEvent.setup();
    render(<CommercialDiagnosisFlow services={multiServices} />);

    const select = screen.getByTestId('cdf-intro-service-select');
    expect(select).toBeInTheDocument();
    expect(select).toHaveValue('');

    const textarea = screen.getByTestId('cdf-intro-textarea');
    await user.type(textarea, 'Tengo clientas principalmente jueves a domingo.');
    // Aún sin servicio elegido → deshabilitado.
    expect(screen.getByTestId('cdf-intro-submit')).toBeDisabled();

    await user.selectOptions(select, 'svc-corte');
    expect(screen.getByTestId('cdf-intro-submit')).not.toBeDisabled();
  });

  it('envía el serviceId elegido al iniciar el diagnóstico', async () => {
    startCommercialDiagnosisAction.mockResolvedValueOnce(baseReadyDiagnosis);
    const user = userEvent.setup();
    render(<CommercialDiagnosisFlow services={multiServices} />);

    const textarea = screen.getByTestId('cdf-intro-textarea');
    await user.type(textarea, 'Tengo clientas principalmente jueves a domingo.');
    await user.selectOptions(screen.getByTestId('cdf-intro-service-select'), 'svc-corte');

    await user.click(screen.getByTestId('cdf-intro-submit'));

    await waitFor(() => {
      expect(startCommercialDiagnosisAction).toHaveBeenCalledTimes(1);
    });
    expect(startCommercialDiagnosisAction).toHaveBeenCalledWith({
      currentSituation: 'Tengo clientas principalmente jueves a domingo.',
      serviceId: 'svc-corte',
    });
  });

  it('con un único servicio envía automáticamente ese serviceId (autoselección)', async () => {
    startCommercialDiagnosisAction.mockResolvedValueOnce(baseReadyDiagnosis);
    const user = userEvent.setup();
    render(<CommercialDiagnosisFlow services={defaultServices} />);

    const textarea = screen.getByTestId('cdf-intro-textarea');
    await user.type(textarea, 'Tengo clientas principalmente jueves a domingo.');
    await user.click(screen.getByTestId('cdf-intro-submit'));

    await waitFor(() => {
      expect(startCommercialDiagnosisAction).toHaveBeenCalledTimes(1);
    });
    expect(startCommercialDiagnosisAction).toHaveBeenCalledWith({
      currentSituation: 'Tengo clientas principalmente jueves a domingo.',
      serviceId: 'svc-balayage',
    });
  });
});