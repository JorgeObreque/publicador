import { Injectable, Logger } from '@nestjs/common';
import { GoogleDriveClient, GoogleDriveFile, GoogleDriveFolder } from './google-drive.types';

const DEFAULT_LIST: GoogleDriveFile[] = [];

interface LoggerMethod {
  warn: (message: string) => void;
}

@Injectable()
export class FixtureGoogleDriveClient implements GoogleDriveClient {
  private readonly logger: LoggerMethod;
  private readonly folders = new Map<string, GoogleDriveFolder>();
  private readonly filesByFolder = new Map<string, GoogleDriveFile[]>();

  constructor() {
    this.logger = new Logger(FixtureGoogleDriveClient.name);
  }

  setLayout(root: GoogleDriveFolder, subFolders: GoogleDriveFolder[]): void {
    this.folders.clear();
    this.filesByFolder.clear();
    this.folders.set(root.driveFolderId, root);
    for (const folder of subFolders) {
      this.folders.set(folder.driveFolderId, folder);
    }
  }

  putFiles(folderId: string, files: GoogleDriveFile[]): void {
    this.filesByFolder.set(folderId, [...files]);
  }

  async listRootChildren(): Promise<{ root: GoogleDriveFolder; subFolders: GoogleDriveFolder[] }> {
    const folders = [...this.folders.values()];
    const root = folders.find((folder) => folder.driveFolderId === 'root');
    if (!root) {
      const syntheticRoot: GoogleDriveFolder = {
        id: 'root',
        name: 'root',
        driveFolderId: 'root',
      };
      const subFolders = folders.filter((folder) => folder.driveFolderId !== 'root');
      this.folders.set('root', syntheticRoot);
      return { root: syntheticRoot, subFolders };
    }
    const subFolders = folders.filter((folder) => folder.driveFolderId !== 'root');
    return { root, subFolders };
  }

  async listImages(folder: GoogleDriveFolder): Promise<GoogleDriveFile[]> {
    const files = this.filesByFolder.get(folder.driveFolderId) ?? DEFAULT_LIST;
    return files.filter((file) => file.mimeType.startsWith('image/'));
  }

  async listVideos(folder: GoogleDriveFolder): Promise<GoogleDriveFile[]> {
    const files = this.filesByFolder.get(folder.driveFolderId) ?? DEFAULT_LIST;
    return files.filter((file) => file.mimeType.startsWith('video/'));
  }

  async download(file: GoogleDriveFile): Promise<Buffer> {
    this.logger.warn(`Fixture download requested for ${file.driveFileId}; returning empty buffer.`);
    return Buffer.alloc(0);
  }

  async fetchThumbnail(file: GoogleDriveFile): Promise<Buffer> {
    this.logger.warn(
      `Fixture thumbnail requested for ${file.driveFileId}; returning empty buffer.`,
    );
    return Buffer.alloc(0);
  }
}
