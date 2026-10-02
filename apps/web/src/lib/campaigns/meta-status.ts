export type MetaStatusTone = 'ok' | 'warn' | 'error' | 'neutral';

export interface MetaStatusView {
  label: string;
  description: string;
  tone: MetaStatusTone;
}

const UNKNOWN_VIEW: MetaStatusView = {
  label: 'Estado desconocido',
  description: 'No pudimos traducir el estado que entrega Meta. Revisa la campaña directamente en Meta Ads.',
  tone: 'neutral',
};

const TRANSLATIONS: Record<string, MetaStatusView> = {
  ACTIVE: {
    label: 'Activa',
    description: 'La campaña está activa en Meta y recibiendo inversión.',
    tone: 'ok',
  },
  PAUSED: {
    label: 'Pausada en Meta',
    description: 'La campaña existe en Meta pero está pausada: no muestra anuncios ni gasta.',
    tone: 'warn',
  },
  IN_PROCESS: {
    label: 'Enviando a Meta',
    description: 'La campaña se está creando o actualizando en Meta en este momento.',
    tone: 'warn',
  },
  WITH_ISSUES: {
    label: 'Con problemas en Meta',
    description: 'Meta marcó la campaña con observaciones: revisa los detalles en tu cuenta.',
    tone: 'warn',
  },
  DELETED: {
    label: 'Eliminada de Meta',
    description: 'La campaña fue eliminada en Meta y ya no se puede recuperar.',
    tone: 'error',
  },
  ARCHIVED: {
    label: 'Archivada',
    description: 'La campaña está archivada y no se mostrará en el listado activo.',
    tone: 'neutral',
  },
  PENDING_REVIEW: {
    label: 'Esperando revisión de Meta',
    description: 'Meta está revisando la campaña antes de aprobarla para publicar.',
    tone: 'warn',
  },
};

export function humanizeMetaStatus(
  remoteStatus: string,
  effectiveStatus?: string | null,
): MetaStatusView {
  const candidates = [effectiveStatus, remoteStatus]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toUpperCase());
  for (const candidate of candidates) {
    const match = TRANSLATIONS[candidate];
    if (match) return match;
  }
  return {
    ...UNKNOWN_VIEW,
    label:
      remoteStatus || effectiveStatus
        ? `Estado desconocido en Meta (${remoteStatus || effectiveStatus})`
        : UNKNOWN_VIEW.label,
  };
}

export function statusBadgeFromMetaStatus(
  remoteStatus: string,
  effectiveStatus?: string | null,
): MetaStatusView {
  return humanizeMetaStatus(remoteStatus, effectiveStatus);
}