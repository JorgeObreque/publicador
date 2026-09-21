import axios, { AxiosInstance } from 'axios';
import { createHmac } from 'node:crypto';

export interface MetaClientConfig {
  accessToken: string;
  apiVersion: string;
  adAccountId: string;
  appId?: string;
  appSecret?: string;
  businessId?: string;
  pageId?: string;
  instagramAccountId?: string;
  whatsappPhoneNumberId?: string;
  whatsappNumber?: string;
  accountTimezone: string;
  currency: string;
}

export class MetaGraphClient {
  private readonly http: AxiosInstance;

  constructor(private readonly config: MetaClientConfig) {
    if (!config.accessToken) {
      throw new Error('META_ACCESS_TOKEN no configurado');
    }
    const params: Record<string, string> = { access_token: config.accessToken };
    if (config.appSecret) {
      params.appsecret_proof = createHmac('sha256', config.appSecret)
        .update(config.accessToken)
        .digest('hex');
    }
    this.http = axios.create({
      baseURL: `https://graph.facebook.com/${config.apiVersion}`,
      timeout: 30000,
      params,
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

  get settings(): Readonly<MetaClientConfig> {
    return this.config;
  }
}
