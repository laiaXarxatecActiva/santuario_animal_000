import type { StaffEmailAlertType } from '@sanctuary/shared';
import type { Queryable } from '../db/pool.js';
import { debeIrPorEmail } from '../dominio/avisos-personal.js';
import * as notificationModel from '../models/notification.model.js';
import type { MensajeAviso } from '../models/notification.model.js';
import * as settingsModel from '../models/work-settings.model.js';

/**
 * CU-64 y CU-67 a CU-73: aviso del personal en la campana. Si su tipo está
 * elegido en los ajustes, queda pendiente de enviar por email: lo envía la
 * tarea `staff-emails`, así un fallo del correo nunca deshace la operación.
 */
export async function avisarAlPersonal(
  q: Queryable,
  userIds: readonly number[],
  aviso: { type: StaffEmailAlertType; message: MensajeAviso; link: string | null },
): Promise<void> {
  if (userIds.length === 0) return;
  const { emailAlertTypes } = await settingsModel.getAlerts(q);
  await notificationModel.createForUsers(q, userIds, {
    ...aviso,
    emailPending: debeIrPorEmail(aviso.type, emailAlertTypes),
  });
}
