import { HISTORY_PAGE_SIZE, type HistoryResponse } from '@sanctuary/shared';
import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { historyApi } from '../api/history';

export const HISTORY_KEY = ['history'] as const;

/** CU-15: historial del último año, de 10 en 10 («Ver más»). Solo se pide con el historial desplegado. */
export const useHistory = (animalId: number | undefined, enabled: boolean) =>
  useInfiniteQuery({
    queryKey: [...HISTORY_KEY, animalId],
    queryFn: ({ pageParam }) => historyApi.list({ page: pageParam, pageSize: HISTORY_PAGE_SIZE, animalId }),
    initialPageParam: 1,
    getNextPageParam: ({ meta }) => (meta.page < meta.totalPages ? meta.page + 1 : undefined),
    enabled,
  });

/**
 * Al plegar el historial se olvidan las páginas de «Ver más»: al desplegarlo de
 * nuevo se ven solo los 10 últimos.
 */
export function useForgetHistoryPages() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.setQueriesData<InfiniteData<HistoryResponse, number>>({ queryKey: HISTORY_KEY }, (datos) =>
      datos && datos.pages.length > 1
        ? { pages: datos.pages.slice(0, 1), pageParams: datos.pageParams.slice(0, 1) }
        : datos,
    );
}
