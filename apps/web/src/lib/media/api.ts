import { apiFetch, apiBaseUrl } from '../api';
import type { MediaAsset, MediaAssetSyncResult } from './types';
import { thumbnailUrl } from './url';

const withThumb = (asset: Omit<MediaAsset, 'thumbnailUrl'>, baseUrl: string): MediaAsset => ({
  ...asset,
  thumbnailUrl: `${baseUrl.replace(/\/$/, '')}/media-assets/${asset.id}/thumbnail`,
});

export const listMediaAssets = async (): Promise<MediaAsset[]> => {
  const data = await apiFetch<Omit<MediaAsset, 'thumbnailUrl'>[]>(
    '/media-assets',
    undefined,
    { cache: 'no-store' },
  );
  return data.map((asset) => withThumb(asset, apiBaseUrl));
};

export const listImages = async (): Promise<MediaAsset[]> => {
  const data = await apiFetch<Omit<MediaAsset, 'thumbnailUrl'>[]>(
    '/media-assets/images',
    undefined,
    { cache: 'no-store' },
  );
  return data.map((asset) => withThumb(asset, apiBaseUrl));
};

export const syncDrive = () =>
  apiFetch<MediaAssetSyncResult>('/media-assets/drive/sync', { method: 'POST' });

export { thumbnailUrl };
