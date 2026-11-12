import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { feedApi } from '../api/feed';

export const FEED_KEY = ['feed'] as const;
const UNREAD_COUNT_KEY = [...FEED_KEY, 'unread-count'] as const;
export const FEED_PAGE_SIZE = 10;

/** CU-17 5: número de actualizaciones sin leer, para el menú. */
export const useUnreadCount = (enabled: boolean) =>
  useQuery({
    queryKey: UNREAD_COUNT_KEY,
    queryFn: () => feedApi.list({ pageSize: 1 }).then((r) => r.meta.unreadCount),
    enabled,
  });

/** CU-17 2-3: muro filtrado, por páginas («Cargar más»). */
export const useFeed = (filtros: { unread: boolean; animalId?: number }) =>
  useInfiniteQuery({
    queryKey: [...FEED_KEY, 'list', filtros],
    queryFn: ({ pageParam }) => feedApi.list({ ...filtros, page: pageParam, pageSize: FEED_PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: ({ meta }) => (meta.page < meta.totalPages ? meta.page + 1 : undefined),
  });

/**
 * Marcar como leída o no leída (CU-16 paso 3, CU-17 paso 4). Solo se refresca
 * el contador: la lista conserva la marca «Nuevo» hasta la próxima visita.
 */
export function useReadMark() {
  const queryClient = useQueryClient();
  const refrescarContador = () => queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
  const markRead = useMutation({ mutationFn: feedApi.markRead, onSuccess: refrescarContador });
  const markUnread = useMutation({ mutationFn: feedApi.markUnread, onSuccess: refrescarContador });
  return { markRead, markUnread };
}
