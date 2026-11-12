import type { SessionUser } from '@sanctuary/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { authApi } from '../api/auth';

// La sesión vive en la caché de React Query (TECH_SPEC §12.2): se carga una
// vez con GET /api/auth/me y se actualiza al entrar, registrarse o salir.
export const SESSION_KEY = ['session'] as const;

export function useSession(): { user: SessionUser | null; isLoading: boolean } {
  const query = useQuery({ queryKey: SESSION_KEY, queryFn: authApi.me, staleTime: Infinity, retry: false });
  return { user: query.data ?? null, isLoading: query.isPending };
}

/** Sustituye el usuario de la sesión en la caché. */
export function useSetSession(): (user: SessionUser | null) => void {
  const queryClient = useQueryClient();
  return (user) => queryClient.setQueryData(SESSION_KEY, user);
}

/**
 * CU-11: cierra la sesión y vuelve al inicio (también si la sesión ya había
 * caducado). Se vacía la caché para no conservar datos del área privada.
 */
export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      queryClient.clear();
      queryClient.setQueryData(SESSION_KEY, null);
      void navigate('/');
    },
  });
}
