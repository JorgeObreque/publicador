'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  acceptCommercialDiagnosisAction,
  adjustCommercialDiagnosisAction,
  answerCommercialDiagnosisAction,
  startCommercialDiagnosisAction,
} from '@/app/commercial-diagnosis/actions';
import type {
  CommercialDiagnosis,
  CommercialDiagnosisAnswer,
} from '@/lib/commercial-diagnosis/api';
import type { ServiceSummary } from '@/lib/services/api';
import { ContextSummary } from './ContextSummary';
import { RecommendedBudgetCard } from './RecommendedBudgetCard';
import { RecommendedGoalCard } from './RecommendedGoalCard';

type Phase =
  | 'intro'
  | 'clarification'
  | 'analyzing'
  | 'result'
  | 'error'
  | 'accepted';

const CURRENT_SITUATION_MIN = 10;

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

const labelStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: '#52606d',
  display: 'block',
  marginBottom: '0.25rem',
};

const sectionStyle: React.CSSProperties = {
  border: '1px solid #e4e7eb',
  borderRadius: '12px',
  padding: '1rem',
  background: '#ffffff',
  display: 'grid',
  gap: '0.75rem',
};

const primaryButtonStyle: React.CSSProperties = {
  padding: '0.55rem 1rem',
  borderRadius: '8px',
  border: '1px solid #1f2933',
  background: '#1f2933',
  color: '#ffffff',
  cursor: 'pointer',
  fontSize: '0.95rem',
  fontWeight: 600,
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: '0.55rem 1rem',
  borderRadius: '8px',
  border: '1px solid #1f2933',
  background: '#ffffff',
  color: '#1f2933',
  cursor: 'pointer',
  fontSize: '0.95rem',
  fontWeight: 600,
};

function buildDisabledStyle(disabled: boolean): React.CSSProperties {
  return {
    ...primaryButtonStyle,
    background: disabled ? '#cbd2d9' : '#1f2933',
    color: disabled ? '#52606d' : '#ffffff',
    borderColor: disabled ? '#cbd2d9' : '#1f2933',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.85 : 1,
  };
}

function buildSecondaryDisabledStyle(disabled: boolean): React.CSSProperties {
  return {
    ...secondaryButtonStyle,
    background: disabled ? '#f1f5f9' : '#ffffff',
    color: disabled ? '#94a3b8' : '#1f2933',
    borderColor: disabled ? '#cbd2d9' : '#1f2933',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.85 : 1,
  };
}

function findPendingAnswer(
  diagnosis: CommercialDiagnosis | null,
): CommercialDiagnosisAnswer | null {
  if (!diagnosis) return null;
  const sorted = [...diagnosis.answers].sort((a, b) =>
    a.askedAt.localeCompare(b.askedAt),
  );
  for (const answer of sorted) {
    if (answer.answeredAt === null) {
      return answer;
    }
  }
  return null;
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function CommercialDiagnosisFlow({ services }: { services: ServiceSummary[] }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('intro');
  const [diagnosis, setDiagnosis] = useState<CommercialDiagnosis | null>(null);
  const [errorMessage_, setErrorMessage] = useState<string | null>(null);
  const [currentSituationDraft, setCurrentSituationDraft] = useState('');
  const [pendingAnswer, setPendingAnswer] = useState('');
  const [adjustInstruction, setAdjustInstruction] = useState('');
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [errorReturnPhase, setErrorReturnPhase] = useState<Phase>('intro');
  // P1-5: estado local para el servicio seleccionado. Si la lista llega
  // con un único servicio, autoseccionamos al montar. Si trae 2+, lo
  // dejamos en null hasta que la operadora elija.
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');

  useEffect(() => {
    if (services.length === 1 && !selectedServiceId) {
      setSelectedServiceId(services[0]!.id);
    }
  }, [services, selectedServiceId]);

  const showServiceSelector = services.length > 1;

  const introValid = useMemo(
    () =>
      currentSituationDraft.trim().length >= CURRENT_SITUATION_MIN &&
      (!showServiceSelector || selectedServiceId.trim().length > 0),
    [currentSituationDraft, showServiceSelector, selectedServiceId],
  );
  const answerValid = useMemo(() => pendingAnswer.trim().length > 0, [pendingAnswer]);
  const adjustValid = useMemo(
    () => adjustInstruction.trim().length > 0,
    [adjustInstruction],
  );

  const runWithPhase = useCallback(
    async (
      task: () => Promise<CommercialDiagnosis | null>,
    ): Promise<void> => {
      const previousPhase = phase;
      setPhase('analyzing');
      setErrorMessage(null);
      try {
        const response = await task();
        if (!response) {
          setPhase(previousPhase);
          return;
        }
        setDiagnosis(response);
        if (response.status === 'READY') {
          setPhase('result');
        } else if (response.status === 'IN_PROGRESS') {
          const pending = findPendingAnswer(response);
          if (pending) {
            setPhase('clarification');
          } else {
            setPhase('result');
          }
        } else if (response.status === 'ACCEPTED' && response.campaignBriefId) {
          setPhase('accepted');
          router.push(
            `/campaigns/new?briefId=${encodeURIComponent(response.campaignBriefId)}`,
          );
        } else {
          setPhase('result');
        }
      } catch (err) {
        setErrorMessage(errorMessage(err, 'No pudimos completar la acción.'));
        setErrorReturnPhase(previousPhase);
        setPhase('error');
      }
    },
    [phase, router],
  );

  const handleStart = useCallback(() => {
    if (!introValid) return;
    const text = currentSituationDraft.trim();
    // P1-5: enviamos `serviceId` cuando hay selector visible o cuando
    // autose hemos seleccionado el único servicio disponible.
    const serviceId = selectedServiceId.trim() || undefined;
    void runWithPhase(async () => {
      const response = await startCommercialDiagnosisAction({
        currentSituation: text,
        ...(serviceId ? { serviceId } : {}),
      });
      return response;
    });
  }, [currentSituationDraft, introValid, runWithPhase, selectedServiceId]);

  const handleAnswer = useCallback(() => {
    if (!diagnosis) return;
    const pending = findPendingAnswer(diagnosis);
    if (!pending || !answerValid) return;
    const answerText = pendingAnswer.trim();
    const questionKey = pending.questionKey;
    setPendingAnswer('');
    void runWithPhase(async () => {
      return answerCommercialDiagnosisAction(diagnosis.id, {
        questionKey,
        answerText,
      });
    });
  }, [answerValid, diagnosis, pendingAnswer, runWithPhase]);

  const handleAdjust = useCallback(() => {
    if (!diagnosis || !adjustValid) return;
    const instruction = adjustInstruction.trim();
    setAdjustInstruction('');
    setAdjustOpen(false);
    void runWithPhase(async () => {
      return adjustCommercialDiagnosisAction(diagnosis.id, { instruction });
    });
  }, [adjustInstruction, adjustValid, diagnosis, runWithPhase]);

  const handleAccept = useCallback(() => {
    if (!diagnosis || diagnosis.status !== 'READY') return;
    void runWithPhase(async () => {
      const result = await acceptCommercialDiagnosisAction(diagnosis.id);
      const brief = result.campaignBrief as { id?: string } | null;
      const briefId = brief?.id ?? result.diagnosis.campaignBriefId ?? '';
      if (!briefId) {
        throw new Error('No pudimos crear el plan. Inténtalo nuevamente.');
      }
      router.push(`/campaigns/new?briefId=${encodeURIComponent(briefId)}`);
      return { ...result.diagnosis, campaignBriefId: briefId };
    });
  }, [diagnosis, router, runWithPhase]);

  const handleRetry = useCallback(() => {
    setErrorMessage(null);
    setPhase(errorReturnPhase);
  }, [errorReturnPhase]);

  const pendingQuestion = useMemo(
    () => findPendingAnswer(diagnosis),
    [diagnosis],
  );

  const introLabelId = 'cdf-intro-textarea-label';
  const serviceLabelId = 'cdf-intro-service-label';
  const clarificationLabelId = 'cdf-clarification-textarea-label';
  const adjustLabelId = 'cdf-adjust-textarea-label';

  return (
    <div
      style={{ display: 'grid', gap: '1rem' }}
      aria-live="polite"
      aria-atomic="false"
    >
      {phase === 'intro' ? (
        <section
          role="region"
          aria-label="Cuéntanos cómo está funcionando tu negocio"
          style={sectionStyle}
        >
          <header style={{ display: 'grid', gap: '0.4rem' }}>
            <p
              style={{
                margin: 0,
                color: '#166534',
                fontSize: '0.85rem',
                fontWeight: 600,
              }}
            >
              Ya conocemos tu negocio, ubicación, servicios, público y capacidad.
            </p>
            <h2
              style={{
                margin: 0,
                color: '#1f2933',
                fontSize: '1.2rem',
                lineHeight: 1.3,
              }}
            >
              Busquemos la próxima oportunidad
            </h2>
            <p style={{ margin: 0, color: '#52606d', fontSize: '0.9rem' }}>
              Ahora necesitamos entender cómo está funcionando realmente hoy.
            </p>
          </header>
          {showServiceSelector ? (
            <div>
              <label htmlFor={serviceLabelId} style={labelStyle}>
                ¿Qué servicio quieres potenciar?
              </label>
              <p
                style={{
                  margin: '0 0 0.5rem',
                  color: '#52606d',
                  fontSize: '0.85rem',
                  lineHeight: 1.45,
                }}
              >
                El diagnóstico se enfocará en el servicio que elijas. Si la
                estrategia aplica a varios, podrás ajustarla después.
              </p>
              <select
                id={serviceLabelId}
                data-testid="cdf-intro-service-select"
                value={selectedServiceId}
                onChange={(event) => setSelectedServiceId(event.target.value)}
                style={inputStyle}
                aria-required="true"
                required
              >
                <option value="" disabled>
                  Selecciona un servicio…
                </option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div>
            <label htmlFor={introLabelId} style={labelStyle}>
              ¿Cómo está funcionando tu negocio actualmente?
            </label>
            <p
              style={{
                margin: '0 0 0.5rem',
                color: '#52606d',
                fontSize: '0.85rem',
                lineHeight: 1.45,
              }}
            >
              Cuéntanos qué está pasando en la práctica: cuándo tienes clientes,
              cuándo tienes disponibilidad, qué servicios se venden más, qué te
              cuesta vender o cualquier situación que te gustaría mejorar.
            </p>
            <textarea
              id={introLabelId}
              data-testid="cdf-intro-textarea"
              value={currentSituationDraft}
              onChange={(e) => setCurrentSituationDraft(e.target.value)}
              style={{
                ...inputStyle,
                minHeight: '6rem',
                fontFamily: 'inherit',
                lineHeight: 1.45,
              }}
              maxLength={4000}
              aria-describedby="cdf-intro-help"
              placeholder="Por ejemplo: Tengo clientas principalmente jueves, viernes, sábado y domingo. Lunes, martes y miércoles tengo bastante disponibilidad."
            />
            <p
              id="cdf-intro-help"
              style={{
                margin: '0.4rem 0 0',
                fontSize: '0.8rem',
                color: '#52606d',
                fontStyle: 'italic',
              }}
            >
              Por ejemplo: &ldquo;Tengo clientas principalmente jueves, viernes,
              sábado y domingo. Lunes, martes y miércoles tengo bastante
              disponibilidad.&rdquo;
            </p>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}
          >
            <button
              type="button"
              data-testid="cdf-intro-submit"
              onClick={handleStart}
              disabled={!introValid}
              aria-disabled={!introValid}
              style={buildDisabledStyle(!introValid)}
            >
              Analizar mi situación
            </button>
          </div>
        </section>
      ) : null}

      {phase === 'analyzing' ? (
        <section
          role="region"
          aria-label="Analizando tu situación"
          style={sectionStyle}
          data-testid="cdf-analyzing"
        >
          <p
            role="status"
            data-testid="cdf-analyzing-status"
            style={{ margin: 0, color: '#52606d', fontSize: '0.95rem' }}
          >
            Analizando tu situación…
          </p>
        </section>
      ) : null}

      {phase === 'clarification' && diagnosis && pendingQuestion ? (
        <section
          role="region"
          aria-label="Necesitamos un dato más para continuar"
          style={sectionStyle}
        >
          <header style={{ display: 'grid', gap: '0.4rem' }}>
            <span
              style={{
                margin: 0,
                color: '#166534',
                fontSize: '0.85rem',
                fontWeight: 600,
              }}
            >
              Necesitamos un dato más para continuar
            </span>
            <h2
              style={{
                margin: 0,
                color: '#1f2933',
                fontSize: '1.05rem',
                lineHeight: 1.3,
              }}
            >
              {pendingQuestion.questionText}
            </h2>
          </header>
          <div>
            <label htmlFor={clarificationLabelId} style={labelStyle}>
              Tu respuesta
            </label>
            <textarea
              id={clarificationLabelId}
              data-testid="cdf-clarification-textarea"
              value={pendingAnswer}
              onChange={(e) => setPendingAnswer(e.target.value)}
              style={{
                ...inputStyle,
                minHeight: '4rem',
                fontFamily: 'inherit',
                lineHeight: 1.45,
              }}
              maxLength={2000}
            />
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.5rem',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              data-testid="cdf-clarification-submit"
              onClick={handleAnswer}
              disabled={!answerValid}
              aria-disabled={!answerValid}
              style={buildDisabledStyle(!answerValid)}
            >
              Responder
            </button>
          </div>
        </section>
      ) : null}

      {phase === 'result' && diagnosis && diagnosis.recommended ? (
        <div style={{ display: 'grid', gap: '1rem' }}>
          <RecommendedGoalCard
            recommended={diagnosis.recommended}
            diagnosis={diagnosis}
          />
          <RecommendedBudgetCard
            strategy={diagnosis.strategy}
            primaryConversionFallback={
              diagnosis.recommended?.primaryConversion ??
              diagnosis.primaryConversion
            }
          />
          <ContextSummary diagnosis={diagnosis} strategy={diagnosis.strategy} />

          <section
            role="region"
            aria-label="Acciones sobre la meta propuesta"
            style={sectionStyle}
          >
            <header style={{ display: 'grid', gap: '0.25rem' }}>
              <strong style={{ color: '#1f2933', fontSize: '0.95rem' }}>
                ¿Qué quieres hacer?
              </strong>
              <p style={{ margin: 0, color: '#52606d', fontSize: '0.85rem' }}>
                Puedes usar esta meta tal como está o pedirle a la IA que la
                ajuste con una instrucción libre.
              </p>
            </header>

            {!adjustOpen ? (
              <div
                style={{
                  display: 'flex',
                  gap: '0.5rem',
                  flexWrap: 'wrap',
                  justifyContent: 'flex-end',
                }}
              >
                <button
                  type="button"
                  data-testid="cdf-result-adjust-toggle"
                  onClick={() => setAdjustOpen(true)}
                  style={secondaryButtonStyle}
                >
                  Ajustar con IA
                </button>
                <button
                  type="button"
                  data-testid="cdf-result-accept"
                  onClick={handleAccept}
                  style={primaryButtonStyle}
                >
                  Usar esta meta
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                <label htmlFor={adjustLabelId} style={labelStyle}>
                  ¿Qué quieres cambiar?
                </label>
                <textarea
                  id={adjustLabelId}
                  data-testid="cdf-result-adjust-textarea"
                  value={adjustInstruction}
                  onChange={(e) => setAdjustInstruction(e.target.value)}
                  style={{
                    ...inputStyle,
                    minHeight: '3.5rem',
                    fontFamily: 'inherit',
                    lineHeight: 1.45,
                  }}
                  maxLength={1000}
                  placeholder="Por ejemplo: enfoca la meta solo en días lunes y martes."
                />
                <div
                  style={{
                    display: 'flex',
                    gap: '0.5rem',
                    flexWrap: 'wrap',
                    justifyContent: 'flex-end',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setAdjustOpen(false);
                      setAdjustInstruction('');
                    }}
                    style={buildSecondaryDisabledStyle(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    data-testid="cdf-result-adjust-submit"
                    onClick={handleAdjust}
                    disabled={!adjustValid}
                    aria-disabled={!adjustValid}
                    style={buildDisabledStyle(!adjustValid)}
                  >
                    Pedir revisión
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      ) : null}

      {phase === 'error' ? (
        <section
          role="alert"
          aria-label="Error en el diagnóstico"
          data-testid="cdf-error-banner"
          style={{
            border: '1px solid #fee2e2',
            background: '#fee2e2',
            color: '#991b1b',
            padding: '1rem',
            borderRadius: '12px',
            display: 'grid',
            gap: '0.5rem',
          }}
        >
          <strong style={{ margin: 0 }}>
            No pudimos continuar con el diagnóstico
          </strong>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>
            {errorMessage_ ?? 'Inténtalo nuevamente en unos minutos.'}
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              data-testid="cdf-error-retry"
              onClick={handleRetry}
              style={primaryButtonStyle}
            >
              Reintentar
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}