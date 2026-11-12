import type { DashboardDto } from '@sanctuary/shared';
import { apiGet } from './client';

// Panel del personal (TECH_SPEC §10.6).
export const adminApi = {
  dashboard: () => apiGet<DashboardDto>('/api/admin/dashboard'),
};
