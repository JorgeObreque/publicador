import { apiFetch } from '../api';

export interface Creative {
  id: string;
  name: string;
  format: string;
  primaryText: string;
  headline: string;
  description: string | null;
  callToAction: string;
  imageUrl: string | null;
  mediaAssetId: string | null;
  isAiGenerated: boolean;
  metaCreativeId: string | null;
}

export interface CreativeAttachment {
  id: string;
  campaignId: string;
  creativeId: string;
  attributionCode: string;
  isControl: boolean;
  metaCreativeId: string | null;
  metaAdId: string | null;
  metaPublishedAt: string | null;
  creative?: Creative;
}

export interface CreateCreativeInput {
  name: string;
  format: string;
  primaryText: string;
  headline: string;
  description?: string;
  callToAction: string;
  mediaAssetId: string;
}

export const createCreative = (input: CreateCreativeInput) =>
  apiFetch<Creative>('/creatives', {
    method: 'POST',
    body: JSON.stringify(input),
  });

export interface AttachCreativeInput {
  campaignId: string;
  creativeId: string;
  isControl?: boolean;
}

export const attachCreative = (input: AttachCreativeInput) =>
  apiFetch<CreativeAttachment>('/creatives/attach', {
    method: 'POST',
    body: JSON.stringify(input),
  });
