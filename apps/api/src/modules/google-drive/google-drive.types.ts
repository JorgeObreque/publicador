export interface GoogleDriveFolder {
  id: string;
  name: string;
  driveFolderId: string;
}

export interface GoogleDriveFile {
  id: string;
  name: string;
  driveFileId: string;
  driveFolderId: string;
  folderKey: string;
  mimeType: string;
  sizeBytes: number;
  modifiedTime: string;
  md5Checksum?: string;
  webContentLink?: string;
  extension: string;
}

export interface GoogleDriveClient {
  listRootChildren(): Promise<{ root: GoogleDriveFolder; subFolders: GoogleDriveFolder[] }>;
  listImages(folder: GoogleDriveFolder): Promise<GoogleDriveFile[]>;
  listVideos(folder: GoogleDriveFolder): Promise<GoogleDriveFile[]>;
  download(file: GoogleDriveFile): Promise<Buffer>;
}
