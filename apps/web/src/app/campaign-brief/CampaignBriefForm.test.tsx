import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CampaignBriefForm } from './CampaignBriefForm';
import type { CampaignBrief } from '@/lib/campaign-brief/api';

jest.mock('./actions', () => ({
  createCampaignBriefAction: jest.fn(),
  updateCampaignBriefAction: jest.fn(),
  approveCampaignBriefAction: jest.fn(),
  archiveCampaignBriefAction: jest.fn(),
  getCampaignBriefAction: jest.fn(),
  listCampaignBriefsAction: jest.fn(),
  suggestRulesAction: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

const {
  createCampaignBriefAction,
  updateCampaignBriefAction,
  approveCampaignBriefAction,
  suggestRulesAction,
} = jest.requireMock('./actions') as {
  createCampaignBriefAction: jest.Mock;
  updateCampaignBriefAction: jest.Mock;
  approveCampaignBriefAction: jest.Mock;
  archiveCampaignBriefAction: jest.Mock;
  suggestRulesAction: jest.Mock;
};

const services = [
  { id: 'svc-balayage', name: 'Balayage', description: null, price: '95500', currency: 'CLP', duration: 120 },
  { id: 'svc-corte', name: 'Corte', description: null, price: '18000', currency: 'CLP', duration: 45 },
];

const baseBrief: CampaignBrief = {
  id: 'brief-1',
  businessId: 'blondor',
  serviceId: 'svc-balayage',
  title: 'Balayage Q4',
  status: 'DRAFT',
  businessObjective: 'Conseguir 5 evaluaciones de balayage en 14 días',
  offer: 'Evaluación + 20% descuento en la primera sesión',
  primaryKpi: 'Evaluaciones',
  idealCustomerProfile: null,
  qualifyingQuestions: [],
  monthlyAcquisitionGoal: null,
  costPerAcquisitionCap: null,
  lifetimeBudgetCap: null,
  dailyBudgetCap: null,
  plannedDurationDays: null,
  constraints: [],
  stopIf: null,
  scaleIf: null,
  approvedAt: null,
  approvedBy: null,
  createdAt: '2026-09-27T00:00:00.000Z',
  updatedAt: '2026-09-27T00:00:00.000Z',
  executions: [],
};

beforeEach(() => {
  createCampaignBriefAction.mockReset();
  updateCampaignBriefAction.mockReset();
  approveCampaignBriefAction.mockReset();
  suggestRulesAction.mockReset();
});

describe('CampaignBriefForm', () => {
  it('renderiza campos y servicios en el select', () => {
    render(
      <CampaignBriefForm mode="create" services={services} prefill={null} />,
    );

    expect(screen.getByLabelText(/nombre del plan/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/servicio/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/qué resultado quieres conseguir/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/qué le vas a proponer/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/cómo sabremos si funciona/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /guardar borrador/i })).toBeInTheDocument();
    const createAndApprove = screen.getByRole('button', { name: /crear y aprobar/i });
    expect(createAndApprove).toBeDisabled();
  });

  it('edita el título y llama a createCampaignBriefAction al guardar', async () => {
    createCampaignBriefAction.mockResolvedValueOnce({ ...baseBrief, id: 'brief-new', title: 'Balayage Q4 v2' });

    const user = userEvent.setup();
    render(<CampaignBriefForm mode="create" services={services} prefill={null} />);

    const titleInput = screen.getByLabelText(/nombre del plan/i);
    await user.clear(titleInput);
    await user.type(titleInput, 'Balayage Q4 v2');

    const objective = screen.getByLabelText(/qué resultado quieres conseguir/i);
    await user.type(objective, 'Conseguir 5 evaluaciones en 14 días');

    const offer = screen.getByLabelText(/qué le vas a proponer/i);
    await user.type(offer, 'Evaluación + 20% descuento');

    const kpi = screen.getByLabelText(/cómo sabremos si funciona/i);
    await user.type(kpi, 'Evaluaciones');

    const serviceSelect = screen.getByLabelText(/servicio/i);
    await user.selectOptions(serviceSelect, 'svc-balayage');

    await user.click(screen.getByRole('button', { name: /guardar borrador/i }));

    await waitFor(() => {
      expect(createCampaignBriefAction).toHaveBeenCalledTimes(1);
    });

    const payload = createCampaignBriefAction.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.title).toBe('Balayage Q4 v2');
    expect(payload.businessObjective).toBe('Conseguir 5 evaluaciones en 14 días');
    expect(payload.offer).toBe('Evaluación + 20% descuento');
    expect(payload.primaryKpi).toBe('Evaluaciones');
    expect(payload.serviceId).toBe('svc-balayage');
  });

  it('habilita "Crear y aprobar" cuando todos los campos críticos están completos y lo expone tras el éxito', async () => {
    const created = { ...baseBrief, id: 'brief-new' };
    const approved = { ...created, status: 'APPROVED' as const, approvedAt: '2026-09-27T05:00:00.000Z' };
    createCampaignBriefAction.mockResolvedValueOnce(created);
    approveCampaignBriefAction.mockResolvedValueOnce(approved);

    const user = userEvent.setup();
    render(<CampaignBriefForm mode="create" services={services} prefill={null} />);

    await user.type(screen.getByLabelText(/nombre del plan/i), 'Balayage Q4 v2');
    await user.type(
      screen.getByLabelText(/qué resultado quieres conseguir/i),
      'Conseguir 5 evaluaciones en 14 días',
    );
    await user.type(
      screen.getByLabelText(/qué le vas a proponer/i),
      'Evaluación + 20% descuento',
    );
    await user.type(screen.getByLabelText(/cómo sabremos si funciona/i), 'Evaluaciones');
    await user.selectOptions(screen.getByLabelText(/servicio/i), 'svc-balayage');

    const createAndApprove = screen.getByRole('button', { name: /crear y aprobar/i });
    expect(createAndApprove).not.toBeDisabled();
    await user.click(createAndApprove);

    await waitFor(() => {
      expect(createCampaignBriefAction).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(approveCampaignBriefAction).toHaveBeenCalledTimes(1);
    });
    expect(approveCampaignBriefAction).toHaveBeenCalledWith('brief-new');
  });

  it('en modo edit llama a updateCampaignBriefAction al guardar', async () => {
    const updated = { ...baseBrief, title: 'Balayage Q4 actualizado' };
    updateCampaignBriefAction.mockResolvedValueOnce(updated);

    const user = userEvent.setup();
    render(
      <CampaignBriefForm
        mode="edit"
        initialBrief={baseBrief}
        services={services}
      />,
    );

    const titleInput = screen.getByLabelText(/nombre del plan/i);
    await user.clear(titleInput);
    await user.type(titleInput, 'Balayage Q4 actualizado');

    await user.click(screen.getByRole('button', { name: /^guardar$/i }));

    await waitFor(() => {
      expect(updateCampaignBriefAction).toHaveBeenCalledTimes(1);
    });
    const arg1 = updateCampaignBriefAction.mock.calls[0][0] as string;
    const arg2 = updateCampaignBriefAction.mock.calls[0][1] as Record<string, unknown>;
    expect(arg1).toBe('brief-1');
    expect(arg2.title).toBe('Balayage Q4 actualizado');
  });

  it('muestra el botón Aprobar en modo edit', async () => {
    const approved = {
      ...baseBrief,
      status: 'APPROVED' as const,
      approvedAt: '2026-09-27T05:00:00.000Z',
    };
    updateCampaignBriefAction.mockResolvedValueOnce(baseBrief);
    approveCampaignBriefAction.mockResolvedValueOnce(approved);

    const user = userEvent.setup();
    render(
      <CampaignBriefForm
        mode="edit"
        initialBrief={baseBrief}
        services={services}
      />,
    );

    const approve = screen.getByTestId('cb-approve');
    expect(approve).toBeInTheDocument();
    await user.click(approve);

    await waitFor(() => {
      expect(approveCampaignBriefAction).toHaveBeenCalledTimes(1);
    });
    expect(updateCampaignBriefAction).toHaveBeenCalledTimes(1);
  });
});

describe('CampaignBriefForm · Analizar objetivo comercial con IA', () => {
  const aiResponse = {
    stopIf: 'Si en 14 días no hay 5 conversaciones calificadas',
    scaleIf: 'Si CPL < $5.000 con más de 10 conversaciones',
    source: 'AI' as const,
  };

  it('deshabilita el botón cuando el objetivo comercial está vacío', () => {
    const briefSinObjetivo: CampaignBrief = {
      ...baseBrief,
      businessObjective: '',
    };
    render(
      <CampaignBriefForm
        mode="edit"
        initialBrief={briefSinObjetivo}
        services={services}
      />,
    );
    const button = screen.getByTestId('cb-suggest-rules');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(
      screen.getByTestId('cb-suggest-rules-disabled-reason'),
    ).toHaveTextContent(/objetivo comercial/i);
  });

  it('dispara la server action al pulsar el botón y muestra dos tarjetas', async () => {
    suggestRulesAction.mockResolvedValueOnce(aiResponse);
    const user = userEvent.setup();
    render(
      <CampaignBriefForm
        mode="edit"
        initialBrief={baseBrief}
        services={services}
      />,
    );

    const button = screen.getByTestId('cb-suggest-rules');
    expect(button).not.toBeDisabled();

    await user.click(button);

    await waitFor(() => {
      expect(suggestRulesAction).toHaveBeenCalledTimes(1);
    });
    expect(suggestRulesAction).toHaveBeenCalledWith('brief-1');

    const stopCard = await screen.findByTestId('cb-suggest-rules-stopIf');
    expect(stopCard).toHaveTextContent(aiResponse.stopIf);

    const scaleCard = screen.getByTestId('cb-suggest-rules-scaleIf');
    expect(scaleCard).toHaveTextContent(aiResponse.scaleIf);

    expect(screen.getByTestId('cb-suggest-rules-stopIf-meta')).toHaveTextContent(
      /IA/,
    );
    expect(screen.getByTestId('cb-suggest-rules-stopIf-meta')).not.toHaveTextContent(
      /gpt-4o-mini/,
    );
    expect(screen.getByTestId('cb-suggest-rules-stopIf-meta')).not.toHaveTextContent(
      /tokens/,
    );
    expect(screen.getByTestId('cb-suggest-rules-stopIf-meta')).not.toHaveTextContent(
      /USD/,
    );
  });

  it('Aplicar stopIf rellena el textarea de stopIf y oculta la tarjeta', async () => {
    suggestRulesAction.mockResolvedValueOnce(aiResponse);
    const user = userEvent.setup();
    render(
      <CampaignBriefForm
        mode="edit"
        initialBrief={baseBrief}
        services={services}
      />,
    );

    await user.click(screen.getByTestId('cb-suggest-rules'));

    const stopCard = await screen.findByTestId('cb-suggest-rules-stopIf');
    const applyButton = within(stopCard).getByRole('button', { name: /aplicar/i });
    await user.click(applyButton);

    const stopTextarea = screen.getByLabelText(/detener si/i) as HTMLTextAreaElement;
    expect(stopTextarea.value).toBe(aiResponse.stopIf);

    expect(screen.queryByTestId('cb-suggest-rules-stopIf')).not.toBeInTheDocument();
  });

  it('Descartar oculta la tarjeta de stopIf sin tocar el textarea', async () => {
    suggestRulesAction.mockResolvedValueOnce(aiResponse);
    const user = userEvent.setup();
    render(
      <CampaignBriefForm
        mode="edit"
        initialBrief={baseBrief}
        services={services}
      />,
    );

    await user.click(screen.getByTestId('cb-suggest-rules'));

    const stopCard = await screen.findByTestId('cb-suggest-rules-stopIf');
    const discardButton = within(stopCard).getByRole('button', { name: /descartar/i });
    await user.click(discardButton);

    expect(screen.queryByTestId('cb-suggest-rules-stopIf')).not.toBeInTheDocument();

    const stopTextarea = screen.getByLabelText(/detener si/i) as HTMLTextAreaElement;
    expect(stopTextarea.value).toBe('');
  });

  it('muestra mensaje accesible cuando la IA falla', async () => {
    suggestRulesAction.mockRejectedValueOnce(new Error('boom'));
    const user = userEvent.setup();
    render(
      <CampaignBriefForm
        mode="edit"
        initialBrief={baseBrief}
        services={services}
      />,
    );

    await user.click(screen.getByTestId('cb-suggest-rules'));

    const errorBanner = await screen.findByTestId('cb-suggest-rules-error');
    expect(errorBanner).toHaveAttribute('role', 'alert');
    expect(errorBanner).toHaveTextContent(
      /No pudimos analizar el objetivo\. Inténtalo más tarde\./,
    );

    expect(screen.queryByTestId('cb-suggest-rules-stopIf')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cb-suggest-rules-scaleIf')).not.toBeInTheDocument();
  });
});