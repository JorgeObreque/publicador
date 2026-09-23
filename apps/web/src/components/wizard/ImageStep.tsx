'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { MediaAsset } from '@/lib/media/types';
import type { CampaignDraft } from '@/lib/campaigns/wizard';
import { issueForField } from '@/lib/campaigns/wizard';
import type { ValidationIssue } from '@/lib/campaigns/wizard';

interface Props {
  assets: MediaAsset[];
  draft: CampaignDraft;
  issues: ValidationIssue[];
  onChange: (updater: (draft: CampaignDraft) => CampaignDraft) => void;
  onSync: () => Promise<void>;
  onNext: () => void;
  onPrevious: () => void;
}

export function ImageStep({
  assets,
  draft,
  issues,
  onChange,
  onSync,
  onNext,
  onPrevious,
}: Props) {
  const selectionError = issueForField(issues, 'image', 'selectedMediaAssetId');
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

  const loading = false;

  return (
    <section style={{ display: 'grid', gap: '1rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>Elige una fotografía</h2>
          <p style={{ margin: '0.25rem 0 0', color: '#52606d' }}>
            Las imágenes se muestran desde Google Drive y no se guardan en Publicador.
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

      {error && <p style={errorStyle}>{error}</p>}
      {selectionError && <p style={errorStyle}>{selectionError}</p>}

      {loading ? (
        <p style={{ color: '#52606d' }}>Cargando galería…</p>
      ) : assets.length === 0 ? (
        <p style={{ color: '#52606d' }}>
          No hay imágenes disponibles. Sincroniza Google Drive para empezar.
        </p>
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
                  onClick={() => onChange((current) => ({ ...current, selectedMediaAssetId: asset.id }))}
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
                  <Image
                    src={asset.thumbnailUrl}
                    alt={asset.name}
                    width={320}
                    height={200}
                    unoptimized
                    style={{ width: '100%', height: 'auto', display: 'block' }}
                  />
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
                      {asset.mimeType.replace('image/', '').toUpperCase()}
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
