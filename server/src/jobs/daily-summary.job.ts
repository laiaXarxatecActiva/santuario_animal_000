import { withTransaction } from '../db/transaction.js';
import { tocaElResumen } from '../dominio/avisos-personal.js';
import { horaEnZonaSantuario } from '../dominio/reloj.js';
import * as staffAlertModel from '../models/staff-alert.model.js';
import * as userModel from '../models/user.model.js';
import * as settingsModel from '../models/work-settings.model.js';
import { dailySummaryEmail } from '../services/email/templates/daily-summary.js';
import { createTodayService } from '../servicios/today.service.js';
import type { JobDeps } from './job.types.js';

export interface DailySummaryResult {
  sent: number;
}

/**
 * CU-74 (tarea `daily-summary`, cada 15 minutos): si está activado y ya es la
 * hora, envía a cada administrador activo el resumen del día, una vez al día
 * (`staff_alerts` con la fecha).
 */
export async function runDailySummary({ db, reloj, email, clientUrl, logError }: JobDeps): Promise<DailySummaryResult> {
  const ajustes = await settingsModel.getAlerts(db);
  if (!tocaElResumen(ajustes, horaEnZonaSantuario(reloj.ahora()))) return { sent: 0 };
  const hoy = reloj.hoy();
  const nuevo = await withTransaction(db, (client) => staffAlertModel.registerIfNew(client, 'daily_summary', hoy));
  if (!nuevo) return { sent: 0 };

  const panel = await createTodayService({ db, reloj }).get();
  let sent = 0;
  for (const admin of await userModel.listActiveAdminsForEmail(db)) {
    try {
      await email.send({
        to: admin.email,
        ...dailySummaryEmail({
          hoy: panel,
          url: `${clientUrl}/admin/today`,
          firstName: admin.firstName,
          language: admin.language,
        }),
      });
      sent += 1;
    } catch (error) {
      logError?.(error, `daily-summary: administrador ${admin.id}`);
    }
  }
  return { sent };
}
