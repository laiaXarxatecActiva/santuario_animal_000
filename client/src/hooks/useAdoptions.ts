import { useQuery } from '@tanstack/react-query';
import { adoptionsApi } from '../api/adoptions';

export const MY_ADOPTIONS_KEY = ['my-adoptions'] as const;

/** Mis adopciones de un animal (para saber si ya tengo una abierta, CU-13 5a). */
export const useMyAdoptionsOf = (animalId: number | undefined, enabled: boolean) =>
  useQuery({
    queryKey: [...MY_ADOPTIONS_KEY, animalId],
    queryFn: () => adoptionsApi.mine(animalId),
    enabled: enabled && animalId !== undefined,
  });
