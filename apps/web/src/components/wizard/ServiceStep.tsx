'use client';

import type { ServiceSummary } from '@/lib/services/api';
import type { CampaignDraft } from '@/lib/campaigns/wizard';
import { issueForField } from '@/lib/campaigns/wizard';
import type { ValidationIssue } from '@/lib/campaigns/wizard';
import { formatServicePrice } from '@/lib/services/format';

interface Props {
  services: ServiceSummary[];
  draft: CampaignDraft;
  issues: ValidationIssue[];
  onChange: (updater: (draft: CampaignDraft) => CampaignDraft) => void;
  onNext: () => void;
}

export function ServiceStep({ services, draft, issues, onChange, onNext }: Props) {
  const nameError = issueForField(issues, 'service', 'name');
  const serviceError = issueForField(issues, 'service', 'serviceId');
  const canContinue = !nameError && !serviceError && draft.name.trim().length > 0 && draft.serviceId;
  return (
    <section style={{ display: 'grid', gap: '1rem' }}>
      <header>
        <h2 style={{ margin: 0 }}>¿Qué quieres promocionar?</h2>
        <p style={{ margin: '0.25rem 0 0', color: '#52606d' }}>
          Elige el servicio y un nombre interno para identificar esta campaña.
        </p>
      </header>
      <FieldShell label="Nombre de la campaña" error={nameError}>
        <input
          type="text"
          value={draft.name}
          onChange={(event) => onChange((current) => ({ ...current, name: event.target.value }))}
          style={inputStyle}
          placeholder="Balayage Otoño"
          maxLength={120}
        />
      </FieldShell>
      <FieldShell label="Servicio a promocionar" error={serviceError}>
        <select
          value={draft.serviceId ?? ''}
          onChange={(event) =>
            onChange((current) => ({ ...current, serviceId: event.target.value || null }))
          }
          style={inputStyle}
        >
          <option value="">Selecciona un servicio…</option>
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {service.name} · {formatServicePrice(service)}
            </option>
          ))}
        </select>
      </FieldShell>
      <FieldShell label="Notas internas (opcional)" error={undefined}>
        <textarea
          value={draft.notes}
          onChange={(event) => onChange((current) => ({ ...current, notes: event.target.value }))}
          style={{ ...inputStyle, minHeight: '80px' }}
          maxLength={2000}
        />
      </FieldShell>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
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

const errorMessageStyle = {
  color: '#991b1b',
  fontSize: '0.85rem',
} as const;
