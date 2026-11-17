import type { ContributionsResponse, ReceiptDto } from '@sanctuary/shared';
import { apiGet } from './client';

// CU-19: aportaciones y recibos (TECH_SPEC §10.4).
export const contributionsApi = {
  list: (year?: number) => apiGet<ContributionsResponse>('/api/me/contributions', { year }),
  receipt: (kind: ReceiptDto['kind'], id: number) =>
    apiGet<ReceiptDto>(kind === 'payment' ? `/api/me/payments/${id}/receipt` : `/api/me/donations/${id}/receipt`),
};
