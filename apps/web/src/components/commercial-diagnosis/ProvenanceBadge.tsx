'use client';

import type { CommercialDataSource } from '@/lib/commercial-diagnosis/api';

const LABEL_BY_SOURCE: Record<CommercialDataSource, string> = {
  USER_PROFILE: 'Tu contexto',
  USER_CURRENT_SITUATION: 'Tu respuesta',
  AI_INFERENCE: 'Recomendación IA',
  SYSTEM_CALCULATION: 'Cálculo del sistema',
  AI_RECOMMENDATION: 'Recomendación IA',
  CAMPAIGN_OBSERVED_DATA: 'Datos de campañas',
};

const TONE_BY_SOURCE: Record<
  CommercialDataSource,
  { background: string; color: string }
> = {
  USER_PROFILE: { background: '#dcfce7', color: '#166534' },
  USER_CURRENT_SITUATION: { background: '#dcfce7', color: '#166534' },
  AI_INFERENCE: { background: '#e0e7ff', color: '#3730a3' },
  SYSTEM_CALCULATION: { background: '#e0e7ff', color: '#3730a3' },
  AI_RECOMMENDATION: { background: '#e0e7ff', color: '#3730a3' },
  CAMPAIGN_OBSERVED_DATA: { background: '#e0e7ff', color: '#3730a3' },
};

interface Props {
  source: CommercialDataSource;
}

export function ProvenanceBadge({ source }: Props) {
  const tone = TONE_BY_SOURCE[source];
  return (
    <span
      data-testid="cdf-provenance-badge"
      data-source={source}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.15rem 0.5rem',
        borderRadius: '999px',
        background: tone.background,
        color: tone.color,
        fontSize: '0.75rem',
        fontWeight: 600,
      }}
    >
      {LABEL_BY_SOURCE[source]}
    </span>
  );
}