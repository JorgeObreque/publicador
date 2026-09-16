import axios, { AxiosInstance } from 'axios';

export interface MetaClientConfig {
  accessToken: string;
  apiVersion: string;
  adAccountId: string;
  appId?: string;
  appSecret?: string;
}

export class MetaGraphClient {
  private readonly http: AxiosInstance;

  constructor(private readonly config: MetaClientConfig) {
    if (!config.accessToken) {
      throw new Error('META_ACCESS_TOKEN no configurado');
    }
    this.http = axios.create({
      baseURL: `https://graph.facebook.com/${config.apiVersion}`,
      timeout: 30000,
      params: { access_token: config.accessToken },
    });
  }

  async get<T>(path: string, params: Record<string, unknown> = {}): Promise<T> {
    const { data } = await this.http.get<T>(path, { params });
    return data;
  }

  async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const { data } = await this.http.post<T>(path, body);
    return data;
  }

  get adAccountId(): string {
    return this.config.adAccountId;
  }
}
