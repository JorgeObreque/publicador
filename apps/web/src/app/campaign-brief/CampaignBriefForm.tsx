'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ServiceSummary } from '@/lib/services/api';
import type {
  CampaignBrief,
  CampaignBriefPayload,
  SuggestRulesResponse,
} from '@/lib/campaign-brief/api';
import {
  approveCampaignBriefAction,
  archiveCampaignBriefAction,
  createCampaignBriefAction,
  suggestRulesAction,
  updateCampaignBriefAction,
} from './actions';

type ArrayField = 'qualifyingQuestions' | 'constraints';

interface Props {
  mode: 'create' | 'edit';
  initialBrief?: CampaignBrief | null;
  services: ServiceSummary[];
  prefill?: Partial<CampaignBriefPayload> | null;
  defaultServiceId?: string | null;
}

interface FormState {
  title: string;
  serviceId: string;
  businessObjective: string;
  offer: string;
  primaryKpi: string;
  idealCustomerProfile: string;
  qualifyingQuestions: string[];
  constraints: string[];
  stopIf: string;
  scaleIf: string;
  monthlyAcquisitionGoal: string;
  costPerAcquisitionCap: string;
  lifetimeBudgetCap: string;
  dailyBudgetCap: string;
  plannedDurationDays: string;
}

const inputStyle: React.CSSProperties = {
  padding: '0.5rem 0.65rem',
  borderRadius: '8px',
  border: '1px solid #cbd2d9',
  fontSize: '0.9rem',
  width: '100%',
  boxSizing: 'border-box',
  background: '#ffffff',
  color: '#1f2933',
};

const labelTextStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: '#52606d',
  display: 'block',
};

const sectionStyle: React.CSSProperties = {
  border: '1px solid #e4e7eb',
  borderRadius: '12px',
  padding: '1rem',
  background: '#ffffff',
  display: 'grid',
  gap: '0.75rem',
};

const clpFormatter = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

function formatClp(raw: string): string {
  if (raw.trim().length === 0) return '';
  const num = Number(raw);
  if (!Number.isFinite(num)) return raw;
  return clpFormatter.format(num);
}

function fromBrief(brief: CampaignBrief | null | undefined): FormState {
  return {
    title: brief?.title ?? '',
    serviceId: brief?.serviceId ?? '',
    businessObjective: brief?.businessObjective ?? '',
    offer: brief?.offer ?? '',
    primaryKpi: brief?.primaryKpi ?? '',
    idealCustomerProfile: brief?.idealCustomerProfile ?? '',
    qualifyingQuestions: [...(brief?.qualifyingQuestions ?? [])],
    constraints: [...(brief?.constraints ?? [])],
    stopIf: brief?.stopIf ?? '',
    scaleIf: brief?.scaleIf ?? '',
    monthlyAcquisitionGoal:
      brief?.monthlyAcquisitionGoal !== null &&
      brief?.monthlyAcquisitionGoal !== undefined
        ? String(brief.monthlyAcquisitionGoal)
        : '',
    costPerAcquisitionCap: brief?.costPerAcquisitionCap ?? '',
    lifetimeBudgetCap: brief?.lifetimeBudgetCap ?? '',
    dailyBudgetCap: brief?.dailyBudgetCap ?? '',
    plannedDurationDays:
      brief?.plannedDurationDays !== null &&
      brief?.plannedDurationDays !== undefined
        ? String(brief.plannedDurationDays)
        : '',
  };
}

function applyPrefill(
  state: FormState,
  prefill: Partial<CampaignBriefPayload> | null | undefined,
  defaultServiceId?: string | null,
): FormState {
  if (!prefill && !defaultServiceId) return state;
  return {
    ...state,
    ...(defaultServiceId ? { serviceId: defaultServiceId } : {}),
    ...(prefill?.title ? { title: prefill.title } : {}),
    ...(prefill?.businessObjective
      ? { businessObjective: prefill.businessObjective }
      : {}),
    ...(prefill?.offer ? { offer: prefill.offer } : {}),
    ...(prefill?.primaryKpi ? { primaryKpi: prefill.primaryKpi } : {}),
    ...(prefill?.idealCustomerProfile !== undefined
      ? { idealCustomerProfile: prefill.idealCustomerProfile ?? '' }
      : {}),
    ...(prefill?.qualifyingQuestions
      ? { qualifyingQuestions: prefill.qualifyingQuestions }
      : {}),
    ...(prefill?.constraints ? { constraints: prefill.constraints } : {}),
    ...(prefill?.stopIf !== undefined ? { stopIf: prefill.stopIf ?? '' } : {}),
    ...(prefill?.scaleIf !== undefined ? { scaleIf: prefill.scaleIf ?? '' } : {}),
  };
}

function buildPayload(state: FormState): CampaignBriefPayload {
  const trimOrUndef = (v: string): string | undefined => {
    const t = v.trim();
    return t.length > 0 ? t : undefined;
  };
  const numOrUndef = (v: string): number | undefined => {
    const t = v.trim();
    if (t.length === 0) return undefined;
    const n = Number(t);
    return Number.isFinite(n) ? n : undefined;
  };
  return {
    title: state.title.trim(),
    serviceId: state.serviceId.trim(),
    businessObjective: state.businessObjective.trim(),
    offer: state.offer.trim(),
    primaryKpi: state.primaryKpi.trim(),
    idealCustomerProfile: trimOrUndef(state.idealCustomerProfile),
    qualifyingQuestions: state.qualifyingQuestions,
    constraints: state.constraints,
    stopIf: trimOrUndef(state.stopIf),
    scaleIf: trimOrUndef(state.scaleIf),
    monthlyAcquisitionGoal: numOrUndef(state.monthlyAcquisitionGoal),
    costPerAcquisitionCap: numOrUndef(state.costPerAcquisitionCap),
    lifetimeBudgetCap: numOrUndef(state.lifetimeBudgetCap),
    dailyBudgetCap: numOrUndef(state.dailyBudgetCap),
    plannedDurationDays: numOrUndef(state.plannedDurationDays),
  };
}

function readinessReport(state: FormState): {
  ready: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  if (state.title.trim().length === 0) missing.push('Nombre del plan');
  if (state.serviceId.trim().length === 0) missing.push('Servicio');
  if (state.businessObjective.trim().length === 0)
    missing.push('Qué resultado quieres conseguir');
  if (state.offer.trim().length === 0)
    missing.push('Qué le vas a proponer exactamente');
  if (state.primaryKpi.trim().length === 0)
    missing.push('Cómo sabremos si funciona');
  return { ready: missing.length === 0, missing };
}

export function CampaignBriefForm({
  mode,
  initialBrief,
  services,
  prefill,
  defaultServiceId,
}: Props) {
  const router = useRouter();
  const [state, setState] = useState<FormState>(() =>
    applyPrefill(
      fromBrief(initialBrief ?? null),
      prefill ?? null,
      defaultServiceId ?? null,
    ),
  );
  const [chipInputs, setChipInputs] = useState<Record<ArrayField, string>>({
    qualifyingQuestions: '',
    constraints: '',
  });
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [suggestion, setSuggestion] = useState<SuggestRulesResponse | null>(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [discarded, setDiscarded] = useState<{ stopIf: boolean; scaleIf: boolean }>({
    stopIf: false,
    scaleIf: false,
  });

  const readiness = useMemo(() => readinessReport(state), [state]);

  const setField =
    (key: keyof FormState) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ): void => {
      const value = e.target.value;
      setState((s) => ({ ...s, [key]: value }));
    };

  const setMoneyField =
    (
      key:
        | 'costPerAcquisitionCap'
        | 'lifetimeBudgetCap'
        | 'dailyBudgetCap',
    ) =>
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      const raw = e.target.value.replace(/[^\d]/g, '');
      setState((s) => ({ ...s, [key]: raw }));
    };

  const addChip = (field: ArrayField) => {
    const value = chipInputs[field].trim();
    if (value.length === 0) return;
    setState((s) => ({ ...s, [field]: [...s[field], value] }));
    setChipInputs((c) => ({ ...c, [field]: '' }));
  };

  const removeChip = (field: ArrayField, tag: string) => {
    setState((s) => ({ ...s, [field]: s[field].filter((t) => t !== tag) }));
  };

  const persistCurrent = async (): Promise<CampaignBrief | null> => {
    const payload = buildPayload(state);
    if (mode === 'create') {
      return createCampaignBriefAction(payload);
    }
    if (initialBrief) {
      return updateCampaignBriefAction(initialBrief.id, payload);
    }
    return null;
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (state.title.trim().length < 3) {
      setError('El nombre del plan debe tener al menos 3 caracteres.');
      return;
    }
    setSaving(true);
    try {
      const saved = await persistCurrent();
      setToast('Plan guardado');
      if (saved && mode === 'edit') setState(fromBrief(saved));
      router.refresh();
      setTimeout(() => setToast(null), 4000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const onCreateAndApprove = async () => {
    setError(null);
    setApproving(true);
    try {
      const saved = await persistCurrent();
      if (!saved) throw new Error('No se pudo guardar el plan');
      if (saved.status !== 'APPROVED') {
        const approved = await approveCampaignBriefAction(saved.id);
        setState(fromBrief(approved));
      } else {
        setState(fromBrief(saved));
      }
      setToast('Plan guardado y aprobado');
      router.replace(`/campaign-brief/${saved.id}`);
      router.refresh();
      setTimeout(() => setToast(null), 4000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setApproving(false);
    }
  };

  const onApprove = async () => {
    if (!initialBrief) return;
    setError(null);
    setApproving(true);
    try {
      await updateCampaignBriefAction(initialBrief.id, buildPayload(state));
      const approved = await approveCampaignBriefAction(initialBrief.id);
      setState(fromBrief(approved));
      setToast('Plan aprobado');
      router.refresh();
      setTimeout(() => setToast(null), 4000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setApproving(false);
    }
  };

  const onArchive = async () => {
    if (!initialBrief) return;
    setError(null);
    try {
      const archived = await archiveCampaignBriefAction(initialBrief.id);
      setState(fromBrief(archived));
      setToast('Plan archivado');
      router.refresh();
      setTimeout(() => setToast(null), 4000);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const briefId = initialBrief?.id ?? null;
  const suggestionDisabledReason = useMemo(() => {
    if (loadingSuggestion) return 'Analizando…';
    if (!briefId) return 'Guarda el plan antes de analizar el objetivo.';
    const missing: string[] = [];
    if (state.title.trim().length === 0) missing.push('nombre del plan');
    if (state.businessObjective.trim().length === 0) missing.push('objetivo comercial');
    if (state.offer.trim().length === 0) missing.push('oferta');
    if (missing.length > 0) {
      return `Completa ${missing.join(', ')} para analizar.`;
    }
    return null;
  }, [loadingSuggestion, briefId, state.title, state.businessObjective, state.offer]);

  const onSuggestRules = async () => {
    if (!briefId) return;
    setError(null);
    setSuggestionError(null);
    setSuggestion(null);
    setDiscarded({ stopIf: false, scaleIf: false });
    setLoadingSuggestion(true);
    try {
      const result = await suggestRulesAction(briefId);
      setSuggestion(result);
    } catch (err) {
      setSuggestion(null);
      setSuggestionError(
        'No pudimos analizar el objetivo. Inténtalo más tarde.',
      );
      void err;
    } finally {
      setLoadingSuggestion(false);
    }
  };

  const onApplyRule = (
    field: 'stopIf' | 'scaleIf',
    value: string,
  ): void => {
    setState((s) => ({ ...s, [field]: value }));
    setDiscarded((d) => ({ ...d, [field]: true }));
  };

  const onDiscardRule = (field: 'stopIf' | 'scaleIf'): void => {
    setDiscarded((d) => ({ ...d, [field]: true }));
  };

  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: '1rem' }}>
      <StatusBanner readiness={readiness} />

      {toast && (
        <p
          role="status"
          style={{
            background: '#dcfce7',
            color: '#166534',
            padding: '0.75rem',
            borderRadius: '8px',
            margin: 0,
          }}
        >
          {toast}
        </p>
      )}

      {error && (
        <p
          role="alert"
          style={{
            background: '#fee2e2',
            color: '#991b1b',
            padding: '0.75rem',
            borderRadius: '8px',
            margin: 0,
          }}
        >
          {error}
        </p>
      )}

      <IdentitySection state={state} setField={setField} services={services} />

      <ObjectiveSection
        state={state}
        setField={setField}
        canSuggest={suggestionDisabledReason === null}
        disabledReason={suggestionDisabledReason}
        loadingSuggestion={loadingSuggestion}
        suggestion={suggestion}
        suggestionError={suggestionError}
        discarded={discarded}
        onSuggest={onSuggestRules}
        onApplyRule={onApplyRule}
        onDiscardRule={onDiscardRule}
      />

      <DecisionRulesSection state={state} setField={setField} />

      <ChipsSection
        field="qualifyingQuestions"
        label="Preguntas de calificación"
        state={state}
        chipInput={chipInputs.qualifyingQuestions}
        onInputChange={(v) =>
          setChipInputs((c) => ({ ...c, qualifyingQuestions: v }))
        }
        onAdd={() => addChip('qualifyingQuestions')}
        onRemove={(tag) => removeChip('qualifyingQuestions', tag)}
      />

      <ChipsSection
        field="constraints"
        label="Cosas que la campaña no debe hacer"
        state={state}
        chipInput={chipInputs.constraints}
        onInputChange={(v) => setChipInputs((c) => ({ ...c, constraints: v }))}
        onAdd={() => addChip('constraints')}
        onRemove={(tag) => removeChip('constraints', tag)}
      />

      <BudgetSection
        state={state}
        setField={setField}
        setMoneyField={setMoneyField}
        formatClp={formatClp}
      />

      <ActionsBar
        mode={mode}
        initialBrief={initialBrief}
        saving={saving}
        approving={approving}
        ready={readiness.ready}
        onCreateAndApprove={onCreateAndApprove}
        onApprove={onApprove}
        onArchive={onArchive}
      />
    </form>
  );
}

function StatusBanner({
  readiness,
}: {
  readiness: { ready: boolean; missing: string[] };
}) {
  const containerStyle: React.CSSProperties = {
    padding: '0.75rem 1rem',
    borderRadius: '12px',
    border: '1px solid #e4e7eb',
    background: readiness.ready ? '#dcfce7' : '#fff7ed',
    color: readiness.ready ? '#166534' : '#9a3412',
    margin: 0,
    display: 'grid',
    gap: '0.25rem',
  };
  return (
    <div role="status" style={containerStyle}>
      {readiness.ready ? (
        <strong style={{ margin: 0 }}>Plan listo para aprobar</strong>
      ) : (
        <strong style={{ margin: 0 }}>
          Faltan {readiness.missing.length} campos para aprobar:{' '}
          {readiness.missing.join(', ')}
        </strong>
      )}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} style={{ display: 'grid', gap: '0.25rem' }}>
      <span style={labelTextStyle}>
        {label}
        {required ? ' *' : ''}
      </span>
      {children}
    </label>
  );
}

function IdentitySection({
  state,
  setField,
  services,
}: {
  state: FormState;
  setField: (
    key: keyof FormState,
  ) => (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => void;
  services: ServiceSummary[];
}) {
  return (
    <section style={sectionStyle}>
      <h3 style={{ margin: 0, fontSize: '1rem' }}>Identidad</h3>
      <Field label="Nombre del plan" htmlFor="cb-title" required>
        <input
          id="cb-title"
          type="text"
          value={state.title}
          onChange={setField('title')}
          style={inputStyle}
          maxLength={120}
          data-testid="cb-title"
        />
      </Field>
      <Field label="Servicio" htmlFor="cb-serviceId" required>
        <select
          id="cb-serviceId"
          value={state.serviceId}
          onChange={setField('serviceId')}
          style={inputStyle}
          data-testid="cb-serviceId"
        >
          <option value="">Selecciona un servicio</option>
          {services.map((svc) => (
            <option key={svc.id} value={svc.id}>
              {svc.name}
            </option>
          ))}
        </select>
      </Field>
    </section>
  );
}

function ObjectiveSection({
  state,
  setField,
  canSuggest,
  disabledReason,
  loadingSuggestion,
  suggestion,
  suggestionError,
  discarded,
  onSuggest,
  onApplyRule,
  onDiscardRule,
}: {
  state: FormState;
  setField: (
    key: keyof FormState,
  ) => (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => void;
  canSuggest: boolean;
  disabledReason: string | null;
  loadingSuggestion: boolean;
  suggestion: SuggestRulesResponse | null;
  suggestionError: string | null;
  discarded: { stopIf: boolean; scaleIf: boolean };
  onSuggest: () => void;
  onApplyRule: (field: 'stopIf' | 'scaleIf', value: string) => void;
  onDiscardRule: (field: 'stopIf' | 'scaleIf') => void;
}) {
  return (
    <section style={sectionStyle} aria-label="Objetivo comercial">
      <h3 style={{ margin: 0, fontSize: '1rem' }}>Objetivo comercial</h3>
      <Field
        label="Qué resultado quieres conseguir"
        htmlFor="cb-objective"
        required
      >
        <textarea
          id="cb-objective"
          value={state.businessObjective}
          onChange={setField('businessObjective')}
          style={{ ...inputStyle, minHeight: '4rem', fontFamily: 'inherit' }}
          maxLength={1000}
          data-testid="cb-objective"
        />
      </Field>
      <Field
        label="Qué le vas a proponer exactamente"
        htmlFor="cb-offer"
        required
      >
        <textarea
          id="cb-offer"
          value={state.offer}
          onChange={setField('offer')}
          style={{ ...inputStyle, minHeight: '4rem', fontFamily: 'inherit' }}
          maxLength={1000}
          data-testid="cb-offer"
        />
      </Field>
      <Field
        label="Cómo sabremos si funciona"
        htmlFor="cb-kpi"
        required
      >
        <input
          id="cb-kpi"
          type="text"
          value={state.primaryKpi}
          onChange={setField('primaryKpi')}
          style={inputStyle}
          maxLength={80}
          data-testid="cb-kpi"
        />
      </Field>
      <Field
        label="Persona a la que quieres atraer"
        htmlFor="cb-idealCustomer"
      >
        <textarea
          id="cb-idealCustomer"
          value={state.idealCustomerProfile}
          onChange={setField('idealCustomerProfile')}
          style={{ ...inputStyle, minHeight: '3.5rem', fontFamily: 'inherit' }}
          maxLength={2000}
        />
      </Field>

      <SuggestRulesSubsection
        canSuggest={canSuggest}
        disabledReason={disabledReason}
        loading={loadingSuggestion}
        suggestion={suggestion}
        suggestionError={suggestionError}
        discarded={discarded}
        onSuggest={onSuggest}
        onApplyRule={onApplyRule}
        onDiscardRule={onDiscardRule}
      />
    </section>
  );
}

function SuggestRulesSubsection({
  canSuggest,
  disabledReason,
  loading,
  suggestion,
  suggestionError,
  discarded,
  onSuggest,
  onApplyRule,
  onDiscardRule,
}: {
  canSuggest: boolean;
  disabledReason: string | null;
  loading: boolean;
  suggestion: SuggestRulesResponse | null;
  suggestionError: string | null;
  discarded: { stopIf: boolean; scaleIf: boolean };
  onSuggest: () => void;
  onApplyRule: (field: 'stopIf' | 'scaleIf', value: string) => void;
  onDiscardRule: (field: 'stopIf' | 'scaleIf') => void;
}) {
  const showStop = suggestion !== null && !discarded.stopIf;
  const showScale = suggestion !== null && !discarded.scaleIf;
  const metaLine = (s: SuggestRulesResponse): string => {
    return s.source === 'AI' ? 'IA' : 'plantilla';
  };
  return (
    <div style={{ display: 'grid', gap: '0.5rem' }}>
      <button
        type="button"
        onClick={onSuggest}
        disabled={!canSuggest}
        aria-disabled={!canSuggest}
        title={disabledReason ?? undefined}
        data-testid="cb-suggest-rules"
        style={{
          alignSelf: 'flex-start',
          padding: '0.55rem 1rem',
          borderRadius: '8px',
          border: '1px solid #1f2933',
          background: canSuggest ? '#1f2933' : '#cbd2d9',
          color: canSuggest ? '#ffffff' : '#52606d',
          cursor: canSuggest ? 'pointer' : 'not-allowed',
          opacity: canSuggest ? 1 : 0.85,
        }}
      >
        {loading ? 'Analizando…' : 'Analizar objetivo comercial con IA'}
      </button>

      {disabledReason && !loading && (
        <p
          role="note"
          aria-live="polite"
          data-testid="cb-suggest-rules-disabled-reason"
          style={{
            margin: 0,
            color: '#52606d',
            fontSize: '0.85rem',
          }}
        >
          {disabledReason}
        </p>
      )}

      <div aria-live="polite" aria-atomic="false">
        {suggestionError && (
          <p
            role="alert"
            data-testid="cb-suggest-rules-error"
            style={{
              margin: 0,
              padding: '0.75rem',
              borderRadius: '8px',
              background: '#fee2e2',
              color: '#991b1b',
              fontSize: '0.9rem',
            }}
          >
            {suggestionError}
          </p>
        )}

        {loading && (
          <p
            data-testid="cb-suggest-rules-loading"
            role="status"
            style={{
              margin: 0,
              color: '#52606d',
              fontSize: '0.85rem',
            }}
          >
            Analizando…
          </p>
        )}

        {showStop && suggestion && (
          <SuggestionCard
            testId="cb-suggest-rules-stopIf"
            label="Detener si…"
            value={suggestion.stopIf}
            meta={metaLine(suggestion)}
            applyLabel="Aplicar"
            discardLabel="Descartar"
            onApply={() => onApplyRule('stopIf', suggestion.stopIf)}
            onDiscard={() => onDiscardRule('stopIf')}
          />
        )}

        {showScale && suggestion && (
          <SuggestionCard
            testId="cb-suggest-rules-scaleIf"
            label="Aumentar inversión si…"
            value={suggestion.scaleIf}
            meta={metaLine(suggestion)}
            applyLabel="Aplicar"
            discardLabel="Descartar"
            onApply={() => onApplyRule('scaleIf', suggestion.scaleIf)}
            onDiscard={() => onDiscardRule('scaleIf')}
          />
        )}
      </div>
    </div>
  );
}

function SuggestionCard({
  testId,
  label,
  value,
  meta,
  applyLabel,
  discardLabel,
  onApply,
  onDiscard,
}: {
  testId: string;
  label: string;
  value: string;
  meta: string;
  applyLabel: string;
  discardLabel: string;
  onApply: () => void;
  onDiscard: () => void;
}) {
  return (
    <article
      data-testid={testId}
      style={{
        border: '1px solid #e4e7eb',
        borderRadius: '12px',
        padding: '0.75rem',
        background: '#ffffff',
        display: 'grid',
        gap: '0.5rem',
        marginTop: '0.5rem',
      }}
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: '0.5rem',
          flexWrap: 'wrap',
        }}
      >
        <strong style={{ fontSize: '0.9rem', color: '#1f2933' }}>{label}</strong>
      </header>
      <p
        data-testid={`${testId}-value`}
        style={{
          margin: 0,
          color: '#1f2933',
          fontSize: '0.9rem',
          lineHeight: 1.4,
        }}
      >
        {value}
      </p>
      <p
        data-testid={`${testId}-meta`}
        style={{
          margin: 0,
          color: '#52606d',
          fontSize: '0.75rem',
        }}
      >
        {meta}
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onApply}
          data-testid={`${testId}-apply`}
          style={{
            padding: '0.4rem 0.85rem',
            borderRadius: '8px',
            border: '1px solid #166534',
            background: '#1f2933',
            color: '#ffffff',
            cursor: 'pointer',
            fontSize: '0.85rem',
          }}
        >
          {applyLabel}
        </button>
        <button
          type="button"
          onClick={onDiscard}
          data-testid={`${testId}-discard`}
          style={{
            padding: '0.4rem 0.85rem',
            borderRadius: '8px',
            border: '1px solid #1f2933',
            background: '#ffffff',
            color: '#1f2933',
            cursor: 'pointer',
            fontSize: '0.85rem',
          }}
        >
          {discardLabel}
        </button>
      </div>
    </article>
  );
}

function DecisionRulesSection({
  state,
  setField,
}: {
  state: FormState;
  setField: (
    key: keyof FormState,
  ) => (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => void;
}) {
  return (
    <section style={sectionStyle}>
      <h3 style={{ margin: 0, fontSize: '1rem' }}>Reglas de decisión</h3>
      <Field label="Detener si…" htmlFor="cb-stopIf">
        <textarea
          id="cb-stopIf"
          value={state.stopIf}
          onChange={setField('stopIf')}
          style={{ ...inputStyle, minHeight: '2.5rem', fontFamily: 'inherit' }}
          maxLength={1000}
          placeholder="Ej: Si no hay 5 contactos calificados en 14 días"
        />
      </Field>
      <Field label="Aumentar inversión si…" htmlFor="cb-scaleIf">
        <textarea
          id="cb-scaleIf"
          value={state.scaleIf}
          onChange={setField('scaleIf')}
          style={{ ...inputStyle, minHeight: '2.5rem', fontFamily: 'inherit' }}
          maxLength={1000}
          placeholder="Ej: Si el Costo por lead (CPL) baja de $5.000..."
        />
      </Field>
    </section>
  );
}

function ChipsSection({
  field,
  label,
  state,
  chipInput,
  onInputChange,
  onAdd,
  onRemove,
}: {
  field: ArrayField;
  label: string;
  state: FormState;
  chipInput: string;
  onInputChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (tag: string) => void;
}) {
  const tags = state[field];
  return (
    <section style={sectionStyle} data-testid={`cb-section-${field}`}>
      <header style={{ display: 'grid', gap: '0.35rem' }}>
        <span style={{ fontSize: '1rem', fontWeight: 600, color: '#1f2933' }}>
          {label}
        </span>
      </header>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          alignItems: 'center',
        }}
      >
        {tags.length === 0 && (
          <span style={{ color: '#9aa5b1', fontSize: '0.85rem' }}>
            (sin elementos)
          </span>
        )}
        {tags.map((tag) => (
          <span
            key={tag}
            data-testid={`cb-chip-${field}-${tag}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.25rem 0.5rem 0.25rem 0.65rem',
              borderRadius: '999px',
              background: '#e0e7ff',
              color: '#3730a3',
              fontSize: '0.85rem',
            }}
          >
            {tag}
            <button
              type="button"
              aria-label={`Quitar ${tag} de ${label}`}
              onClick={() => onRemove(tag)}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#3730a3',
                padding: 0,
                fontSize: '0.95rem',
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          type="text"
          aria-label={`Agregar ${label}`}
          value={chipInput}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onAdd();
            }
          }}
          style={{ ...inputStyle, flex: 1 }}
        />
        <button
          type="button"
          onClick={onAdd}
          style={{
            padding: '0.5rem 0.85rem',
            borderRadius: '8px',
            border: '1px solid #1f2933',
            background: '#ffffff',
            color: '#1f2933',
            cursor: 'pointer',
            fontSize: '0.85rem',
          }}
        >
          Agregar
        </button>
      </div>
    </section>
  );
}

function BudgetSection({
  state,
  setField,
  setMoneyField,
  formatClp,
}: {
  state: FormState;
  setField: (
    key: keyof FormState,
  ) => (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => void;
  setMoneyField: (
    key: 'costPerAcquisitionCap' | 'lifetimeBudgetCap' | 'dailyBudgetCap',
  ) => (e: React.ChangeEvent<HTMLInputElement>) => void;
  formatClp: (raw: string) => string;
}) {
  return (
    <section style={sectionStyle}>
      <h3 style={{ margin: 0, fontSize: '1rem' }}>Economía</h3>
      <div
        style={{
          display: 'grid',
          gap: '0.75rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        }}
      >
        <Field
          label="Adquisición mensual esperada"
          htmlFor="cb-monthlyAcquisitionGoal"
        >
          <input
            id="cb-monthlyAcquisitionGoal"
            type="number"
            min={0}
            value={state.monthlyAcquisitionGoal}
            onChange={setField('monthlyAcquisitionGoal')}
            style={inputStyle}
          />
        </Field>
        <Field
          label="Duración estimada (días)"
          htmlFor="cb-plannedDuration"
        >
          <input
            id="cb-plannedDuration"
            type="number"
            min={0}
            value={state.plannedDurationDays}
            onChange={setField('plannedDurationDays')}
            style={inputStyle}
          />
        </Field>
        <Field
          label="Máximo aceptable por adquisición (tope de CPA, en pesos chilenos / CLP)"
          htmlFor="cb-cpa"
        >
          <input
            id="cb-cpa"
            type="text"
            inputMode="numeric"
            value={formatClp(state.costPerAcquisitionCap)}
            onChange={setMoneyField('costPerAcquisitionCap')}
            style={inputStyle}
            placeholder="$ 0"
          />
        </Field>
        <Field
          label="Cantidad máxima para toda la campaña"
          htmlFor="cb-lifetime"
        >
          <input
            id="cb-lifetime"
            type="text"
            inputMode="numeric"
            value={formatClp(state.lifetimeBudgetCap)}
            onChange={setMoneyField('lifetimeBudgetCap')}
            style={inputStyle}
            placeholder="$ 0"
          />
        </Field>
        <Field
          label="Presupuesto diario (CLP)"
          htmlFor="cb-daily"
        >
          <input
            id="cb-daily"
            type="text"
            inputMode="numeric"
            value={formatClp(state.dailyBudgetCap)}
            onChange={setMoneyField('dailyBudgetCap')}
            style={inputStyle}
            placeholder="$ 0"
          />
        </Field>
      </div>
    </section>
  );
}

function ActionsBar({
  mode,
  initialBrief,
  saving,
  approving,
  ready,
  onCreateAndApprove,
  onApprove,
  onArchive,
}: {
  mode: 'create' | 'edit';
  initialBrief?: CampaignBrief | null;
  saving: boolean;
  approving: boolean;
  ready: boolean;
  onCreateAndApprove: () => void;
  onApprove: () => void;
  onArchive: () => void;
}) {
  const isCreate = mode === 'create';
  return (
    <div
      style={{
        display: 'flex',
        gap: '0.75rem',
        justifyContent: 'flex-end',
        flexWrap: 'wrap',
      }}
    >
      {!isCreate && initialBrief && initialBrief.status !== 'ARCHIVED' && (
        <button
          type="button"
          onClick={onArchive}
          style={{
            padding: '0.55rem 1rem',
            borderRadius: '8px',
            border: '1px solid #1f2933',
            background: '#ffffff',
            color: '#1f2933',
            cursor: 'pointer',
          }}
        >
          Archivar
        </button>
      )}
      {!isCreate && initialBrief && (
        <button
          type="button"
          onClick={onApprove}
          disabled={approving || saving || initialBrief.status === 'ARCHIVED'}
          data-testid="cb-approve"
          style={{
            padding: '0.55rem 1rem',
            borderRadius: '8px',
            border: '1px solid #166534',
            background: approving || saving ? '#d1fae5' : '#1f2933',
            color: approving || saving ? '#1f2933' : '#ffffff',
            cursor: approving || saving ? 'not-allowed' : 'pointer',
            opacity: approving || saving ? 0.7 : 1,
          }}
        >
          {approving ? 'Aprobando...' : 'Aprobar plan'}
        </button>
      )}
      {isCreate && (
        <button
          type="button"
          onClick={onCreateAndApprove}
          disabled={!ready || approving || saving}
          style={{
            padding: '0.55rem 1rem',
            borderRadius: '8px',
            border: '1px solid #166534',
            background: ready && !approving && !saving ? '#1f2933' : '#cbd2d9',
            color: ready && !approving && !saving ? '#ffffff' : '#52606d',
            cursor: ready && !approving && !saving ? 'pointer' : 'not-allowed',
          }}
        >
          {approving ? 'Aprobando...' : 'Crear y aprobar'}
        </button>
      )}
      <button
        type="submit"
        disabled={saving || approving}
        style={{
          padding: '0.55rem 1.25rem',
          borderRadius: '8px',
          border: '1px solid #1f2933',
          background: saving || approving ? '#cbd2d9' : '#1f2933',
          color: saving || approving ? '#52606d' : '#ffffff',
          cursor: saving || approving ? 'not-allowed' : 'pointer',
        }}
      >
        {saving ? 'Guardando...' : isCreate ? 'Guardar borrador' : 'Guardar'}
      </button>
    </div>
  );
}
