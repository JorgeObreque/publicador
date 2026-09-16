import { MetaGraphClient } from './meta-graph.client';

describe('MetaGraphClient', () => {
  const baseConfig = {
    accessToken: 'token',
    apiVersion: 'v20.0',
    adAccountId: 'act_1',
  };

  it('builds requests against graph.facebook.com', () => {
    const client = new MetaGraphClient(baseConfig);
    expect(client.adAccountId).toBe('act_1');
  });

  it('throws without access token', () => {
    expect(() => new MetaGraphClient({ ...baseConfig, accessToken: '' })).toThrow(/META_ACCESS_TOKEN/);
  });
});
