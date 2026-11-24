import { STAFF_EMAIL_ALERT_TYPES, type StaffEmailAlertType } from '@sanctuary/shared';
import * as notificationModel from '../models/notification.model.js';
import { staffAlertEmail } from '../services/email/templates/staff-alert.js';
import type { JobDeps } from './job.types.js';

export interface StaffEmailsResult {
  sent: number;
  failed: number;
}

/** Avisos que se toman en cada ejecución. */
const POR_EJECUCION = 200;

const esAvisoDelPersonal = (tipo: string): tipo is StaffEmailAlertType =>
  (STAFF_EMAIL_ALERT_TYPES as readonly string[]).includes(tipo);

/**
 * CU-73 (tarea `staff-emails`, cada 5 minutos): envía por email los avisos del
 * personal que quedaron pendientes. Cada aviso se marca como enviado al tomarlo,
 * así sale una sola vez; si falla el envío, se registra y no se reintenta.
 */
export async function runStaffEmails({ db, email, clientUrl, logError }: JobDeps): Promise<StaffEmailsResult> {
  let sent = 0;
  let failed = 0;
  for (const aviso of await notificationModel.claimPendingEmails(db, POR_EJECUCION)) {
    if (!aviso.isActive || !esAvisoDelPersonal(aviso.type)) continue;
    const contenido = staffAlertEmail({
      type: aviso.type,
      message: aviso.message,
      url: `${clientUrl}${aviso.link ?? '/admin'}`,
      firstName: aviso.firstName,
      language: aviso.language,
    });
    try {
      await email.send({ to: aviso.email, ...contenido });
      sent += 1;
    } catch (error) {
      failed += 1;
      logError?.(error, `staff-emails: aviso ${aviso.id}`);
    }
  }
  return { sent, failed };
}
