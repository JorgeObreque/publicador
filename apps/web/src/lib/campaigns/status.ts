import type { CampaignStatus, MetaPublishStatus } from './types';

export interface CampaignDisplayStatus {
  key: string;
  label: string;
  description: string;
  tone: 'neutral' | 'pending' | 'paused' | 'archived' | 'error';
}

export const displayStatus = (campaign: {
  status: CampaignStatus;
  metaPublishStatus: MetaPublishStatus;
  metaPublishError?: string | null;
}): CampaignDisplayStatus => {
  if (campaign.status === 'ARCHIVED') {
    return {
      key: 'ARCHIVED',
      label: 'Archivada',
      description: 'Esta campaña ya no se mostrará en el listado activo.',
      tone: 'archived',
    };
  }
  if (campaign.metaPublishError) {
    return {
      key: 'PUBLISH_ERROR',
      label: 'Error al publicar',
      description: campaign.metaPublishError,
      tone: 'error',
    };
  }
  if (campaign.metaPublishStatus === 'PUBLISHING') {
    return {
      key: 'PUBLISHING',
      label: 'Enviando a Meta',
      description: 'Estamos creando los elementos en Meta.',
      tone: 'pending',
    };
  }
  if (campaign.status === 'PAUSED' || campaign.metaPublishStatus === 'PAUSED') {
    return {
      key: 'PUBLISHED_PAUSED',
      label: 'Publicada y pausada',
      description: 'La campaña existe en Meta pero no genera gastos.',
      tone: 'paused',
    };
  }
  return {
    key: 'DRAFT',
    label: 'Borrador',
    description: 'Aún no se ha enviado a Meta.',
    tone: 'neutral',
  };
};
