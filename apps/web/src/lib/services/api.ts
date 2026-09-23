import { apiFetch } from '../api';

export interface ServiceSummary {
  id: string;
  name: string;
  description: string | null;
  price: string;
  currency: string;
  duration: number | null;
}

export const listServices = () =>
  apiFetch<ServiceSummary[]>('/services', undefined, { cache: 'no-store' });
