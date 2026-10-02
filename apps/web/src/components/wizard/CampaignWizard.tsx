'use client';

import { useCallback, useEffect, useState } from 'react';
import { listImages, listVideos, syncDrive } from '@/lib/media/api';
import type { MediaAsset } from '@/lib/media/types';
import type { ServiceSummary } from '@/lib/services/api';
import { listServices } from '@/lib/services/api';
import { CampaignWizardNav } from '@/components/CampaignWizardNav';
import { useCampaignWizard } from '@/lib/campaigns/use-campaign-wizard';
import type { CampaignDraft } from '@/lib/campaigns/wizard';
import { ServiceStep } from './ServiceStep';
import { ImageStep } from './ImageStep';
import { CopyStep } from './CopyStep';
import { BudgetStep } from './BudgetStep';
import { ReviewStep } from './ReviewStep';

interface Props {
  initialDraft?: CampaignDraft;
}

export function CampaignWizard({ initialDraft }: Props = {}) {
  const wizard = useCampaignWizard(initialDraft);
  const [services, setServices] = useState<ServiceSummary[]>([]);
  const [images, setImages] = useState<MediaAsset[]>([]);
  const [videos, setVideos] = useState<MediaAsset[]>([]);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listServices(), listImages(), listVideos()])
      .then(([serviceList, imageList, videoList]) => {
        setServices(serviceList);
        setImages(imageList);
        setVideos(videoList);
      })
      .catch((err: Error) => setBootError(err.message));
  }, []);

  const refreshAssets = useCallback(async () => {
    const [imageList, videoList] = await Promise.all([listImages(), listVideos()]);
    setImages(imageList);
    setVideos(videoList);
  }, []);

  const handleSync = useCallback(async () => {
    await syncDrive();
    await refreshAssets();
  }, [refreshAssets]);

  const allAssets = [...images, ...videos];
  const selectedAsset =
    allAssets.find((asset) => asset.id === wizard.draft.selectedMediaAssetId) ?? null;

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
          images={images}
          videos={videos}
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
