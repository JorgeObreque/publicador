import { Injectable } from '@nestjs/common';
import { MetaGraphClient, MetaClientConfig } from './meta-graph.client';

@Injectable()
export class MetaClientFactory {
  create(): MetaGraphClient {
    const config: MetaClientConfig = {
      accessToken: process.env.META_ACCESS_TOKEN ?? '',
      apiVersion: process.env.META_API_VERSION ?? 'v20.0',
      adAccountId: process.env.META_AD_ACCOUNT_ID ?? '',
      appId: process.env.META_APP_ID,
      appSecret: process.env.META_APP_SECRET,
    };
    return new MetaGraphClient(config);
  }
}
