import type { ActivityLogsPage, AdminActivityLogsQuery } from '@sanctuary/shared';
import type { Pool } from 'pg';
import { paginar } from '../dominio/paginacion.js';
import * as activityModel from '../models/activity-log.model.js';

export interface ActivityAdminServiceDeps {
  db: Pool;
}

export type ActivityAdminService = ReturnType<typeof createActivityAdminService>;

// CU-42 Consultar el registro de actividad (solo administradores, solo lectura).
export function createActivityAdminService({ db }: ActivityAdminServiceDeps) {
  return {
    async list(query: AdminActivityLogsQuery): Promise<ActivityLogsPage> {
      const { page: _p, pageSize: _s, ...filtros } = query;
      const { offset, ...meta } = paginar(query, await activityModel.count(db, filtros));
      return { data: await activityModel.list(db, filtros, { limit: meta.pageSize, offset }), meta };
    },
  };
}
