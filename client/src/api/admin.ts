import type {
  AdminAnimalDto,
  AdminAnimalsQuery,
  AnimalBody,
  DashboardDto,
  Paginated,
  SpeciesAdminDto,
  SpeciesBody,
  AnimalStatusBody,
} from '@sanctuary/shared';
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from './client';

export type AdminAnimalsParams = Partial<AdminAnimalsQuery>;

// Panel del personal (TECH_SPEC §10.6).
export const adminApi = {
  dashboard: () => apiGet<DashboardDto>('/api/admin/dashboard'),

  species: {
    list: () => apiGet<{ data: SpeciesAdminDto[] }>('/api/admin/species'),
    create: (body: SpeciesBody) => apiPost<SpeciesAdminDto>('/api/admin/species', body),
    update: (id: number, body: SpeciesBody) => apiPut<SpeciesAdminDto>(`/api/admin/species/${id}`, body),
    remove: (id: number) => apiDelete(`/api/admin/species/${id}`),
  },

  animals: {
    list: (params: AdminAnimalsParams) => apiGet<Paginated<AdminAnimalDto>>('/api/admin/animals', params),
    get: (id: number) => apiGet<AdminAnimalDto>(`/api/admin/animals/${id}`),
    create: (body: AnimalBody) => apiPost<AdminAnimalDto>('/api/admin/animals', body),
    update: (id: number, body: AnimalBody) => apiPut<AdminAnimalDto>(`/api/admin/animals/${id}`, body),
    changeStatus: (id: number, body: AnimalStatusBody) =>
      apiPatch<AdminAnimalDto>(`/api/admin/animals/${id}/status`, body),
    remove: (id: number) => apiDelete(`/api/admin/animals/${id}`),
  },
};
