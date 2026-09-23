import { Injectable, Logger } from '@nestjs/common';
import { GoogleAuth } from 'google-auth-library';
import { extname } from 'node:path';
import { GoogleDriveClient, GoogleDriveFile, GoogleDriveFolder } from './google-drive.types';
import {
  GoogleDriveConfigurationError,
  GoogleDriveNotFoundError,
  GoogleDrivePermissionError,
} from './google-drive.errors';

const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);
const VIDEO_MIME_TYPES = new Set(['video/mp4', 'video/quicktime']);
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

interface DriveApiFolder {
  id: string;
  name?: string;
  mimeType?: string;
}

interface DriveApiFile {
  id: string;
  name?: string;
  mimeType?: string;
  size?: string;
  modifiedTime?: string;
  md5Checksum?: string;
  webContentLink?: string;
  parents?: string[];
}

export interface GoogleDriveConfig {
  rootFolderId: string;
  credentialsPath?: string;
  credentialsJson?: string;
}

type DriveRequest = <T>(opts: {
  url: string;
  method?: string;
  params?: Record<string, string | number | boolean | undefined>;
  responseType?: string;
}) => Promise<{ data: T }>;

@Injectable()
export class HttpGoogleDriveClient implements GoogleDriveClient {
  private readonly logger = new Logger(HttpGoogleDriveClient.name);
  private readonly rootFolderId: string;
  private readonly auth: GoogleAuth;

  constructor(config: GoogleDriveConfig) {
    if (!config.rootFolderId) {
      throw new GoogleDriveConfigurationError('GOOGLE_DRIVE_ROOT_FOLDER_ID no configurado.');
    }
    if (!config.credentialsPath && !config.credentialsJson) {
      throw new GoogleDriveConfigurationError(
        'Se requiere GOOGLE_APPLICATION_CREDENTIALS o GOOGLE_SERVICE_ACCOUNT_JSON.',
      );
    }
    this.rootFolderId = config.rootFolderId;
    const scopes = ['https://www.googleapis.com/auth/drive.readonly'];
    const credentials = config.credentialsJson ? JSON.parse(config.credentialsJson) : undefined;
    this.auth = new GoogleAuth({
      scopes,
      keyFile: config.credentialsPath,
      credentials,
    });
  }

  async listRootChildren(): Promise<{ root: GoogleDriveFolder; subFolders: GoogleDriveFolder[] }> {
    const root = await this.fetchFolder(this.rootFolderId);
    if (!root) {
      throw new GoogleDriveNotFoundError(`carpeta raíz ${this.rootFolderId}`);
    }
    const subFolders = await this.listChildrenFolders(this.rootFolderId);
    return { root, subFolders };
  }

  async listImages(folder: GoogleDriveFolder): Promise<GoogleDriveFile[]> {
    return this.listMediaInFolder(folder, IMAGE_MIME_TYPES);
  }

  async listVideos(folder: GoogleDriveFolder): Promise<GoogleDriveFile[]> {
    return this.listMediaInFolder(folder, VIDEO_MIME_TYPES);
  }

  async download(file: GoogleDriveFile): Promise<Buffer> {
    const request = await this.getRequest();
    const response = await request<ArrayBuffer>({
      url: `https://www.googleapis.com/drive/v3/files/${file.driveFileId}?alt=media`,
      responseType: 'arraybuffer',
    });
    return Buffer.from(response.data);
  }

  async fetchThumbnail(file: GoogleDriveFile): Promise<Buffer> {
    const request = await this.getRequest();
    const meta = await request<{ thumbnailLink?: string; mimeType?: string }>({
      url: `https://www.googleapis.com/drive/v3/files/${file.driveFileId}`,
      params: { fields: 'thumbnailLink,mimeType', supportsAllDrives: 'true' },
    });
    if (!meta.data.thumbnailLink) {
      throw new GoogleDriveNotFoundError(`miniatura de ${file.driveFileId}`);
    }
    const response = await request<ArrayBuffer>({
      url: meta.data.thumbnailLink,
      responseType: 'arraybuffer',
    });
    return Buffer.from(response.data);
  }

  private async getRequest(): Promise<DriveRequest> {
    const client = await this.auth.getClient();
    return (client as unknown as { request: DriveRequest }).request.bind(client);
  }

  private async fetchFolder(folderId: string): Promise<GoogleDriveFolder | null> {
    const request = await this.getRequest();
    try {
      const { data } = await request<DriveApiFolder>({
        url: `https://www.googleapis.com/drive/v3/files/${folderId}`,
        params: { fields: 'id,name,mimeType', supportsAllDrives: 'true' },
      });
      if (data.mimeType !== FOLDER_MIME_TYPE) {
        throw new Error(`El id ${folderId} no corresponde a una carpeta.`);
      }
      return { id: folderId, name: data.name ?? folderId, driveFolderId: folderId };
    } catch (error) {
      const code = this.statusCode(error);
      if (code === 404) return null;
      if (code === 403) {
        throw new GoogleDrivePermissionError(
          `La cuenta de servicio no tiene acceso a la carpeta ${folderId}.`,
        );
      }
      throw error;
    }
  }

  private async listChildrenFolders(folderId: string): Promise<GoogleDriveFolder[]> {
    const request = await this.getRequest();
    const folders: GoogleDriveFolder[] = [];
    let pageToken: string | undefined;
    do {
      const { data } = await request<{ files: DriveApiFolder[]; nextPageToken?: string }>({
        url: 'https://www.googleapis.com/drive/v3/files',
        params: {
          q: `'${folderId}' in parents and mimeType='${FOLDER_MIME_TYPE}' and trashed=false`,
          fields: 'nextPageToken,files(id,name,mimeType)',
          supportsAllDrives: 'true',
          includeItemsFromAllDrives: 'true',
          pageToken,
          pageSize: 100,
        },
      });
      for (const file of data.files ?? []) {
        if (file.id) {
          folders.push({ id: file.id, name: file.name ?? file.id, driveFolderId: file.id });
        }
      }
      pageToken = data.nextPageToken;
    } while (pageToken);
    return folders;
  }

  private async listMediaInFolder(
    folder: GoogleDriveFolder,
    allowedMimeTypes: Set<string>,
  ): Promise<GoogleDriveFile[]> {
    const request = await this.getRequest();
    const results: GoogleDriveFile[] = [];
    let pageToken: string | undefined;
    do {
      const { data } = await request<{ files: DriveApiFile[]; nextPageToken?: string }>({
        url: 'https://www.googleapis.com/drive/v3/files',
        params: {
          q: `'${folder.driveFolderId}' in parents and trashed=false`,
          fields:
            'nextPageToken,files(id,name,mimeType,size,modifiedTime,md5Checksum,webContentLink,parents)',
          supportsAllDrives: 'true',
          includeItemsFromAllDrives: 'true',
          pageToken,
          pageSize: 100,
        },
      });
      for (const file of data.files ?? []) {
        if (!file.id || !file.mimeType) continue;
        if (!allowedMimeTypes.has(file.mimeType)) continue;
        const name = file.name ?? file.id;
        const extension = extname(name).toLowerCase().replace('.', '');
        results.push({
          id: file.id,
          name,
          driveFileId: file.id,
          driveFolderId: folder.driveFolderId,
          folderKey: folder.name,
          mimeType: file.mimeType,
          sizeBytes: Number(file.size ?? 0),
          modifiedTime: file.modifiedTime ?? new Date().toISOString(),
          md5Checksum: file.md5Checksum,
          webContentLink: file.webContentLink,
          extension,
        });
      }
      pageToken = data.nextPageToken;
    } while (pageToken);
    if (results.length === 0) {
      this.logger.warn(
        `La carpeta ${folder.name} (${folder.driveFolderId}) no contiene archivos admitidos.`,
      );
    }
    return results;
  }

  private statusCode(error: unknown): number | undefined {
    const candidate = error as { code?: number; status?: number; response?: { status?: number } };
    return candidate.code ?? candidate.status ?? candidate.response?.status;
  }
}
