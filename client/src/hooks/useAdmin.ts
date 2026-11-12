import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminApi, type AdminAnimalsParams } from '../api/admin';

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
