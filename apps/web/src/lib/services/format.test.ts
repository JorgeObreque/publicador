import { formatServicePrice } from './format';
import type { ServiceSummary } from './api';

describe('formatServicePrice', () => {
  it('formatea el precio en pesos chilenos', () => {
    const service: ServiceSummary = {
      id: 'svc',
      name: 'Balayage',
      description: null,
      price: '95500',
      currency: 'CLP',
      duration: 120,
    };
    expect(formatServicePrice(service)).toContain('95');
  });
});
