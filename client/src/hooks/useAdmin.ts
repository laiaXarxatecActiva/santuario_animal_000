import { ARCHIVED_ANIMAL_STATUSES, type AnimalStatus } from '@sanctuary/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  adminApi,
  type AdminActivityLogsParams,
  type AdminAdoptionsParams,
  type AdminAnimalsParams,
  type AdminDonationMonthlyParams,
  type AdminDonationsParams,
  type AdminPaymentsParams,
  type AdminStatsParams,
  type AdminUpdatesParams,
  type AdminUsersParams,
} from '../api/admin';

export const ADMIN_KEY = ['admin'] as const;
export const ADMIN_SPECIES_KEY = [...ADMIN_KEY, 'species'] as const;
export const ADMIN_ANIMALS_KEY = [...ADMIN_KEY, 'animals'] as const;

/** CU-27: resumen del escritorio. */
export const useDashboard = () => useQuery({ queryKey: [...ADMIN_KEY, 'dashboard'], queryFn: adminApi.dashboard });

/** CU-41: estadísticas del rango elegido (por defecto, los últimos 12 meses). */
export const useAdminStats = (params: AdminStatsParams) =>
  useQuery({
    queryKey: [...ADMIN_KEY, 'stats', params],
    queryFn: () => adminApi.stats(params),
    placeholderData: keepPreviousData,
  });

/** CU-42: registro de actividad con filtros y páginas. */
export const useAdminActivityLogs = (params: AdminActivityLogsParams, enabled = true) =>
  useQuery({
    queryKey: [...ADMIN_KEY, 'activity', params],
    queryFn: () => adminApi.activityLogs(params),
    placeholderData: keepPreviousData,
    enabled,
  });

/** Trabajadores (administradores y cuidadores), para el filtro de usuario de CU-42. */
export const useWorkers = () =>
  useQuery({
    queryKey: [...ADMIN_KEY, 'users', 'workers'],
    queryFn: async () => {
      const [admins, cuidadores] = await Promise.all([
        adminApi.users.list({ role: 'admin', pageSize: 100 }),
        adminApi.users.list({ role: 'caretaker', pageSize: 100 }),
      ]);
      return [...admins.data, ...cuidadores.data].sort((a, b) => a.firstName.localeCompare(b.firstName, 'es'));
    },
  });

export const ADMIN_DONATIONS_KEY = [...ADMIN_KEY, 'donations'] as const;

/** CU-39 paso 2: listado con filtros, páginas y suma de lo recaudado. */
export const useAdminDonations = (params: AdminDonationsParams) =>
  useQuery({
    queryKey: [...ADMIN_DONATIONS_KEY, 'list', params],
    queryFn: () => adminApi.donations.list(params),
    placeholderData: keepPreviousData,
  });

/** CU-39 paso 3: lo cobrado cada mes. Solo se pide al abrir la pestaña. */
export const useAdminDonationMonthlyTotals = (params: AdminDonationMonthlyParams, enabled: boolean) =>
  useQuery({
    queryKey: [...ADMIN_DONATIONS_KEY, 'monthly', params],
    queryFn: () => adminApi.donations.monthlyTotals(params),
    enabled,
  });

export const ADMIN_PAYMENTS_KEY = [...ADMIN_KEY, 'payments'] as const;

/** CU-38: listado con filtros, páginas y suma de lo cobrado. */
export const useAdminPayments = (params: AdminPaymentsParams) =>
  useQuery({
    queryKey: [...ADMIN_PAYMENTS_KEY, 'list', params],
    queryFn: () => adminApi.payments.list(params),
    placeholderData: keepPreviousData,
  });

export const ADMIN_ADOPTIONS_KEY = [...ADMIN_KEY, 'adoptions'] as const;

/** CU-37: listado con búsqueda, filtros y páginas. */
export const useAdminAdoptions = (params: AdminAdoptionsParams) =>
  useQuery({
    queryKey: [...ADMIN_ADOPTIONS_KEY, 'list', params],
    queryFn: () => adminApi.adoptions.list(params),
    placeholderData: keepPreviousData,
  });

/** CU-37 paso 3: ficha de la adopción con sus pagos. */
export const useAdminAdoption = (id: number | undefined) =>
  useQuery({
    queryKey: [...ADMIN_ADOPTIONS_KEY, 'detail', id ?? 0],
    queryFn: () => adminApi.adoptions.get(id ?? 0),
    enabled: id !== undefined,
  });

export const ADMIN_USERS_KEY = [...ADMIN_KEY, 'users'] as const;

/** CU-35: listado con búsqueda, filtros y páginas. */
export const useAdminUsers = (params: AdminUsersParams) =>
  useQuery({
    queryKey: [...ADMIN_USERS_KEY, 'list', params],
    queryFn: () => adminApi.users.list(params),
    placeholderData: keepPreviousData,
  });

export const adminUserKey = (id: number) => [...ADMIN_USERS_KEY, 'detail', id] as const;

/** CU-35 paso 3: ficha del usuario. */
export const useAdminUser = (id: number | undefined) =>
  useQuery({
    queryKey: adminUserKey(id ?? 0),
    queryFn: () => adminApi.users.get(id ?? 0),
    enabled: id !== undefined,
  });

export const ADMIN_PLANS_KEY = [...ADMIN_KEY, 'plans'] as const;

/** CU-40: todos los planes, con sus adopciones activas. */
export const useAdminPlans = () =>
  useQuery({ queryKey: ADMIN_PLANS_KEY, queryFn: () => adminApi.plans.list().then((r) => r.data) });

/** CU-30: especies con su número de animales (también para los formularios y filtros). */
export const useAdminSpecies = () =>
  useQuery({ queryKey: ADMIN_SPECIES_KEY, queryFn: () => adminApi.species.list().then((r) => r.data) });

/** CU-28: listado con búsqueda, filtros y páginas. */
export const useAdminAnimals = (params: AdminAnimalsParams) =>
  useQuery({
    queryKey: [...ADMIN_ANIMALS_KEY, 'list', params],
    queryFn: () => adminApi.animals.list(params),
    placeholderData: keepPreviousData,
  });

export const adminAnimalKey = (id: number) => [...ADMIN_ANIMALS_KEY, 'detail', id] as const;

/** CU-28: ficha completa. */
export const useAdminAnimal = (id: number | undefined) =>
  useQuery({
    queryKey: adminAnimalKey(id ?? 0),
    queryFn: () => adminApi.animals.get(id ?? 0),
    enabled: id !== undefined,
  });

export const adminPhotosKey = (animalId: number) => [...ADMIN_ANIMALS_KEY, 'photos', animalId] as const;

/** CU-29: galería del animal en el panel. */
export const useAdminPhotos = (animalId: number) =>
  useQuery({ queryKey: adminPhotosKey(animalId), queryFn: () => adminApi.photos.list(animalId).then((r) => r.data) });

export const adminVetRecordsKey = (animalId: number) => [...ADMIN_ANIMALS_KEY, 'vet-records', animalId] as const;

/** CU-34: historial veterinario del animal, del más reciente al más antiguo. */
export const useVetRecords = (animalId: number) =>
  useQuery({
    queryKey: adminVetRecordsKey(animalId),
    queryFn: () => adminApi.vetRecords.list(animalId).then((r) => r.data),
  });

export const ADMIN_UPDATES_KEY = [...ADMIN_KEY, 'updates'] as const;

/** CU-31: listado de actualizaciones con filtros y páginas. */
export const useAdminUpdates = (params: AdminUpdatesParams) =>
  useQuery({
    queryKey: [...ADMIN_UPDATES_KEY, 'list', params],
    queryFn: () => adminApi.updates.list(params),
    placeholderData: keepPreviousData,
  });

/** CU-32: una actualización para editarla. */
export const useAdminUpdate = (id: number | undefined) =>
  useQuery({
    queryKey: [...ADMIN_UPDATES_KEY, 'detail', id ?? 0],
    queryFn: () => adminApi.updates.get(id ?? 0),
    enabled: id !== undefined,
  });

/** Animales que admiten actualizaciones (CU-31): ni fallecidos ni trasladados. */
export const useAnimalsForUpdates = () =>
  useQuery({
    queryKey: [...ADMIN_ANIMALS_KEY, 'list', { pageSize: 100, sort: 'name' }],
    queryFn: () => adminApi.animals.list({ pageSize: 100, sort: 'name' }),
    select: (r) => r.data.filter((a) => !(ARCHIVED_ANIMAL_STATUSES as readonly AnimalStatus[]).includes(a.status)),
  });
