import type { AlertSettingsData, AlertSettingsDto } from '@sanctuary/shared';
import type { Pool } from 'pg';
import * as settingsModel from '../models/work-settings.model.js';

export type AlertSettingsService = ReturnType<typeof createAlertSettingsService>;

// CU-73 y CU-74: qué avisos van también por email y el resumen diario (solo admin).
export function createAlertSettingsService({ db }: { db: Pool }) {
  return {
    get: (): Promise<AlertSettingsDto> => settingsModel.getAlerts(db),
    update: (datos: AlertSettingsData, userId: number): Promise<AlertSettingsDto> =>
      settingsModel.updateAlerts(db, datos, userId),
  };
}
