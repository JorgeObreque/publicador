import { Injectable, Logger } from '@nestjs/common';
import { GoogleDriveClient, GoogleDriveFile, GoogleDriveFolder } from './google-drive.types';
import { GoogleDriveConfigService } from './google-drive.config';
import { HttpGoogleDriveClient } from './http-google-drive.client';
import { FixtureGoogleDriveClient } from './fixture-google-drive.client';
import { GoogleDriveConfigurationError } from './google-drive.errors';

@Injectable()
export class GoogleDriveService {
  private readonly logger = new Logger(GoogleDriveService.name);
  private readonly client: GoogleDriveClient;

  constructor(
    configService: GoogleDriveConfigService,
    fixtureClient: FixtureGoogleDriveClient,
  ) {
    const config = configService.load();
    const isTest = process.env.NODE_ENV === 'test';
    if (isTest || (!config.credentialsPath && !config.credentialsJson)) {
      this.client = fixtureClient;
      return;
    }
    if (!config.rootFolderId) {
      throw new GoogleDriveConfigurationError('GOOGLE_DRIVE_ROOT_FOLDER_ID no configurado.');
    }
    this.client = new HttpGoogleDriveClient(config);
  }

  async findNamedSubfolders(): Promise<{ images?: GoogleDriveFolder; videos?: GoogleDriveFolder }> {
    const { subFolders } = await this.client.listRootChildren();
    const result: { images?: GoogleDriveFolder; videos?: GoogleDriveFolder } = {};
    for (const folder of subFolders) {
      const normalized = folder.name.trim().toLowerCase();
      if (normalized === 'imagenes' || normalized === 'imágenes') {
        result.images = folder;
      } else if (normalized === 'videos' || normalized === 'vídeos') {
        result.videos = folder;
      }
    }
    return result;
  }

  async listImages(folder: GoogleDriveFolder): Promise<GoogleDriveFile[]> {
    return this.client.listImages(folder);
  }

  async listVideos(folder: GoogleDriveFolder): Promise<GoogleDriveFile[]> {
    return this.client.listVideos(folder);
  }

  async download(file: GoogleDriveFile): Promise<Buffer> {
    return this.client.download(file);
  }

  getClient(): GoogleDriveClient {
    return this.client;
  }
}
