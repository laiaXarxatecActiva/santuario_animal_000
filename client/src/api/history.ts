import type { HistoryResponse } from '@sanctuary/shared';
import { apiGet } from './client';

export interface HistoryParams {
  page?: number;
  pageSize: number;
  animalId?: number;
}

// Historial de «Mis animales» (CU-15, TECH_SPEC §10.4).
export const historyApi = {
  list: ({ page, pageSize, animalId }: HistoryParams) =>
    apiGet<HistoryResponse>('/api/me/history', { page, pageSize, animalId }),
};
