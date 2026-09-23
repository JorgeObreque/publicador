'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { publishCampaignPaused } from '@/lib/campaigns/api';
import type { Campaign, MetaPublishStatus } from '@/lib/campaigns/types';

interface Props {
  campaign: Pick<Campaign, 'id' | 'status' | 'metaPublishStatus' | 'metaPublishError'>;
  hasCreatives: boolean;
}

export function PublishActions({ campaign, hasCreatives }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const publishing = campaign.metaPublishStatus === ('PUBLISHING' as MetaPublishStatus);
  const canPublish = hasCreatives && !publishing && campaign.status !== 'ARCHIVED';
  const canRetry = canPublish && campaign.metaPublishStatus === ('FAILED' as MetaPublishStatus);

  const handlePublish = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await publishCampaignPaused(campaign.id);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!hasCreatives) {
    return (
      <p style={{ color: '#52606d', margin: 0 }}>
        Asocia un anuncio antes de enviar la campaña a Meta.
      </p>
    );
  }

  if (campaign.status === 'ARCHIVED') {
    return (
      <p style={{ color: '#52606d', margin: 0 }}>
        La campaña está archivada y no se puede publicar.
      </p>
    );
  }

  if (publishing) {
    return (
      <p style={{ color: '#92400e', margin: 0 }}>
        Estamos enviando esta campaña a Meta. Esta acción quedará registrada al terminar.
      </p>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '0.5rem' }}>
      {error && (
        <p style={{ color: '#991b1b', background: '#fee2e2', padding: '0.75rem', borderRadius: '8px', margin: 0 }}>
          {error}
        </p>
      )}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {canRetry ? (
          <button
            type="button"
            onClick={handlePublish}
            disabled={submitting}
            style={{
              ...primaryButtonStyle,
              opacity: submitting ? 0.5 : 1,
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Reintentando…' : 'Reintentar publicación'}
          </button>
        ) : (
          <button
            type="button"
            onClick={handlePublish}
            disabled={!canPublish || submitting}
            style={{
              ...primaryButtonStyle,
              opacity: canPublish && !submitting ? 1 : 0.5,
              cursor: canPublish && !submitting ? 'pointer' : 'not-allowed',
            }}
          >
            {submitting ? 'Enviando…' : 'Enviar a Meta como pausada'}
          </button>
        )}
      </div>
      <p style={{ margin: 0, color: '#52606d', fontSize: '0.85rem' }}>
        La campaña quedará pausada en Meta. No generará gastos hasta que la actives manualmente.
      </p>
    </div>
  );
}

const primaryButtonStyle = {
  padding: '0.65rem 1.25rem',
  borderRadius: '8px',
  border: 'none',
  background: '#1f2933',
  color: '#ffffff',
  fontSize: '1rem',
  cursor: 'pointer',
} as const;
