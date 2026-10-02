'use client';

import { useState } from 'react';
import { analyzeCampaignAction } from './actions';
import type { AnalyzeRunResult, PerformanceAnalysis } from '@/lib/overview/api';

interface Props {
  metaCampaignId: string;
  periodDays: 7 | 30 | 90;
}

const ACTION_LABEL: Record<PerformanceAnalysis['action'], string> = {
  WAIT: 'Esperar y seguir observando',
  KEEP: 'Mantener campaña activa',
  CREATE_VARIANT: 'Crear variante',
  REVIEW_CONVERSION: 'Revisar conversión',
  NEEDS_MORE_DATA: 'Necesita más datos',
};

const VARIABLE_LABEL: Record<PerformanceAnalysis['recommendedVariable'], string> = {
  PRIMARY_TEXT: 'Texto principal',
  HEADLINE: 'Titular',
  IMAGE: 'Imagen',
  BUDGET: 'Presupuesto',
  TARGETING: 'Segmentación',
  NONE: 'Sin cambios sugeridos',
};

const CONFIDENCE_LABEL: Record<PerformanceAnalysis['confidence'], string> = {
  LOW: 'Confianza Baja',
  MEDIUM: 'Confianza Media',
  HIGH: 'Confianza Alta',
};

const CONFIDENCE_TONE: Record<PerformanceAnalysis['confidence'], { bg: string; fg: string }> = {
  LOW: { bg: '#fee2e2', fg: '#991b1b' },
  MEDIUM: { bg: '#fef3c7', fg: '#92400e' },
  HIGH: { bg: '#dcfce7', fg: '#166534' },
};

const TRANSLATED_ERROR_MESSAGE =
  'No pudimos contactar el servicio de análisis. Inténtalo más tarde o revisa la configuración técnica.';

function translateError(raw: string | null): string | null {
  if (!raw) return null;
  if (raw.toLowerCase().includes('openai_api_key')) {
    return TRANSLATED_ERROR_MESSAGE;
  }
  return raw;
}

export function AnalyzePanel({ metaCampaignId, periodDays }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeRunResult | null>(null);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    try {
      const run = await analyzeCampaignAction(metaCampaignId, periodDays);
      setResult(run);
    } catch (err) {
      setError(translateError((err as Error).message));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    setError(null);
  };

  if (result) {
    const tone = CONFIDENCE_TONE[result.analysis.confidence];
    return (
      <section
        style={{
          display: 'grid',
          gap: '0.75rem',
          padding: '1rem',
          borderRadius: '12px',
          border: '1px solid #e4e7eb',
          background: '#ffffff',
        }}
      >
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
          <div>
            <h3 style={{ margin: 0 }}>Análisis con IA</h3>
            <p style={{ margin: '0.25rem 0 0', color: '#52606d', fontSize: '0.85rem' }}>
              {result.analysis.summary}
            </p>
          </div>
          <span
            style={{
              padding: '0.25rem 0.6rem',
              borderRadius: '999px',
              background: tone.bg,
              color: tone.fg,
              fontSize: '0.8rem',
              fontWeight: 600,
            }}
          >
            {CONFIDENCE_LABEL[result.analysis.confidence]}
          </span>
        </header>

        <p style={{ margin: 0, color: '#3e4c59' }}>{result.analysis.diagnosis}</p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <span style={chipStyle('#1f2933', '#ffffff')}>
            Acción: {ACTION_LABEL[result.analysis.action]}
          </span>
          <span style={chipStyle('#e0e7ff', '#3730a3')}>
            Variable a probar: {VARIABLE_LABEL[result.analysis.recommendedVariable]}
          </span>
        </div>

        <div>
          <p style={{ margin: '0 0 0.25rem', color: '#52606d', fontSize: '0.85rem' }}>Evidencia</p>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#3e4c59' }}>
            {result.analysis.evidence.map((item) => (
              <li key={item} style={{ marginBottom: '0.25rem' }}>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {result.analysis.caveats.length > 0 && (
          <div>
            <p style={{ margin: '0 0 0.25rem', color: '#52606d', fontSize: '0.85rem' }}>Advertencias</p>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#3e4c59' }}>
              {result.analysis.caveats.map((item) => (
                <li key={item} style={{ marginBottom: '0.25rem' }}>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div
          style={{
            padding: '0.75rem',
            borderRadius: '8px',
            background: '#f0f4f8',
            border: '1px solid #e4e7eb',
          }}
        >
          <p style={{ margin: '0 0 0.25rem', color: '#52606d', fontSize: '0.85rem' }}>Próximo paso recomendado</p>
          <p style={{ margin: 0, color: '#1f2933', fontWeight: 600 }}>{result.analysis.recommendedNextStep}</p>
        </div>

        <div>
          <button type="button" onClick={handleClose} style={secondaryButtonStyle}>
            Cerrar
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      style={{
        display: 'grid',
        gap: '0.5rem',
        padding: '1rem',
        borderRadius: '12px',
        border: '1px solid #e4e7eb',
        background: '#ffffff',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0 }}>Análisis con IA</h3>
          <p style={{ margin: '0.25rem 0 0', color: '#52606d', fontSize: '0.85rem' }}>
            Pedimos a Publicador (gpt-4o-mini) un diagnóstico del rendimiento de los últimos {periodDays} días.
          </p>
        </div>
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={loading}
          style={{
            ...primaryButtonStyle,
            opacity: loading ? 0.6 : 1,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Analizando…' : 'Analizar con IA'}
        </button>
      </div>
      {error && <p style={errorStyle}>{error}</p>}
    </section>
  );
}

const primaryButtonStyle = {
  padding: '0.6rem 1.1rem',
  borderRadius: '8px',
  border: '1px solid #1f2933',
  background: '#1f2933',
  color: '#ffffff',
  fontSize: '0.95rem',
} as const;

const secondaryButtonStyle = {
  padding: '0.5rem 0.9rem',
  borderRadius: '8px',
  border: '1px solid #cbd2d9',
  background: '#ffffff',
  color: '#1f2933',
  fontSize: '0.9rem',
  cursor: 'pointer',
} as const;

const errorStyle = {
  margin: 0,
  color: '#991b1b',
  background: '#fee2e2',
  padding: '0.75rem',
  borderRadius: '8px',
} as const;

const chipStyle = (bg: string, fg: string) => ({
  padding: '0.3rem 0.7rem',
  borderRadius: '999px',
  background: bg,
  color: fg,
  fontSize: '0.8rem',
  fontWeight: 600,
}) as const;
