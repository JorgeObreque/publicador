'use client';

import { useState } from 'react';
import type { CampaignDraft } from '@/lib/campaigns/wizard';
import { issueForField } from '@/lib/campaigns/wizard';
import type { ValidationIssue } from '@/lib/campaigns/wizard';
import { requestCreativeRecommendationsAction } from '@/app/campaigns/new/actions';
import type {
  CreativeSuggestion,
} from '@/lib/creatives/api';

interface Props {
  draft: CampaignDraft;
  issues: ValidationIssue[];
  onChange: (updater: (draft: CampaignDraft) => CampaignDraft) => void;
  onNext: () => void;
  onPrevious: () => void;
}

const MAX_PRIMARY = 2000;
const MAX_HEADLINE = 80;

type RecommendationsPhase = 'INITIAL' | 'PRIMARY' | 'HEADLINE' | 'SELECTED';

type RecommendationsState = {
  phase: RecommendationsPhase;
  suggestions: CreativeSuggestion[];
} | null;

type LoadingTarget = 'initial' | 'primary' | 'headline' | null;

type UsedRegenerations = { primaryText: boolean; headline: boolean };

export function CopyStep({ draft, issues, onChange, onNext, onPrevious }: Props) {
  const primaryError = issueForField(issues, 'copy', 'primaryText');
  const headlineError = issueForField(issues, 'copy', 'headline');
  const canContinue = !primaryError && !headlineError && draft.primaryText.trim() && draft.headline.trim();

  const [recommendations, setRecommendations] = useState<RecommendationsState>(null);
  const [loading, setLoading] = useState<LoadingTarget>(null);
  const [error, setError] = useState<string | null>(null);
  const [usedRegenerations, setUsedRegenerations] = useState<UsedRegenerations>({
    primaryText: false,
    headline: false,
  });

  const canGenerate = Boolean(draft.serviceId) && Boolean(draft.selectedMediaAssetId);

  const handleGenerateInitial = async () => {
    if (!canGenerate || !draft.serviceId || !draft.selectedMediaAssetId) return;
    setLoading('initial');
    setError(null);
    try {
      const response = await requestCreativeRecommendationsAction({
        mode: 'INITIAL',
        serviceId: draft.serviceId,
        mediaAssetId: draft.selectedMediaAssetId,
        briefContext: draft.briefContext ?? undefined,
      });
      setRecommendations({
        phase: 'INITIAL',
        suggestions: response.suggestions,
      });
      setUsedRegenerations({ primaryText: false, headline: false });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(null);
    }
  };

  const handleRegeneratePrimary = async () => {
    if (!draft.serviceId || !draft.selectedMediaAssetId) return;
    setLoading('primary');
    setError(null);
    try {
      const response = await requestCreativeRecommendationsAction({
        mode: 'REGENERATE_PRIMARY_TEXT',
        serviceId: draft.serviceId,
        mediaAssetId: draft.selectedMediaAssetId,
        currentCopy: {
          primaryText: draft.primaryText,
          headline: draft.headline,
        },
        briefContext: draft.briefContext ?? undefined,
      });
      setRecommendations({
        phase: 'PRIMARY',
        suggestions: response.suggestions,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(null);
    }
  };

  const handleRegenerateHeadline = async () => {
    if (!draft.serviceId || !draft.selectedMediaAssetId) return;
    setLoading('headline');
    setError(null);
    try {
      const response = await requestCreativeRecommendationsAction({
        mode: 'REGENERATE_HEADLINE',
        serviceId: draft.serviceId,
        mediaAssetId: draft.selectedMediaAssetId,
        currentCopy: {
          primaryText: draft.primaryText,
          headline: draft.headline,
        },
        briefContext: draft.briefContext ?? undefined,
      });
      setRecommendations({
        phase: 'HEADLINE',
        suggestions: response.suggestions,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(null);
    }
  };

  const handlePickInitial = (suggestion: CreativeSuggestion) => {
    onChange((current) => ({
      ...current,
      primaryText: suggestion.primaryText.slice(0, MAX_PRIMARY),
      headline: suggestion.headline.slice(0, MAX_HEADLINE),
    }));
    if (recommendations) {
      setRecommendations({ ...recommendations, phase: 'SELECTED' });
    }
  };

  const handlePickPrimary = (suggestion: CreativeSuggestion) => {
    onChange((current) => ({
      ...current,
      primaryText: suggestion.primaryText.slice(0, MAX_PRIMARY),
    }));
    setUsedRegenerations((prev) => ({ ...prev, primaryText: true }));
    if (recommendations) {
      setRecommendations({ ...recommendations, phase: 'SELECTED' });
    }
  };

  const handlePickHeadline = (suggestion: CreativeSuggestion) => {
    onChange((current) => ({
      ...current,
      headline: suggestion.headline.slice(0, MAX_HEADLINE),
    }));
    setUsedRegenerations((prev) => ({ ...prev, headline: true }));
    if (recommendations) {
      setRecommendations({ ...recommendations, phase: 'SELECTED' });
    }
  };

  return (
    <section style={{ display: 'grid', gap: '1rem' }}>
      <header>
        <h2 style={{ margin: 0 }}>Escribe el anuncio</h2>
        <p style={{ margin: '0.25rem 0 0', color: '#52606d' }}>
          El botón se enviará por WhatsApp con un código de seguimiento automático.
        </p>
      </header>

      <FieldWrapper
        id="copy-primaryText"
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
      </FieldWrapper>

      <FieldWrapper
        id="copy-headline"
        label={`Título (${draft.headline.length}/${MAX_HEADLINE})`}
        error={headlineError}
      >
        <input
          type="text"
          value={draft.headline}
          onChange={(event) =>
            onChange((current) => ({ ...current, headline: event.target.value.slice(0, MAX_HEADLINE) }))
          }
          style={inputStyle}
          placeholder="Reserva tu balayage"
        />
      </FieldWrapper>

      <RecommendationsPanel
        canGenerate={canGenerate}
        loading={loading}
        error={error}
        recommendations={recommendations}
        usedRegenerations={usedRegenerations}
        onGenerateInitial={handleGenerateInitial}
        onRegeneratePrimary={handleRegeneratePrimary}
        onRegenerateHeadline={handleRegenerateHeadline}
        onPickInitial={handlePickInitial}
        onPickPrimary={handlePickPrimary}
        onPickHeadline={handlePickHeadline}
      />

      <div
        style={{
          border: '1px solid #e4e7eb',
          borderRadius: '12px',
          padding: '1rem',
          background: '#ffffff',
        }}
      >
        <p style={{ margin: '0 0 0.25rem', color: '#52606d', fontSize: '0.85rem' }}>Vista previa</p>
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

function FieldWrapper({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'grid', gap: '0.35rem' }}>
      <label
        htmlFor={id}
        style={{ color: '#1f2933', fontSize: '0.95rem', fontWeight: 600 }}
      >
        {label}
      </label>
      {children}
      {error ? (
        <span role="alert" style={{ color: '#991b1b', fontSize: '0.85rem' }}>
          {error}
        </span>
      ) : null}
    </div>
  );
}

function RecommendationsPanel({
  canGenerate,
  loading,
  error,
  recommendations,
  usedRegenerations,
  onGenerateInitial,
  onRegeneratePrimary,
  onRegenerateHeadline,
  onPickInitial,
  onPickPrimary,
  onPickHeadline,
}: {
  canGenerate: boolean;
  loading: LoadingTarget;
  error: string | null;
  recommendations: RecommendationsState;
  usedRegenerations: UsedRegenerations;
  onGenerateInitial: () => void;
  onRegeneratePrimary: () => void;
  onRegenerateHeadline: () => void;
  onPickInitial: (suggestion: CreativeSuggestion) => void;
  onPickPrimary: (suggestion: CreativeSuggestion) => void;
  onPickHeadline: (suggestion: CreativeSuggestion) => void;
}) {
  const phase = recommendations?.phase ?? null;
  const primaryDisabled =
    loading === 'primary' || usedRegenerations.primaryText || phase !== 'SELECTED';
  const headlineDisabled =
    loading === 'headline' || usedRegenerations.headline || phase !== 'SELECTED';

  return (
    <div
      style={{
        border: '1px solid #e4e7eb',
        borderRadius: '12px',
        padding: '1rem',
        background: '#ffffff',
        display: 'grid',
        gap: '0.75rem',
      }}
    >
      <header style={{ display: 'grid', gap: '0.25rem' }}>
        <h3 style={{ margin: 0 }}>Propuestas con IA</h3>
        <p style={{ margin: 0, color: '#52606d', fontSize: '0.85rem' }}>
          Te mostramos 3 variantes y puedes ajustar el texto principal o el título después.
        </p>
      </header>

      {!canGenerate && (
        <p
          style={{
            margin: 0,
            color: '#92400e',
            background: '#fef3c7',
            padding: '0.75rem',
            borderRadius: '8px',
            fontSize: '0.85rem',
          }}
        >
          Selecciona un servicio y una imagen antes de generar propuestas con IA.
        </p>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onGenerateInitial}
          disabled={!canGenerate || loading !== null}
          style={{
            ...primaryButtonStyle,
            opacity: !canGenerate || loading !== null ? 0.5 : 1,
            cursor: !canGenerate || loading !== null ? 'not-allowed' : 'pointer',
          }}
        >
          {loading === 'initial' ? 'Generando…' : 'Generar 3 propuestas con IA'}
        </button>
        <button
          type="button"
          onClick={onRegeneratePrimary}
          disabled={primaryDisabled}
          style={{
            ...secondaryButtonStyle,
            opacity: primaryDisabled ? 0.6 : 1,
            cursor: primaryDisabled ? 'not-allowed' : 'pointer',
          }}
        >
          {usedRegenerations.primaryText
            ? 'Regeneración utilizada'
            : loading === 'primary'
              ? 'Generando…'
              : 'Regenerar texto principal'}
        </button>
        <button
          type="button"
          onClick={onRegenerateHeadline}
          disabled={headlineDisabled}
          style={{
            ...secondaryButtonStyle,
            opacity: headlineDisabled ? 0.6 : 1,
            cursor: headlineDisabled ? 'not-allowed' : 'pointer',
          }}
        >
          {usedRegenerations.headline
            ? 'Regeneración utilizada'
            : loading === 'headline'
              ? 'Generando…'
              : 'Regenerar título'}
        </button>
      </div>

      {error && <div style={errorBlockStyle}>{error}</div>}

      {recommendations?.phase === 'INITIAL' && (
        <SuggestionsGrid
          title="3 propuestas iniciales"
          suggestions={recommendations.suggestions}
          onPick={onPickInitial}
        />
      )}

      {recommendations?.phase === 'PRIMARY' && (
        <SuggestionFieldGrid
          title="Alternativas para el texto principal"
          field="primaryText"
          suggestions={recommendations.suggestions}
          onPick={onPickPrimary}
        />
      )}

      {recommendations?.phase === 'HEADLINE' && (
        <SuggestionFieldGrid
          title="Alternativas para el título"
          field="headline"
          suggestions={recommendations.suggestions}
          onPick={onPickHeadline}
        />
      )}
    </div>
  );
}

function SuggestionsGrid({
  title,
  suggestions,
  onPick,
}: {
  title: string;
  suggestions: CreativeSuggestion[];
  onPick: (suggestion: CreativeSuggestion) => void;
}) {
  return (
    <div style={{ display: 'grid', gap: '0.5rem' }}>
      <p style={{ margin: 0, color: '#52606d', fontSize: '0.85rem' }}>{title}</p>
      <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        {suggestions.map((suggestion, index) => (
          <SuggestionCard
            key={`${title}-${index}`}
            index={index}
            suggestion={suggestion}
            onPick={onPick}
          />
        ))}
      </div>
    </div>
  );
}

function SuggestionFieldGrid({
  title,
  field,
  suggestions,
  onPick,
}: {
  title: string;
  field: 'primaryText' | 'headline';
  suggestions: CreativeSuggestion[];
  onPick: (suggestion: CreativeSuggestion) => void;
}) {
  return (
    <div style={{ display: 'grid', gap: '0.5rem' }}>
      <p style={{ margin: 0, color: '#52606d', fontSize: '0.85rem' }}>{title}</p>
      <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        {suggestions.map((suggestion, index) => {
          const value = field === 'primaryText' ? suggestion.primaryText : suggestion.headline;
          return (
            <div
              key={`${title}-${index}`}
              style={{
                border: '1px solid #e4e7eb',
                borderRadius: '12px',
                padding: '0.75rem',
                background: '#ffffff',
                display: 'grid',
                gap: '0.5rem',
              }}
            >
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#52606d' }}>Alternativa {index + 1}</p>
              <p style={{ margin: 0, color: '#1f2933', whiteSpace: 'pre-wrap' }}>{value}</p>
              <button
                type="button"
                onClick={() => onPick(suggestion)}
                style={{ ...primaryButtonStyle, padding: '0.5rem 0.85rem', fontSize: '0.9rem' }}
              >
                Usar esta alternativa
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SuggestionCard({
  index,
  suggestion,
  onPick,
}: {
  index: number;
  suggestion: CreativeSuggestion;
  onPick: (suggestion: CreativeSuggestion) => void;
}) {
  return (
    <div
      style={{
        border: '1px solid #e4e7eb',
        borderRadius: '12px',
        padding: '0.75rem',
        background: '#ffffff',
        display: 'grid',
        gap: '0.5rem',
      }}
    >
      <p style={{ margin: 0, fontSize: '0.8rem', color: '#52606d' }}>Propuesta {index + 1}</p>
      <p style={{ margin: 0, fontWeight: 600, color: '#1f2933' }}>{suggestion.headline}</p>
      <p style={{ margin: 0, color: '#3e4c59', fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>
        {suggestion.primaryText}
      </p>
      <button
        type="button"
        onClick={() => onPick(suggestion)}
        style={{ ...primaryButtonStyle, padding: '0.5rem 0.85rem', fontSize: '0.9rem' }}
      >
        Elegir esta propuesta
      </button>
    </div>
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

const errorBlockStyle = {
  color: '#991b1b',
  background: '#fee2e2',
  padding: '0.75rem',
  borderRadius: '8px',
  fontSize: '0.85rem',
} as const;
