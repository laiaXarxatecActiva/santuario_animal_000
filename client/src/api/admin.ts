import type {
  AdminAnimalDto,
  AdminPhotoDto,
  AdminPlanDto,
  AdminUserDetailDto,
  AdminUserListItemDto,
  AdminUserPatchBody,
  AdminUsersQuery,
  AdminUpdateCreatedDto,
  AdminUpdateDto,
  AdminUpdateListItemDto,
  AdminUpdatesQuery,
  PhotoPatchBody,
  PhotoUploadResultDto,
  PlanCreateBody,
  PlanUpdateBody,
  WorkerCreateBody,
  AdminAnimalsQuery,
  AnimalBody,
  DashboardDto,
  Paginated,
  SpeciesAdminDto,
  SpeciesBody,
  AnimalStatusBody,
} from '@sanctuary/shared';
import { apiDelete, apiGet, apiPatch, apiPost, apiPut, apiUpload } from './client';

export type AdminAnimalsParams = Partial<AdminAnimalsQuery>;
export type AdminUpdatesParams = Partial<AdminUpdatesQuery>;
export type AdminUsersParams = Partial<AdminUsersQuery>;

// Panel del personal (TECH_SPEC §10.6).
export const adminApi = {
  dashboard: () => apiGet<DashboardDto>('/api/admin/dashboard'),

  // CU-35 y CU-36 (solo administradores).
  users: {
    list: (params: AdminUsersParams) => apiGet<Paginated<AdminUserListItemDto>>('/api/admin/users', params),
    get: (id: number) => apiGet<AdminUserDetailDto>(`/api/admin/users/${id}`),
    update: (id: number, body: AdminUserPatchBody) => apiPatch<AdminUserDetailDto>(`/api/admin/users/${id}`, body),
    createWorker: (body: WorkerCreateBody) => apiPost<AdminUserDetailDto>('/api/admin/users', body),
    resendInvitation: (id: number) => apiPost<void>(`/api/admin/users/${id}/invitation`, {}),
  },

  // CU-40 (solo administradores).
  plans: {
    list: () => apiGet<{ data: AdminPlanDto[] }>('/api/admin/plans'),
    create: (body: PlanCreateBody) => apiPost<AdminPlanDto>('/api/admin/plans', body),
    update: (id: number, body: PlanUpdateBody) => apiPut<AdminPlanDto>(`/api/admin/plans/${id}`, body),
  },

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

  // CU-29: galería de un animal.
  photos: {
    list: (animalId: number) => apiGet<{ data: AdminPhotoDto[] }>(`/api/admin/animals/${animalId}/photos`),
    upload: (animalId: number, datos: FormData) =>
      apiUpload<PhotoUploadResultDto>(`/api/admin/animals/${animalId}/photos`, datos),
    update: (id: number, body: PhotoPatchBody) => apiPatch<AdminPhotoDto>(`/api/admin/photos/${id}`, body),
    reorder: (animalId: number, photoIds: number[]) =>
      apiPut(`/api/admin/animals/${animalId}/photos/order`, { photoIds }),
    setCover: (animalId: number, photoId: number) => apiPut(`/api/admin/animals/${animalId}/cover`, { photoId }),
    remove: (id: number) => apiDelete(`/api/admin/photos/${id}`),
  },

  // CU-31 y CU-32: actualizaciones (multipart, por si llevan archivos).
  updates: {
    list: (params: AdminUpdatesParams) => apiGet<Paginated<AdminUpdateListItemDto>>('/api/admin/updates', params),
    get: (id: number) => apiGet<AdminUpdateDto>(`/api/admin/updates/${id}`),
    create: (datos: FormData) => apiUpload<AdminUpdateCreatedDto>('/api/admin/updates', datos),
    update: (id: number, datos: FormData) => apiUpload<AdminUpdateDto>(`/api/admin/updates/${id}`, datos, 'PUT'),
    remove: (id: number) => apiDelete(`/api/admin/updates/${id}`),
  },
};
