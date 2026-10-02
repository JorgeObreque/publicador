import { useCallback, useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CopyStep } from './CopyStep';
import { createEmptyDraft } from '@/lib/campaigns/wizard';
import type { CampaignDraft } from '@/lib/campaigns/wizard';
import type { RecommendationResponse } from '@/lib/creatives/api';

jest.mock('@/app/campaigns/new/actions', () => ({
  requestCreativeRecommendationsAction: jest.fn(),
}));

const { requestCreativeRecommendationsAction } = jest.requireMock('@/app/campaigns/new/actions') as {
  requestCreativeRecommendationsAction: jest.Mock;
};

const sampleInitialResponse: RecommendationResponse = {
  mode: 'INITIAL',
  suggestions: [
    {
      primaryText: 'Balayage natural con profesionales. Agenda tu hora por WhatsApp.',
      headline: 'Reserva tu balayage',
    },
    {
      primaryText: 'Tu pelo, nuestras manos expertas. Escríbenos y reserva.',
      headline: 'Balayage a tu medida',
    },
    {
      primaryText: 'Mechas californianas con técnica impecable. Te esperamos por WhatsApp.',
      headline: 'Mechas perfectas',
    },
  ],
};

const samplePrimaryRegenResponse: RecommendationResponse = {
  mode: 'REGENERATE_PRIMARY_TEXT',
  suggestions: [
    { primaryText: 'Variante principal uno, agenda tu hora por WhatsApp.', headline: 'A' },
    { primaryText: 'Variante principal dos, escríbenos hoy.', headline: 'B' },
    { primaryText: 'Variante principal tres, reserva con un click.', headline: 'C' },
  ],
};

const sampleHeadlineRegenResponse: RecommendationResponse = {
  mode: 'REGENERATE_HEADLINE',
  suggestions: [
    { primaryText: 'P1', headline: 'Titular uno' },
    { primaryText: 'P2', headline: 'Titular dos' },
    { primaryText: 'P3', headline: 'Titular tres' },
  ],
};

interface RenderResult {
  onNext: jest.Mock;
  onPrevious: jest.Mock;
  capturedUpdaters: Array<(draft: CampaignDraft) => CampaignDraft>;
  getLatestDraft: () => CampaignDraft;
}

function renderCopyStep(initial: Partial<CampaignDraft> = {}): RenderResult {
  const capturedUpdaters: Array<(draft: CampaignDraft) => CampaignDraft> = [];
  const onNext = jest.fn();
  const onPrevious = jest.fn();
  let latest: CampaignDraft = { ...createEmptyDraft(), ...initial };

  function Harness() {
    const [draft, setDraft] = useState<CampaignDraft>(() => ({ ...createEmptyDraft(), ...initial }));
    latest = draft;
    const handleChange = useCallback((updater: (current: CampaignDraft) => CampaignDraft) => {
      capturedUpdaters.push(updater);
      setDraft((current) => {
        const next = updater(current);
        latest = next;
        return next;
      });
    }, []);
    return (
      <CopyStep
        draft={draft}
        issues={[]}
        onChange={handleChange}
        onNext={onNext}
        onPrevious={onPrevious}
      />
    );
  }

  render(<Harness />);

  return {
    onNext,
    onPrevious,
    capturedUpdaters,
    getLatestDraft: () => latest,
  };
}

beforeEach(() => {
  requestCreativeRecommendationsAction.mockReset();
});

describe('CopyStep', () => {
  it('muestra el botón Generar 3 propuestas con IA deshabilitado cuando faltan serviceId y mediaAssetId', () => {
    renderCopyStep();
    const button = screen.getByRole('button', { name: /generar 3 propuestas con ia/i });
    expect(button).toBeDisabled();
    expect(
      screen.getByText(/selecciona un servicio y una imagen antes de generar propuestas/i),
    ).toBeInTheDocument();
  });

  it('habilita el botón cuando hay servicio e imagen y muestra 3 tarjetas numeradas', async () => {
    requestCreativeRecommendationsAction.mockResolvedValueOnce(sampleInitialResponse);
    const user = userEvent.setup();
    renderCopyStep({ serviceId: 'svc-1', selectedMediaAssetId: 'img-1' });

    const button = screen.getByRole('button', { name: /generar 3 propuestas con ia/i });
    expect(button).not.toBeDisabled();

    await user.click(button);

    expect(requestCreativeRecommendationsAction).toHaveBeenCalledWith({
      mode: 'INITIAL',
      serviceId: 'svc-1',
      mediaAssetId: 'img-1',
      briefContext: undefined,
    });

    await waitFor(() => {
      expect(screen.getByText('Propuesta 1')).toBeInTheDocument();
    });
    expect(screen.getByText('Propuesta 2')).toBeInTheDocument();
    expect(screen.getByText('Propuesta 3')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /elegir esta propuesta/i })).toHaveLength(3);
    expect(requestCreativeRecommendationsAction).toHaveBeenCalledTimes(1);
  });

  it('elige una propuesta y actualiza el draft con los campos primaryText y headline', async () => {
    requestCreativeRecommendationsAction.mockResolvedValueOnce(sampleInitialResponse);
    const user = userEvent.setup();
    renderCopyStep({ serviceId: 'svc-1', selectedMediaAssetId: 'img-1' });

    await user.click(screen.getByRole('button', { name: /generar 3 propuestas con ia/i }));
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /elegir esta propuesta/i })).toHaveLength(3);
    });

    const pickButtons = screen.getAllByRole('button', { name: /elegir esta propuesta/i });
    await user.click(pickButtons[1]!);

    const latest = screen.getByDisplayValue(sampleInitialResponse.suggestions[1]!.headline);
    expect(latest).toBeInTheDocument();
    expect(
      screen.getByDisplayValue(sampleInitialResponse.suggestions[1]!.primaryText),
    ).toBeInTheDocument();
  });

  it('NO muestra los detalles (modelo, tokens y costo) tras elegir una propuesta', async () => {
    requestCreativeRecommendationsAction.mockResolvedValueOnce(sampleInitialResponse);
    const user = userEvent.setup();
    renderCopyStep({ serviceId: 'svc-1', selectedMediaAssetId: 'img-1' });

    await user.click(screen.getByRole('button', { name: /generar 3 propuestas con ia/i }));
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /elegir esta propuesta/i })).toHaveLength(3);
    });
    const picks = screen.getAllByRole('button', { name: /elegir esta propuesta/i });
    await user.click(picks[0]!);

    expect(screen.queryByText(/Modelo gpt-4o-mini/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Tokens prompt \d/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Costo estimado: USD/)).not.toBeInTheDocument();
  });

  it('regenera texto principal y actualiza solo primaryText en el draft', async () => {
    requestCreativeRecommendationsAction
      .mockResolvedValueOnce(sampleInitialResponse)
      .mockResolvedValueOnce(samplePrimaryRegenResponse);

    const user = userEvent.setup();
    renderCopyStep({ serviceId: 'svc-1', selectedMediaAssetId: 'img-1' });

    await user.click(screen.getByRole('button', { name: /generar 3 propuestas con ia/i }));
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /elegir esta propuesta/i })).toHaveLength(3);
    });
    const picks = screen.getAllByRole('button', { name: /elegir esta propuesta/i });
    await user.click(picks[0]!);

    const regenPrimary = screen.getByRole('button', { name: /regenerar texto principal/i });
    expect(regenPrimary).not.toBeDisabled();
    await user.click(regenPrimary);

    expect(requestCreativeRecommendationsAction).toHaveBeenNthCalledWith(2, {
      mode: 'REGENERATE_PRIMARY_TEXT',
      serviceId: 'svc-1',
      mediaAssetId: 'img-1',
      currentCopy: {
        primaryText: sampleInitialResponse.suggestions[0]!.primaryText,
        headline: sampleInitialResponse.suggestions[0]!.headline,
      },
      briefContext: undefined,
    });

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /usar esta alternativa/i })).toHaveLength(3);
    });

    const altButtons = screen.getAllByRole('button', { name: /usar esta alternativa/i });
    await user.click(altButtons[2]!);

    expect(
      screen.getByDisplayValue(samplePrimaryRegenResponse.suggestions[2]!.primaryText),
    ).toBeInTheDocument();
    expect(
      screen.getByDisplayValue(sampleInitialResponse.suggestions[0]!.headline),
    ).toBeInTheDocument();
  });

  it('regenera título y actualiza solo headline en el draft', async () => {
    requestCreativeRecommendationsAction
      .mockResolvedValueOnce(sampleInitialResponse)
      .mockResolvedValueOnce(sampleHeadlineRegenResponse);

    const user = userEvent.setup();
    renderCopyStep({ serviceId: 'svc-1', selectedMediaAssetId: 'img-1' });

    await user.click(screen.getByRole('button', { name: /generar 3 propuestas con ia/i }));
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /elegir esta propuesta/i })).toHaveLength(3);
    });
    const picks = screen.getAllByRole('button', { name: /elegir esta propuesta/i });
    await user.click(picks[0]!);

    const regenHeadline = screen.getByRole('button', { name: /regenerar título/i });
    expect(regenHeadline).not.toBeDisabled();
    await user.click(regenHeadline);

    expect(requestCreativeRecommendationsAction).toHaveBeenNthCalledWith(2, {
      mode: 'REGENERATE_HEADLINE',
      serviceId: 'svc-1',
      mediaAssetId: 'img-1',
      currentCopy: {
        primaryText: sampleInitialResponse.suggestions[0]!.primaryText,
        headline: sampleInitialResponse.suggestions[0]!.headline,
      },
      briefContext: undefined,
    });

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /usar esta alternativa/i })).toHaveLength(3);
    });

    const altButtons = screen.getAllByRole('button', { name: /usar esta alternativa/i });
    await user.click(altButtons[0]!);

    expect(
      screen.getByDisplayValue(sampleHeadlineRegenResponse.suggestions[0]!.headline),
    ).toBeInTheDocument();
    expect(
      screen.getByDisplayValue(sampleInitialResponse.suggestions[0]!.primaryText),
    ).toBeInTheDocument();
  });

  it('deshabilita el botón de regeneración tras usarlo y muestra el texto Regeneración utilizada', async () => {
    requestCreativeRecommendationsAction
      .mockResolvedValueOnce(sampleInitialResponse)
      .mockResolvedValueOnce(samplePrimaryRegenResponse);

    const user = userEvent.setup();
    renderCopyStep({ serviceId: 'svc-1', selectedMediaAssetId: 'img-1' });

    await user.click(screen.getByRole('button', { name: /generar 3 propuestas con ia/i }));
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /elegir esta propuesta/i })).toHaveLength(3);
    });
    const picks = screen.getAllByRole('button', { name: /elegir esta propuesta/i });
    await user.click(picks[0]!);

    await user.click(screen.getByRole('button', { name: /regenerar texto principal/i }));
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /usar esta alternativa/i })).toHaveLength(3);
    });
    const altButtons = screen.getAllByRole('button', { name: /usar esta alternativa/i });
    await user.click(altButtons[0]!);

    const usedButton = await screen.findByRole('button', { name: /regeneración utilizada/i });
    expect(usedButton).toBeDisabled();

    const otherButton = screen.getByRole('button', { name: /regenerar título/i });
    expect(otherButton).not.toBeDisabled();
  });

  it('permite regenerar título tras haber usado la regeneración de texto principal', async () => {
    requestCreativeRecommendationsAction
      .mockResolvedValueOnce(sampleInitialResponse)
      .mockResolvedValueOnce(samplePrimaryRegenResponse)
      .mockResolvedValueOnce(sampleHeadlineRegenResponse);

    const user = userEvent.setup();
    renderCopyStep({ serviceId: 'svc-1', selectedMediaAssetId: 'img-1' });

    await user.click(screen.getByRole('button', { name: /generar 3 propuestas con ia/i }));
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /elegir esta propuesta/i })).toHaveLength(3);
    });
    const picks = screen.getAllByRole('button', { name: /elegir esta propuesta/i });
    await user.click(picks[0]!);

    await user.click(screen.getByRole('button', { name: /regenerar texto principal/i }));
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /usar esta alternativa/i })).toHaveLength(3);
    });
    const altButtons1 = screen.getAllByRole('button', { name: /usar esta alternativa/i });
    await user.click(altButtons1[0]!);

    const headlineButton = screen.getByRole('button', { name: /regenerar título/i });
    expect(headlineButton).not.toBeDisabled();
    await user.click(headlineButton);

    await waitFor(() => {
      expect(requestCreativeRecommendationsAction).toHaveBeenCalledTimes(3);
    });
  });

  it('muestra el error y permite reintentar cuando la server action falla', async () => {
    requestCreativeRecommendationsAction
      .mockRejectedValueOnce(new Error('OPENAI_API_KEY no configurada'))
      .mockResolvedValueOnce(sampleInitialResponse);

    const user = userEvent.setup();
    renderCopyStep({ serviceId: 'svc-1', selectedMediaAssetId: 'img-1' });

    await user.click(screen.getByRole('button', { name: /generar 3 propuestas con ia/i }));
    await waitFor(() => {
      expect(screen.getByText('OPENAI_API_KEY no configurada')).toBeInTheDocument();
    });

    const retryButton = screen.getByRole('button', { name: /generar 3 propuestas con ia/i });
    expect(retryButton).not.toBeDisabled();

    await user.click(retryButton);
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /elegir esta propuesta/i })).toHaveLength(3);
    });
    expect(requestCreativeRecommendationsAction).toHaveBeenCalledTimes(2);
  });

  it('no muestra los banners informativos de propuestas ni de regeneración', () => {
    renderCopyStep();
    expect(
      screen.queryByText(
        /Las propuestas son sugerencias de la IA. Las puedes editar antes de guardarlas. La IA no publica ni pausa campañas automáticamente./i,
      ),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        /Solo puedes regenerar el texto o el título una vez por sesión. Mantén una propuesta que te guste para no perder tiempo./i,
      ),
    ).not.toBeInTheDocument();
  });

  it('permite editar manualmente los textareas como antes', async () => {
    const user = userEvent.setup();
    const { getLatestDraft } = renderCopyStep({ serviceId: 'svc-1', selectedMediaAssetId: 'img-1' });

    const primaryTextarea = screen.getByPlaceholderText(/balayage natural/i);
    await user.click(primaryTextarea);
    await user.keyboard('Hola');

    expect(getLatestDraft().primaryText).toBe('Hola');
  });
});
