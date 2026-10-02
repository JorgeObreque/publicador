'use server';

import {
  acceptCommercialDiagnosis,
  adjustCommercialDiagnosis,
  answerCommercialDiagnosis,
  getCommercialDiagnosis,
  startCommercialDiagnosis,
  type AdjustCommercialDiagnosisPayload,
  type AnswerCommercialDiagnosisPayload,
  type CommercialDiagnosis,
  type CommercialDiagnosisAcceptResult,
  type StartCommercialDiagnosisPayload,
} from '@/lib/commercial-diagnosis/api';

export async function startCommercialDiagnosisAction(
  payload: StartCommercialDiagnosisPayload,
): Promise<CommercialDiagnosis> {
  return startCommercialDiagnosis(payload);
}

export async function getCommercialDiagnosisAction(
  id: string,
): Promise<CommercialDiagnosis> {
  return getCommercialDiagnosis(id);
}

export async function answerCommercialDiagnosisAction(
  id: string,
  payload: AnswerCommercialDiagnosisPayload,
): Promise<CommercialDiagnosis> {
  return answerCommercialDiagnosis(id, payload);
}

export async function adjustCommercialDiagnosisAction(
  id: string,
  payload: AdjustCommercialDiagnosisPayload,
): Promise<CommercialDiagnosis> {
  return adjustCommercialDiagnosis(id, payload);
}

export async function acceptCommercialDiagnosisAction(
  id: string,
): Promise<CommercialDiagnosisAcceptResult> {
  return acceptCommercialDiagnosis(id);
}