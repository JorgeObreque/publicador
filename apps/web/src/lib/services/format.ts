import { formatCurrency } from '../format';
import type { ServiceSummary } from './api';

export const formatServicePrice = (service: ServiceSummary): string =>
  formatCurrency(Number(service.price), service.currency);
