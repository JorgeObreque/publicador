'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { formatCurrency } from '@/lib/format';
import type { ServiceSummary } from '@/lib/services/api';
import type { MediaAsset } from '@/lib/media/types';
import type { CampaignDraft, ValidationIssue } from '@/lib/campaigns/wizard';
import { createCampaignWithCreative, publishCampaignPaused } from '@/lib/campaigns/api';

interface Props {
  draft: CampaignDraft;
  issues: ValidationIssue[];
  services: ServiceSummary[];
  selectedAsset: MediaAsset | null;
  maxSpend: number | null;
  onPrevious: () => void;
}

export function ReviewStep({ draft, issues, services, selectedAsset, maxSpend, onPrevious }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blockingIssues = issues.length;
  const service = services.find((item) => item.id === draft.serviceId) ?? null;

  const handleSubmit = async (publishAfter: boolean) => {
    if (!draft.selectedMediaAssetId) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await createCampaignWithCreative({
        campaign: {
          name: draft.name,
          objective: 'Recibir consultas por WhatsApp',
          serviceId: draft.serviceId ?? undefined,
          dailyBudget: Number(draft.dailyBudget),
          startDate: draft.startDate || undefined,
          endDate: draft.endDate || undefined,
          notes: draft.notes || undefined,
        },
        creative: {
          name: draft.headline.trim().slice(0, 80) || draft.name.trim().slice(0, 80),
          format: 'image',
          primaryText: draft.primaryText.trim(),
          headline: draft.headline.trim(),
          description: draft.description.trim() || undefined,
          callToAction: 'WHATSAPP_MESSAGE',
          mediaAssetId: draft.selectedMediaAssetId,
        },
        isControl: true,
      });
      if (publishAfter) {
        setPublishing(true);
        await publishCampaignPaused(result.campaign.id);
      }
      router.push(`/campaigns/${result.campaign.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
      setPublishing(false);
    }
  };

  return (
    <section style={{ display: 'grid', gap: '1rem' }}>
      <header>
        <h2 style={{ margin: 0 }}>Revisa la campaña</h2>
        <p style={{ margin: '0.25rem 0 0', color: '#52606d' }}>
          Después de crear la campaña en Publicador, podrás asociar el anuncio y enviar a Meta como pausada.
        </p>
      </header>

      <ReviewBlock title="Servicio">
        {service ? (
          <p style={reviewText}>
            {service.name}
            {service.description ? ` · ${service.description}` : ''}
          </p>
        ) : (
          <p style={errorText}>Selecciona un servicio antes de continuar.</p>
        )}
      </ReviewBlock>

      <ReviewBlock title="Mensaje">
        <p style={reviewText}>
          <strong>{draft.headline || 'Sin título'}</strong>
        </p>
        <p style={reviewText}>{draft.primaryText || 'Sin texto principal.'}</p>
        {draft.description && <p style={reviewText}>{draft.description}</p>}
      </ReviewBlock>

      <ReviewBlock title="Fotografía">
        {selectedAsset ? (
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <Image
              src={selectedAsset.thumbnailUrl}
              alt={selectedAsset.name}
              width={160}
              height={100}
              unoptimized
              style={{ borderRadius: '8px', objectFit: 'cover' }}
            />
            <div>
              <p style={{ margin: 0, fontWeight: 600 }}>{selectedAsset.name}</p>
              <p style={{ margin: 0, color: '#52606d', fontSize: '0.85rem' }}>
                {selectedAsset.mimeType.replace('image/', '').toUpperCase()}
                {selectedAsset.requiresConversion && ' · se convierte al publicar'}
              </p>
            </div>
          </div>
        ) : (
          <p style={errorText}>Selecciona una fotografía antes de continuar.</p>
        )}
      </ReviewBlock>

      <ReviewBlock title="Presupuesto">
        <p style={reviewText}>
          {draft.dailyBudget ? formatCurrency(Number(draft.dailyBudget)) : '—'} diarios ·{' '}
          {draft.startDate || 'sin inicio'} → {draft.endDate || 'sin término'}
        </p>
        {maxSpend !== null && (
          <p style={reviewText}>
            Gasto máximo estimado: <strong>{formatCurrency(maxSpend)}</strong>
          </p>
        )}
      </ReviewBlock>

      {blockingIssues > 0 && (
        <p style={errorText}>
          Hay {blockingIssues} elemento(s) por completar antes de crear la campaña.
        </p>
      )}

      {error && <p style={errorText}>{error}</p>}

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button type="button" onClick={onPrevious} style={secondaryButtonStyle}>
          Atrás
        </button>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => handleSubmit(false)}
            disabled={submitting || blockingIssues > 0}
            style={{
              ...secondaryButtonStyle,
              opacity: blockingIssues === 0 && !submitting ? 1 : 0.5,
              cursor: blockingIssues === 0 && !submitting ? 'pointer' : 'not-allowed',
            }}
          >
            {submitting && !publishing ? 'Guardando…' : 'Guardar borrador'}
          </button>
          <button
            type="button"
            onClick={() => handleSubmit(true)}
            disabled={submitting || blockingIssues > 0}
            style={{
              ...primaryButtonStyle,
              opacity: blockingIssues === 0 && !submitting ? 1 : 0.5,
              cursor: blockingIssues === 0 && !submitting ? 'pointer' : 'not-allowed',
            }}
          >
            {publishing ? 'Enviando a Meta…' : 'Crear y enviar a Meta como pausada'}
          </button>
        </div>
      </div>
    </section>
  );
}

function ReviewBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        border: '1px solid #e4e7eb',
        borderRadius: '12px',
        background: '#ffffff',
        padding: '1rem',
      }}
    >
      <p style={{ margin: 0, color: '#52606d', fontSize: '0.85rem' }}>{title}</p>
      {children}
    </div>
  );
}

const reviewText = {
  margin: '0.25rem 0 0',
  color: '#1f2933',
} as const;

const errorText = {
  margin: 0,
  color: '#991b1b',
  background: '#fee2e2',
  padding: '0.75rem',
  borderRadius: '8px',
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
