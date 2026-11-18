import { diasEntre, necesitaRecordatorio } from '../dominio/actualizaciones.js';
import * as dashboardModel from '../models/dashboard.model.js';
import * as notificationModel from '../models/notification.model.js';
import type { JobDeps } from './job.types.js';
import { avisos } from '../servicios/textos-avisos.js';

export interface UpdateReminderResult {
  /** Animales con 12 días o más sin actualización. */
  animals: number;
  /** Avisos creados en esta ejecución. */
  notified: number;
}

/**
 * CU-47 (tarea `update-reminder`): avisa en la campana a cada cuidador y
 * administrador activo de los animales con adoptantes que llevan 12 días o más
 * sin actualización (RN-14). Idempotente: un aviso por animal, persona y día.
 */
export async function runUpdateReminder({ db, reloj }: JobDeps): Promise<UpdateReminderResult> {
  const hoy = reloj.hoy();
  const resultado: UpdateReminderResult = { animals: 0, notified: 0 };
  for (const animal of await dashboardModel.listAnimalsWithActiveAdopters(db)) {
    const dias = diasEntre(animal.referenceDate, hoy);
    if (!necesitaRecordatorio(dias)) continue;
    resultado.animals += 1;
    resultado.notified += await notificationModel.createUpdateReminders(db, {
      message: avisos.sinActualizar(animal.name, dias),
      link: `/admin/animals/${animal.id}`,
      hoy,
      ahora: reloj.ahora(),
    });
  }
  return resultado;
}
