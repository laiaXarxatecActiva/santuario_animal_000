import type { ActivityAction, ActivityTable } from '@sanctuary/shared';
import type { Queryable } from '../db/pool.js';
import { limpiarDetalles, type DetallesActividad } from '../dominio/actividad.js';
import * as activityModel from '../models/activity-log.model.js';

export interface ActivityLogServiceDeps {
  db: Queryable;
  /** Un fallo al anotar nunca deshace la operación ya hecha: solo se registra. */
  logError?: (error: unknown) => void;
}

/**
 * ActivityLogService (TECH_SPEC §11.5): lo llaman los controladores del panel
 * después de cada escritura. Nunca guarda contraseñas ni tokens.
 */
export interface ActivityLogService {
  log(
    userId: number | null,
    action: ActivityAction,
    tableName: ActivityTable,
    recordId: number,
    details?: DetallesActividad | null,
  ): Promise<void>;
}

export function createActivityLogService({ db, logError = () => {} }: ActivityLogServiceDeps): ActivityLogService {
  return {
    async log(userId, action, tableName, recordId, details) {
      try {
        await activityModel.create(db, { userId, action, tableName, recordId, details: limpiarDetalles(details) });
      } catch (error) {
        logError(error);
      }
    },
  };
}

/** Registro que no anota nada (para crear las rutas sin dependencias, p. ej. en las pruebas). */
export const sinRegistro: ActivityLogService = { log: async () => {} };
