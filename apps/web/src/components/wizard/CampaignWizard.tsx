'use client';

import { useCallback, useEffect, useState } from 'react';
import { listImages, syncDrive } from '@/lib/media/api';
import type { MediaAsset } from '@/lib/media/types';
import type { ServiceSummary } from '@/lib/services/api';
import { listServices } from '@/lib/services/api';
import { CampaignWizardNav } from '@/components/CampaignWizardNav';
import { useCampaignWizard } from '@/lib/campaigns/use-campaign-wizard';
import { ServiceStep } from './ServiceStep';
import { ImageStep } from './ImageStep';
import { CopyStep } from './CopyStep';
import { BudgetStep } from './BudgetStep';
import { ReviewStep } from './ReviewStep';

export function CampaignWizard() {
  const wizard = useCampaignWizard();
  const [services, setServices] = useState<ServiceSummary[]>([]);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listServices(), listImages()])
      .then(([serviceList, imageList]) => {
        setServices(serviceList);
        setAssets(imageList);
      })
      .catch((err: Error) => setBootError(err.message));
  }, []);

  const refreshAssets = useCallback(async () => {
    const imageList = await listImages();
    setAssets(imageList);
  }, []);

  const handleSync = useCallback(async () => {
    await syncDrive();
    await refreshAssets();
  }, [refreshAssets]);

  const selectedAsset =
    assets.find((asset) => asset.id === wizard.draft.selectedMediaAssetId) ?? null;

  if (bootError) {
    return <p style={{ color: '#991b1b' }}>No pudimos preparar el asistente: {bootError}</p>;
  }

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      <CampaignWizardNav current={wizard.stepId} onSelect={wizard.goTo} />
      {wizard.stepId === 'service' && (
        <ServiceStep
          services={services}
          draft={wizard.draft}
          issues={wizard.issues}
          onChange={wizard.setDraft}
          onNext={wizard.next}
        />
      )}
      {wizard.stepId === 'image' && (
        <ImageStep
          assets={assets}
          draft={wizard.draft}
          issues={wizard.issues}
          onChange={wizard.setDraft}
          onSync={handleSync}
          onNext={wizard.next}
          onPrevious={wizard.previous}
        />
      )}
      {wizard.stepId === 'copy' && (
        <CopyStep
          draft={wizard.draft}
          issues={wizard.issues}
          onChange={wizard.setDraft}
          onNext={wizard.next}
          onPrevious={wizard.previous}
        />
      )}
      {wizard.stepId === 'budget' && (
        <BudgetStep
          draft={wizard.draft}
          maxSpend={wizard.maxSpend}
          issues={wizard.issues}
          onChange={wizard.setDraft}
          onNext={wizard.next}
          onPrevious={wizard.previous}
        />
      )}
      {wizard.stepId === 'review' && (
        <ReviewStep
          draft={wizard.draft}
          issues={wizard.issues}
          services={services}
          selectedAsset={selectedAsset}
          maxSpend={wizard.maxSpend}
          onPrevious={wizard.previous}
        />
      )}
    </div>
  );
}
