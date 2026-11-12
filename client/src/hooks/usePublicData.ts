import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { publicApi } from '../api/public';
import type { ApiQuery } from '../utils/catalogParams';

// Datos de la web pública con React Query.

export const useHome = () => useQuery({ queryKey: ['home'], queryFn: publicApi.home });

export const useCatalog = (query: ApiQuery) =>
  useQuery({
    queryKey: ['animals', query],
    queryFn: () => publicApi.animals(query),
    placeholderData: keepPreviousData,
  });

export const useAnimal = (id: number | undefined) =>
  useQuery({ queryKey: ['animal', id], queryFn: () => publicApi.animal(id ?? 0), enabled: id !== undefined });

export const useAnimalUpdates = (id: number | undefined, pageSize: number) =>
  useQuery({
    queryKey: ['animal', id, 'updates', pageSize],
    queryFn: () => publicApi.animalUpdates(id ?? 0, pageSize),
    enabled: id !== undefined,
  });

// Las especies y los planes cambian poco: se guardan 5 minutos.
const CINCO_MINUTOS = 5 * 60 * 1000;
export const useSpecies = () =>
  useQuery({ queryKey: ['species'], queryFn: publicApi.species, staleTime: CINCO_MINUTOS });
export const usePlans = () => useQuery({ queryKey: ['plans'], queryFn: publicApi.plans, staleTime: CINCO_MINUTOS });
