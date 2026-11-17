import type { ReceiptDto } from '@sanctuary/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { contributionsApi } from '../api/contributions';

export const CONTRIBUTIONS_KEY = ['contributions'] as const;

/** CU-19: cuotas y donaciones, opcionalmente de un año. */
export const useContributions = (year?: number) =>
  useQuery({
    queryKey: [...CONTRIBUTIONS_KEY, year ?? 'all'],
    queryFn: () => contributionsApi.list(year),
    placeholderData: keepPreviousData,
  });

/** CU-19 paso 5: recibo de una cuota o una donación. */
export const useReceipt = (kind: ReceiptDto['kind'], id: number) =>
  useQuery({
    queryKey: [...CONTRIBUTIONS_KEY, 'receipt', kind, id],
    queryFn: () => contributionsApi.receipt(kind, id),
    enabled: Number.isInteger(id) && id > 0,
  });
