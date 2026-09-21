import { Injectable } from '@nestjs/common';
import { existsSync } from 'node:fs';

export interface GoogleDriveConfig {
  rootFolderId: string;
  credentialsPath?: string;
  credentialsJson?: string;
}

@Injectable()
export class GoogleDriveConfigService {
  load(): GoogleDriveConfig {
    const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const credentialsJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    const config: GoogleDriveConfig = { rootFolderId: '' };
    if (rootFolderId) {
      config.rootFolderId = rootFolderId;
    }
    if (credentialsPath && existsSync(credentialsPath)) {
      config.credentialsPath = credentialsPath;
    } else if (credentialsJson) {
      config.credentialsJson = credentialsJson;
    }
    return config;
  }
}
