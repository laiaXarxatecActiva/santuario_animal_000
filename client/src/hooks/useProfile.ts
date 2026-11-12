import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { profileApi } from '../api/profile';
import { SESSION_KEY } from './useSession';

export const PROFILE_KEY = ['profile'] as const;

export const useProfile = () => useQuery({ queryKey: PROFILE_KEY, queryFn: profileApi.get });

/**
 * CU-23: guarda una sección del perfil. Se vuelve a leer la sesión para que el
 * nombre de la cabecera cambie, y la ficha de sus animales por si cambió
 * `showPublicName`.
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: profileApi.update,
    onSuccess: (perfil) => {
      queryClient.setQueryData(PROFILE_KEY, perfil);
      void queryClient.invalidateQueries({ queryKey: SESSION_KEY });
      void queryClient.invalidateQueries({ queryKey: ['animal'] });
    },
  });
}

/** CU-24. */
export const useChangePassword = () => useMutation({ mutationFn: profileApi.changePassword });
