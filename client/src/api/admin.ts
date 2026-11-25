import type {
  ActivityLogsPage,
  AdminActivityLogsQuery,
  AdminStatsDto,
  AdminStatsQuery,
  AdminDonationListItemDto,
  AdminDonationMonthlyQuery,
  AdminDonationMonthlyTotalsDto,
  AdminDonationsPage,
  AdminDonationsQuery,
  ManualDonationBody,
  AdminPaymentListItemDto,
  AdminPaymentsPage,
  AdminPaymentsQuery,
  ManualPaymentBody,
  AdminAdoptionCreateBody,
  AdminAdoptionDetailDto,
  AdminAdoptionListItemDto,
  AdminAdoptionsQuery,
  AdminAdoptionStatusBody,
  AdminAnimalDto,
  AdminPhotoDto,
  AdminPlanDto,
  AdminUserDetailDto,
  AdminUserListItemDto,
  AdminUserLogoutAllBody,
  AdminUserLogoutAllDto,
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
  VetRecordBody,
  VetRecordDto,
} from '@sanctuary/shared';
import { apiDelete, apiGet, apiPatch, apiPost, apiPut, apiUpload } from './client';

export type AdminAnimalsParams = Partial<AdminAnimalsQuery>;
export type AdminUpdatesParams = Partial<AdminUpdatesQuery>;
export type AdminUsersParams = Partial<AdminUsersQuery>;
export type AdminAdoptionsParams = Partial<AdminAdoptionsQuery>;
export type AdminPaymentsParams = Partial<AdminPaymentsQuery>;
export type AdminDonationsParams = Partial<AdminDonationsQuery>;
export type AdminDonationMonthlyParams = Partial<AdminDonationMonthlyQuery>;
export type AdminActivityLogsParams = Partial<AdminActivityLogsQuery>;
export type AdminStatsParams = Partial<AdminStatsQuery>;

// Panel del personal (TECH_SPEC §10.6).
export const adminApi = {
  dashboard: () => apiGet<DashboardDto>('/api/admin/dashboard'),

  // CU-41 (solo administradores, solo lectura).
  stats: (params: AdminStatsParams) => apiGet<AdminStatsDto>('/api/admin/stats', params),

  // CU-42 (solo administradores, solo lectura).
  activityLogs: (params: AdminActivityLogsParams) => apiGet<ActivityLogsPage>('/api/admin/activity-logs', params),

  // CU-39 (solo administradores).
  donations: {
    list: (params: AdminDonationsParams) => apiGet<AdminDonationsPage>('/api/admin/donations', params),
    monthlyTotals: (params: AdminDonationMonthlyParams) =>
      apiGet<AdminDonationMonthlyTotalsDto>('/api/admin/donations/monthly-totals', params),
    create: (body: ManualDonationBody) => apiPost<AdminDonationListItemDto>('/api/admin/donations', body),
    refund: (id: number) => apiPost<AdminDonationListItemDto>(`/api/admin/donations/${id}/refund`),
  },

  // CU-38 (solo administradores).
  payments: {
    list: (params: AdminPaymentsParams) => apiGet<AdminPaymentsPage>('/api/admin/payments', params),
    create: (body: ManualPaymentBody) => apiPost<AdminPaymentListItemDto>('/api/admin/payments', body),
    refund: (id: number) => apiPost<AdminPaymentListItemDto>(`/api/admin/payments/${id}/refund`),
  },

  // CU-37 (solo administradores).
  adoptions: {
    list: (params: AdminAdoptionsParams) => apiGet<Paginated<AdminAdoptionListItemDto>>('/api/admin/adoptions', params),
    get: (id: number) => apiGet<AdminAdoptionDetailDto>(`/api/admin/adoptions/${id}`),
    create: (body: AdminAdoptionCreateBody) => apiPost<AdminAdoptionDetailDto>('/api/admin/adoptions', body),
    changeStatus: (id: number, body: AdminAdoptionStatusBody) =>
      apiPatch<AdminAdoptionDetailDto>(`/api/admin/adoptions/${id}/status`, body),
  },

  // CU-35 y CU-36 (solo administradores).
  users: {
    list: (params: AdminUsersParams) => apiGet<Paginated<AdminUserListItemDto>>('/api/admin/users', params),
    get: (id: number) => apiGet<AdminUserDetailDto>(`/api/admin/users/${id}`),
    update: (id: number, body: AdminUserPatchBody) => apiPatch<AdminUserDetailDto>(`/api/admin/users/${id}`, body),
    createWorker: (body: WorkerCreateBody) => apiPost<AdminUserDetailDto>('/api/admin/users', body),
    resendInvitation: (id: number) => apiPost<void>(`/api/admin/users/${id}/invitation`, {}),
    /** CU-48: cierra todas las sesiones del usuario (en la propia cuenta, todas menos la actual). */
    logoutAll: (id: number, body: AdminUserLogoutAllBody) =>
      apiPost<AdminUserLogoutAllDto>(`/api/admin/users/${id}/logout-all`, body),
    /** CU-51: envía al trabajador un enlace para cambiar su contraseña. */
    sendPasswordReset: (id: number) => apiPost<void>(`/api/admin/users/${id}/password-reset`, {}),
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
    /** CU-12: mostrar u ocultar a un fallecido en «En memoria». */
    setMemorial: (id: number, showInMemorial: boolean) =>
      apiPatch<AdminAnimalDto>(`/api/admin/animals/${id}/memorial`, { showInMemorial }),
    remove: (id: number) => apiDelete(`/api/admin/animals/${id}`),
  },

  // CU-34: historial veterinario (interno).
  vetRecords: {
    list: (animalId: number) => apiGet<{ data: VetRecordDto[] }>(`/api/admin/animals/${animalId}/vet-records`),
    create: (animalId: number, body: VetRecordBody) =>
      apiPost<VetRecordDto>(`/api/admin/animals/${animalId}/vet-records`, body),
    update: (id: number, body: VetRecordBody) => apiPut<VetRecordDto>(`/api/admin/vet-records/${id}`, body),
    remove: (id: number) => apiDelete(`/api/admin/vet-records/${id}`),
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
