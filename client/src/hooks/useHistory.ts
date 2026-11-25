import { HISTORY_PAGE_SIZE } from '@sanctuary/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { historyApi } from '../api/history';

export const HISTORY_KEY = ['history'] as const;

/** CU-15: historial del último año, de 10 en 10 («Ver más»). */
export const useHistory = (animalId: number | undefined) =>
  useInfiniteQuery({
    queryKey: [...HISTORY_KEY, animalId],
    queryFn: ({ pageParam }) => historyApi.list({ page: pageParam, pageSize: HISTORY_PAGE_SIZE, animalId }),
    initialPageParam: 1,
    getNextPageParam: ({ meta }) => (meta.page < meta.totalPages ? meta.page + 1 : undefined),
  });
