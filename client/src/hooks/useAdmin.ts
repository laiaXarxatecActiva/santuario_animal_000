import { ARCHIVED_ANIMAL_STATUSES, type AnimalStatus } from '@sanctuary/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminApi, type AdminAnimalsParams, type AdminUpdatesParams } from '../api/admin';

export const ADMIN_KEY = ['admin'] as const;
export const ADMIN_SPECIES_KEY = [...ADMIN_KEY, 'species'] as const;
export const ADMIN_ANIMALS_KEY = [...ADMIN_KEY, 'animals'] as const;

/** CU-27: resumen del escritorio. */
export const useDashboard = () => useQuery({ queryKey: [...ADMIN_KEY, 'dashboard'], queryFn: adminApi.dashboard });

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
