'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { MediaAsset } from '@/lib/media/types';
import type { CampaignDraft } from '@/lib/campaigns/wizard';
import { issueForField } from '@/lib/campaigns/wizard';
import type { ValidationIssue } from '@/lib/campaigns/wizard';

interface Props {
  images: MediaAsset[];
  videos: MediaAsset[];
  draft: CampaignDraft;
  issues: ValidationIssue[];
  onChange: (updater: (draft: CampaignDraft) => CampaignDraft) => void;
  onSync: () => Promise<void>;
  onNext: () => void;
  onPrevious: () => void;
}

type ResourceTab = 'IMAGE' | 'VIDEO';

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

export function ImageStep({
  images,
  videos,
  draft,
  issues,
  onChange,
  onSync,
  onNext,
  onPrevious,
}: Props) {
  const selectionError = issueForField(issues, 'image', 'selectedMediaAssetId');
  const [tab, setTab] = useState<ResourceTab>('IMAGE');
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      await onSync();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  const assets = tab === 'IMAGE' ? images : videos;
  const emptyMessage =
    tab === 'IMAGE'
      ? 'No hay imágenes disponibles. Sincroniza Google Drive para empezar.'
      : 'No hay videos disponibles. Sincroniza Google Drive para empezar.';
  const videoOnlyHint =
    tab === 'VIDEO'
      ? 'Los videos se registran como referencia. La publicación con video aún no está habilitada en este paso.'
      : null;

  return (
    <section style={{ display: 'grid', gap: '1rem' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Imagen o video</h2>
          <p style={{ margin: '0.25rem 0 0', color: '#52606d' }}>
            Se muestran desde Google Drive y no se guardan en Publicador.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSync}
          disabled={syncing}
          style={{
            padding: '0.5rem 0.85rem',
            borderRadius: '8px',
            border: '1px solid #cbd2d9',
            background: '#ffffff',
            cursor: syncing ? 'not-allowed' : 'pointer',
          }}
        >
          {syncing ? 'Sincronizando…' : 'Sincronizar Drive'}
        </button>
      </header>

      <nav style={{ display: 'flex', gap: '0.5rem' }} aria-label="Tipo de recurso">
        <TabButton
          label={`Imágenes (${images.length})`}
          active={tab === 'IMAGE'}
          onClick={() => setTab('IMAGE')}
        />
        <TabButton
          label={`Videos (${videos.length})`}
          active={tab === 'VIDEO'}
          onClick={() => setTab('VIDEO')}
        />
      </nav>

      {error && <p style={errorStyle}>{error}</p>}
      {selectionError && <p style={errorStyle}>{selectionError}</p>}
      {videoOnlyHint && (
        <p
          style={{
            color: '#92400e',
            background: '#fef3c7',
            padding: '0.75rem',
            borderRadius: '8px',
            margin: 0,
          }}
        >
          {videoOnlyHint}
        </p>
      )}

      {assets.length === 0 ? (
        <p style={{ color: '#52606d' }}>{emptyMessage}</p>
      ) : (
        <ul
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: '0.75rem',
            listStyle: 'none',
            padding: 0,
            margin: 0,
          }}
        >
          {assets.map((asset) => {
            const selected = asset.id === draft.selectedMediaAssetId;
            return (
              <li key={asset.id}>
                <button
                  type="button"
                  onClick={() =>
                    onChange((current) => ({ ...current, selectedMediaAssetId: asset.id }))
                  }
                  style={{
                    width: '100%',
                    padding: 0,
                    borderRadius: '12px',
                    border: selected ? '2px solid #1f2933' : '1px solid #e4e7eb',
                    background: '#ffffff',
                    cursor: 'pointer',
                    overflow: 'hidden',
                  }}
                >
                  <ResourcePreview asset={asset} />
                  <span
                    style={{
                      display: 'block',
                      padding: '0.5rem 0.75rem',
                      textAlign: 'left',
                      fontSize: '0.85rem',
                    }}
                  >
                    <strong style={{ display: 'block', color: '#1f2933' }}>{asset.name}</strong>
                    <span style={{ color: '#52606d' }}>
                      {asset.kind === 'IMAGE'
                        ? asset.mimeType.replace('image/', '').toUpperCase()
                        : asset.mimeType.replace('video/', '').toUpperCase()}{' '}
                      · {formatBytes(asset.sizeBytes)}
                      {asset.requiresConversion && ' · se convierte al publicar'}
                      {asset.status !== 'READY' && ' · no disponible'}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button type="button" onClick={onPrevious} style={secondaryButtonStyle}>
          Atrás
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!draft.selectedMediaAssetId}
          style={{
            ...primaryButtonStyle,
            opacity: draft.selectedMediaAssetId ? 1 : 0.5,
            cursor: draft.selectedMediaAssetId ? 'pointer' : 'not-allowed',
          }}
        >
          Continuar
        </button>
      </div>
    </section>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        padding: '0.45rem 0.85rem',
        borderRadius: '999px',
        border: '1px solid',
        borderColor: active ? '#1f2933' : '#cbd2d9',
        background: active ? '#1f2933' : '#ffffff',
        color: active ? '#ffffff' : '#1f2933',
        cursor: 'pointer',
        fontSize: '0.9rem',
      }}
    >
      {label}
    </button>
  );
}

function ResourcePreview({ asset }: { asset: MediaAsset }) {
  if (asset.kind === 'VIDEO') {
    return (
      <video
        src={asset.thumbnailUrl}
        muted
        playsInline
        preload="metadata"
        style={{ width: '100%', height: 'auto', display: 'block', background: '#1f2933' }}
      />
    );
  }
  return (
    <Image
      src={asset.thumbnailUrl}
      alt={asset.name}
      width={320}
      height={200}
      unoptimized
      style={{ width: '100%', height: 'auto', display: 'block' }}
    />
  );
}

const errorStyle = {
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
