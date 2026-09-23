export type MediaAssetStatus = 'READY' | 'MISSING' | 'ARCHIVED';

export interface MediaAsset {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  status: MediaAssetStatus;
  kind: 'IMAGE' | 'VIDEO';
  source: 'GOOGLE_DRIVE' | 'URL';
  externalFileId: string;
  modifiedTime: string | null;
  requiresConversion: boolean;
  isAvailable: boolean;
  thumbnailUrl: string;
}

export interface MediaAssetSyncResult {
  rootFolderId: string;
  folders: {
    images?: { folderId: string; discovered: number; upserts: number; archived: number; reused: number };
    videos?: { folderId: string; discovered: number; upserts: number; archived: number; reused: number };
  };
  failures: Array<{ folder: string; message: string }>;
}
