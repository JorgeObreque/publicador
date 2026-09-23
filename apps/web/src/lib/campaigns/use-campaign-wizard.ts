'use client';

import { useCallback, useMemo, useState } from 'react';
import type { CampaignDraft, CampaignStepId, ValidationIssue } from './wizard';
import { STEPS, createEmptyDraft, estimateMaxSpend, validateDraft } from './wizard';

export interface CampaignWizardApi {
  draft: CampaignDraft;
  stepId: CampaignStepId;
  issues: ValidationIssue[];
  maxSpend: number | null;
  setDraft: (updater: (draft: CampaignDraft) => CampaignDraft) => void;
  goTo: (step: CampaignStepId) => void;
  next: () => void;
  previous: () => void;
  reset: () => void;
}

export function useCampaignWizard(): CampaignWizardApi {
  const [draft, setDraftState] = useState<CampaignDraft>(createEmptyDraft);
  const [stepId, setStepId] = useState<CampaignStepId>('service');

  const issues = useMemo(() => validateDraft(draft), [draft]);
  const maxSpend = useMemo(() => estimateMaxSpend(draft), [draft]);

  const setDraft = useCallback(
    (updater: (current: CampaignDraft) => CampaignDraft) => {
      setDraftState((current) => updater(current));
    },
    [],
  );

  const goTo = useCallback((step: CampaignStepId) => setStepId(step), []);
  const next = useCallback(() => {
    setStepId((current) => {
      const index = STEPS.findIndex((step) => step.id === current);
      return STEPS[Math.min(index + 1, STEPS.length - 1)].id;
    });
  }, []);
  const previous = useCallback(() => {
    setStepId((current) => {
      const index = STEPS.findIndex((step) => step.id === current);
      return STEPS[Math.max(index - 1, 0)].id;
    });
  }, []);
  const reset = useCallback(() => {
    setDraftState(createEmptyDraft());
    setStepId('service');
  }, []);

  return { draft, stepId, issues, maxSpend, setDraft, goTo, next, previous, reset };
}
