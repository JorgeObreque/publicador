import { apiBaseUrl } from '../api';

export function thumbnailUrl(mediaAssetId: string): string {
  return `${apiBaseUrl.replace(/\/$/, '')}/media-assets/${mediaAssetId}/thumbnail`;
}
