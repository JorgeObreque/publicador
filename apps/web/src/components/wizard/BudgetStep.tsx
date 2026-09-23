'use client';

import { formatCurrency } from '@/lib/format';
import type { CampaignDraft } from '@/lib/campaigns/wizard';
import { issueForField } from '@/lib/campaigns/wizard';
import type { ValidationIssue } from '@/lib/campaigns/wizard';

interface Props {
  draft: CampaignDraft;
  maxSpend: number | null;
  issues: ValidationIssue[];
  onChange: (updater: (draft: CampaignDraft) => CampaignDraft) => void;
  onNext: () => void;
  onPrevious: () => void;
}

const parseBudget = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
};

export function BudgetStep({ draft, maxSpend, issues, onChange, onNext, onPrevious }: Props) {
  const budgetError = issueForField(issues, 'budget', 'dailyBudget');
  const endDateError = issueForField(issues, 'budget', 'endDate');
  const budget = parseBudget(draft.dailyBudget);
  const canContinue = budget > 0 && !endDateError;
  return (
    <section style={{ display: 'grid', gap: '1rem' }}>
      <header>
        <h2 style={{ margin: 0 }}>Presupuesto y duración</h2>
        <p style={{ margin: '0.25rem 0 0', color: '#52606d' }}>
          Definimos un presupuesto diario. Meta no gastará más que eso en un día.
        </p>
      </header>

      <FieldShell label="Presupuesto diario (CLP)" error={budgetError}>
        <input
          type="number"
          min={1}
          step={1}
          value={draft.dailyBudget}
          onChange={(event) => onChange((current) => ({ ...current, dailyBudget: event.target.value }))}
          style={inputStyle}
        />
      </FieldShell>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <FieldShell label="Fecha de inicio" error={undefined}>
          <input
            type="date"
            value={draft.startDate}
            onChange={(event) => onChange((current) => ({ ...current, startDate: event.target.value }))}
            style={inputStyle}
          />
        </FieldShell>
        <FieldShell label="Fecha de término" error={endDateError}>
          <input
            type="date"
            value={draft.endDate}
            onChange={(event) => onChange((current) => ({ ...current, endDate: event.target.value }))}
            style={inputStyle}
          />
        </FieldShell>
      </div>

      <div
        style={{
          padding: '1rem',
          borderRadius: '12px',
          background: '#f1f5f9',
          color: '#1f2933',
        }}
      >
        <p style={{ margin: 0, color: '#52606d' }}>Gasto máximo estimado</p>
        <p style={{ margin: '0.25rem 0 0', fontSize: '1.4rem', fontWeight: 700 }}>
          {maxSpend !== null ? formatCurrency(maxSpend) : 'Define un presupuesto y un rango de fechas'}
        </p>
        <p style={{ margin: '0.5rem 0 0', color: '#52606d', fontSize: '0.85rem' }}>
          Es solo una estimación: gastar menos no garantiza menos resultados.
        </p>
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
