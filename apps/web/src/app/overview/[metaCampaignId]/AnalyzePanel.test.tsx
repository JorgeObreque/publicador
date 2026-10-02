import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AnalyzePanel } from './AnalyzePanel';
import type { AnalyzeRunResult } from '@/lib/overview/api';

jest.mock('./actions', () => ({
  analyzeCampaignAction: jest.fn(),
}));

const { analyzeCampaignAction } = jest.requireMock('./actions') as {
  analyzeCampaignAction: jest.Mock;
};

const sampleResult: AnalyzeRunResult = {
  campaignId: 'cmp-1',
  periodFrom: '2026-09-01',
  periodTo: '2026-09-30',
  analysis: {
    summary: 'CTR bajo con buen CPC',
    diagnosis: 'El anuncio A muestra CTR bajo sostenido en los últimos 14 días.',
    action: 'CREATE_VARIANT',
    recommendedVariable: 'PRIMARY_TEXT',
    confidence: 'MEDIUM',
    evidence: [
      'CTR promedio 0,8% vs cuenta 1,4%',
      'CPC dentro del rango esperado',
      'Resultados estables en el período',
    ],
    caveats: ['Sólo 14 días con datos diarios'],
    recommendedNextStep: 'Probar un texto principal con propuesta de valor más concreta.',
  },
};

beforeEach(() => {
  analyzeCampaignAction.mockReset();
});

describe('AnalyzePanel', () => {
  it('renderiza el botón Analizar con IA', () => {
    render(<AnalyzePanel metaCampaignId="cmp-1" periodDays={30} />);
    expect(screen.getByRole('button', { name: /analizar con ia/i })).toBeInTheDocument();
  });

  it('muestra el análisis tras una respuesta exitosa', async () => {
    analyzeCampaignAction.mockResolvedValueOnce(sampleResult);
    const user = userEvent.setup();
    render(<AnalyzePanel metaCampaignId="cmp-1" periodDays={30} />);

    await user.click(screen.getByRole('button', { name: /analizar con ia/i }));

    expect(analyzeCampaignAction).toHaveBeenCalledWith('cmp-1', 30);

    await waitFor(() => {
      expect(screen.getByText('CTR bajo con buen CPC')).toBeInTheDocument();
    });
    expect(screen.getByText(/Crear variante/i)).toBeInTheDocument();
    expect(screen.getByText(/Variable a probar: Texto principal/i)).toBeInTheDocument();
    expect(screen.getByText(/Próximo paso recomendado/i)).toBeInTheDocument();
    expect(screen.getByText(/Confianza Media/i)).toBeInTheDocument();
    expect(analyzeCampaignAction).toHaveBeenCalledTimes(1);
  });

  it('no muestra línea de modelo ni de tokens tras el análisis', async () => {
    analyzeCampaignAction.mockResolvedValueOnce(sampleResult);
    const user = userEvent.setup();
    render(<AnalyzePanel metaCampaignId="cmp-1" periodDays={30} />);

    await user.click(screen.getByRole('button', { name: /analizar con ia/i }));

    await waitFor(() => {
      expect(screen.getByText('CTR bajo con buen CPC')).toBeInTheDocument();
    });

    expect(screen.queryByText(/ver detalles técnicos/i)).not.toBeInTheDocument();
    expect(document.querySelector('details')).toBeNull();
    expect(screen.queryByText(/Modelo:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Tokens \d+/)).not.toBeInTheDocument();
  });

  it('permite cerrar el resultado y volver a mostrar el botón inicial', async () => {
    analyzeCampaignAction.mockResolvedValueOnce(sampleResult);
    const user = userEvent.setup();
    render(<AnalyzePanel metaCampaignId="cmp-1" periodDays={30} />);

    await user.click(screen.getByRole('button', { name: /analizar con ia/i }));

    await waitFor(() => {
      expect(screen.getByText('CTR bajo con buen CPC')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /cerrar/i }));

    expect(screen.queryByText('CTR bajo con buen CPC')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /analizar con ia/i })).toBeInTheDocument();
  });

  it('traduce el error OPENAI_API_KEY no configurada a un mensaje visible', async () => {
    analyzeCampaignAction.mockRejectedValueOnce(new Error('OPENAI_API_KEY no configurada'));
    const user = userEvent.setup();
    render(<AnalyzePanel metaCampaignId="cmp-1" periodDays={30} />);

    await user.click(screen.getByRole('button', { name: /analizar con ia/i }));

    await waitFor(() => {
      expect(screen.getByText('No pudimos contactar el servicio de análisis. Inténtalo más tarde o revisa la configuración técnica.')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /analizar con ia/i })).toBeInTheDocument();
  });

  it('no muestra el banner informativo sobre IA', () => {
    render(<AnalyzePanel metaCampaignId="cmp-1" periodDays={30} />);
    expect(
      screen.queryByText(
        /Esta sugerencia es informativa. Publicador no modifica, activa ni pausa campañas automáticamente./i,
      ),
    ).not.toBeInTheDocument();
  });

  it('traduce las etiquetas LOW/MEDIUM/HIGH a Confianza Baja/Media/Alta', async () => {
    analyzeCampaignAction.mockResolvedValueOnce({
      ...sampleResult,
      analysis: { ...sampleResult.analysis, confidence: 'HIGH' },
    });
    const user = userEvent.setup();
    render(<AnalyzePanel metaCampaignId="cmp-1" periodDays={30} />);
    await user.click(screen.getByRole('button', { name: /analizar con ia/i }));
    await waitFor(() => {
      expect(screen.getByText('Confianza Alta')).toBeInTheDocument();
    });
  });
});
