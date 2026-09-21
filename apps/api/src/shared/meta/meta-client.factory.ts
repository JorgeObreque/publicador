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
      businessId: process.env.META_BUSINESS_ID,
      pageId: process.env.META_PAGE_ID,
      instagramAccountId: process.env.META_INSTAGRAM_ACCOUNT_ID,
      whatsappPhoneNumberId: process.env.META_WHATSAPP_PHONE_NUMBER_ID,
      whatsappNumber: process.env.META_WHATSAPP_NUMBER,
      accountTimezone: process.env.META_AD_ACCOUNT_TIMEZONE ?? 'Pacific/Easter',
      currency: process.env.BUSINESS_CURRENCY ?? 'CLP',
    };
    return new MetaGraphClient(config);
  }
}
