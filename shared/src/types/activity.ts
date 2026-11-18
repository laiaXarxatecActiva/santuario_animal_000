import type { ActivityAction } from '../constants/activity.js';
import type { AdminPersonRef } from './admin.js';

/** CU-42: una entrada del registro de actividad. */
export interface ActivityLogDto {
  id: number;
  /** Instante en ISO 8601. */
  createdAt: string;
  /** Quién lo hizo; `null` si fue una tarea automática («Sistema»). */
  user: AdminPersonRef | null;
  action: ActivityAction;
  tableName: string;
  recordId: number;
  /** Cambios relevantes (nunca contraseñas ni tokens). */
  details: Record<string, unknown> | null;
}

export interface ActivityLogsPage {
  data: ActivityLogDto[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}
