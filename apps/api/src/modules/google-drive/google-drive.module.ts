import { Global, Module } from '@nestjs/common';
import { FixtureGoogleDriveClient } from './fixture-google-drive.client';
import { GoogleDriveService } from './google-drive.service';
import { GoogleDriveConfigService } from './google-drive.config';

@Global()
@Module({
  providers: [
    GoogleDriveConfigService,
    GoogleDriveService,
    FixtureGoogleDriveClient,
  ],
  exports: [GoogleDriveService, GoogleDriveConfigService, FixtureGoogleDriveClient],
})
export class GoogleDriveModule {}
