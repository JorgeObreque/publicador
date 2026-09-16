import { BadRequestException } from '@nestjs/common';
import {
  buildAttributionCode,
  extractAttributionCode,
  parseAttributionCode,
} from './attribution-code';

describe('attribution code utilities', () => {
  it('builds canonical code', () => {
    expect(buildAttributionCode('cmp-001', 'a')).toBe('ADS:CMP-001-A');
  });

  it('parses valid code', () => {
    expect(parseAttributionCode('ADS:CMP-001-B')).toEqual({
      campaignCode: 'CMP-001',
      variantCode: 'B',
    });
  });

  it('rejects invalid code', () => {
    expect(() => parseAttributionCode('NOPE')).toThrow(BadRequestException);
  });

  it('returns null when no input is provided', () => {
    expect(parseAttributionCode(null)).toBeNull();
    expect(extractAttributionCode(null)).toBeNull();
  });

  it('extracts code from mixed notes', () => {
    expect(extractAttributionCode('Hola, soy clienta. ADS:CMP-007-A por favor')).toBe(
      'ADS:CMP-007-A',
    );
    expect(extractAttributionCode('Sin código')).toBeNull();
  });
});
