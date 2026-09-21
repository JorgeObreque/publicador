export class GoogleDriveConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleDriveConfigurationError';
  }
}

export class GoogleDriveNotFoundError extends Error {
  constructor(target: string) {
    super(`Recurso de Google Drive no encontrado: ${target}`);
    this.name = 'GoogleDriveNotFoundError';
  }
}

export class GoogleDrivePermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleDrivePermissionError';
  }
}
