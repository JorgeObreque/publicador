'use client';

import type { CampaignDraft } from '@/lib/campaigns/wizard';
import { issueForField } from '@/lib/campaigns/wizard';
import type { ValidationIssue } from '@/lib/campaigns/wizard';

interface Props {
  draft: CampaignDraft;
  issues: ValidationIssue[];
  onChange: (updater: (draft: CampaignDraft) => CampaignDraft) => void;
  onNext: () => void;
  onPrevious: () => void;
}

const MAX_PRIMARY = 2000;
const MAX_HEADLINE = 80;
const MAX_DESCRIPTION = 2000;

export function CopyStep({ draft, issues, onChange, onNext, onPrevious }: Props) {
  const primaryError = issueForField(issues, 'copy', 'primaryText');
  const headlineError = issueForField(issues, 'copy', 'headline');
  const canContinue = !primaryError && !headlineError && draft.primaryText.trim() && draft.headline.trim();
  return (
    <section style={{ display: 'grid', gap: '1rem' }}>
      <header>
        <h2 style={{ margin: 0 }}>Escribe el anuncio</h2>
        <p style={{ margin: '0.25rem 0 0', color: '#52606d' }}>
          El botón se enviará por WhatsApp con un código de seguimiento automático.
        </p>
      </header>

      <FieldShell
        label={`Texto principal (${draft.primaryText.length}/${MAX_PRIMARY})`}
        error={primaryError}
      >
        <textarea
          value={draft.primaryText}
          onChange={(event) =>
            onChange((current) => ({ ...current, primaryText: event.target.value.slice(0, MAX_PRIMARY) }))
          }
          style={{ ...inputStyle, minHeight: '120px' }}
          placeholder="Balayage natural con profesionales. Reserva por WhatsApp."
        />
      </FieldShell>

      <FieldShell label={`Título (${draft.headline.length}/${MAX_HEADLINE})`} error={headlineError}>
        <input
          type="text"
          value={draft.headline}
          onChange={(event) =>
            onChange((current) => ({ ...current, headline: event.target.value.slice(0, MAX_HEADLINE) }))
          }
          style={inputStyle}
          placeholder="Reserva tu balayage"
        />
      </FieldShell>

      <FieldShell
        label={`Descripción opcional (${draft.description.length}/${MAX_DESCRIPTION})`}
        error={undefined}
      >
        <textarea
          value={draft.description}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              description: event.target.value.slice(0, MAX_DESCRIPTION),
            }))
          }
          style={{ ...inputStyle, minHeight: '80px' }}
        />
      </FieldShell>

      <div
        style={{
          border: '1px solid #e4e7eb',
          borderRadius: '12px',
          padding: '1rem',
          background: '#ffffff',
        }}
      >
        <p style={{ margin: 0, color: '#52606d', fontSize: '0.85rem' }}>Vista previa</p>
        <h3 style={{ margin: '0.25rem 0' }}>{draft.headline || 'Tu título aparecerá aquí'}</h3>
        <p style={{ margin: 0, color: '#3e4c59' }}>{draft.primaryText || 'El mensaje principal aparecerá aquí.'}</p>
        <p style={{ margin: '0.5rem 0 0', color: '#52606d', fontSize: '0.85rem' }}>Acción: Enviar mensaje por WhatsApp</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button type="button" onClick={onPrevious} style={secondaryButtonStyle}>
          Atrás
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!canContinue}
          style={{
            ...primaryButtonStyle,
            opacity: canContinue ? 1 : 0.5,
            cursor: canContinue ? 'pointer' : 'not-allowed',
          }}
        >
          Continuar
        </button>
      </div>
    </section>
  );
}

function FieldShell({
  label,
  error,
  children,
}: {
  label: string;
  error: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: 'grid', gap: '0.35rem' }}>
      <span>{label}</span>
      {children}
      {error && <span style={errorMessageStyle}>{error}</span>}
    </label>
  );
}

const inputStyle = {
  padding: '0.6rem 0.75rem',
  borderRadius: '8px',
  border: '1px solid #cbd2d9',
  fontSize: '1rem',
} as const;

const primaryButtonStyle = {
  padding: '0.65rem 1.25rem',
  borderRadius: '8px',
  border: 'none',
  background: '#1f2933',
  color: '#ffffff',
  fontSize: '1rem',
  cursor: 'pointer',
} as const;

const secondaryButtonStyle = {
  padding: '0.65rem 1.25rem',
  borderRadius: '8px',
  border: '1px solid #cbd2d9',
  background: '#ffffff',
  color: '#1f2933',
  fontSize: '1rem',
  cursor: 'pointer',
} as const;

const errorMessageStyle = {
  color: '#991b1b',
  fontSize: '0.85rem',
} as const;
