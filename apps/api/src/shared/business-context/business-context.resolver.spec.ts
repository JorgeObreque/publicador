import { BusinessContextResolver } from './business-context.resolver';

describe('BusinessContextResolver', () => {
  const originalEnv = process.env.BUSINESS_ID;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.BUSINESS_ID;
    } else {
      process.env.BUSINESS_ID = originalEnv;
    }
  });

  it('resolves from env when present', () => {
    process.env.BUSINESS_ID = 'biz-1';
    const resolver = new BusinessContextResolver();
    expect(resolver.resolve()).toEqual({ businessId: 'biz-1', source: 'env' });
  });

  it('throws when missing', () => {
    delete process.env.BUSINESS_ID;
    const resolver = new BusinessContextResolver();
    expect(() => resolver.resolve()).toThrow(/BUSINESS_ID/);
  });
});
