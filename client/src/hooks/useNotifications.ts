import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '../api/notifications';

export const NOTIFICATIONS_KEY = ['notifications'] as const;
/** La campana muestra las 10 últimas (DESIGN_SYSTEM §8.8). */
export const BELL_SIZE = 10;
export const NOTIFICATIONS_PAGE_SIZE = 20;

/** CU-18: una página de notificaciones (la campana usa la primera, de 10). */
export const useNotifications = (pagina: { page?: number; pageSize: number }, enabled = true) =>
  useQuery({
    queryKey: [...NOTIFICATIONS_KEY, pagina],
    queryFn: () => notificationsApi.list(pagina),
    enabled,
    placeholderData: keepPreviousData,
  });

/** Marcar como leída, todas como leídas, borrar una y borrar todas. Refrescan la campana y la página. */
export function useNotificationActions() {
  const queryClient = useQueryClient();
  const refrescar = () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
  return {
    setRead: useMutation({ mutationFn: notificationsApi.setRead, onSuccess: refrescar }),
    readAll: useMutation({ mutationFn: notificationsApi.readAll, onSuccess: refrescar }),
    remove: useMutation({ mutationFn: notificationsApi.remove, onSuccess: refrescar }),
    removeAll: useMutation({ mutationFn: notificationsApi.removeAll, onSuccess: refrescar }),
  };
}
