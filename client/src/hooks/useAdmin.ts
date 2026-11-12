import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../api/admin';

export const ADMIN_KEY = ['admin'] as const;

/** CU-27: resumen del escritorio. */
export const useDashboard = () => useQuery({ queryKey: [...ADMIN_KEY, 'dashboard'], queryFn: adminApi.dashboard });
