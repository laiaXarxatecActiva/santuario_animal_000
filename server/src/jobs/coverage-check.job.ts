import { COVERAGE_CHECK_DAYS } from '@sanctuary/shared';
import { withTransaction } from '../db/transaction.js';
import { instanteEnZonaSantuario } from '../dominio/reloj.js';
import { sumarDias } from '../dominio/tareas.js';
import { lunesDe } from '../dominio/turnos.js';
import * as notificationModel from '../models/notification.model.js';
import * as staffAlertModel from '../models/staff-alert.model.js';
import * as userModel from '../models/user.model.js';
import { huecosDelRango } from '../servicios/shift.service.js';
import { avisos } from '../servicios/textos-avisos.js';
import type { JobDeps } from './job.types.js';

export interface CoverageCheckResult {
  /** Zonas sin cubrir de hoy a 7 días vista (sin los turnos que ya han acabado). */
  gaps: number;
  /** Huecos avisados por primera vez en esta ejecución. */
  alerted: number;
}

/**
 * CU-64 (tarea `coverage-check`): avisa en la campana a cada administrador
 * activo de las zonas de un turno con menos personas de las necesarias.
 * Idempotente: cada hueco (día, turno y zona) se avisa una sola vez.
 */
export async function runCoverageCheck({ db, reloj }: JobDeps): Promise<CoverageCheckResult> {
  const hoy = reloj.hoy();
  const ahora = reloj.ahora();
  const pendientes = (await huecosDelRango(db, hoy, sumarDias(hoy, COVERAGE_CHECK_DAYS - 1))).filter(
    (h) => instanteEnZonaSantuario(h.date, h.shift.endTime) > ahora,
  );
  const admins = await userModel.listActiveAdminIds(db);
  let alerted = 0;
  for (const hueco of pendientes) {
    const nuevo = await withTransaction(db, async (client) => {
      const clave = `${hueco.date}:${hueco.shift.id}:${hueco.zone.id}`;
      if (!(await staffAlertModel.registerIfNew(client, 'coverage_gap', clave))) return false;
      await notificationModel.createForUsers(client, admins, {
        type: 'coverage_gap',
        message: avisos.huecoEnTurno(hueco.zone.name, hueco.shift.name, hueco.date, hueco.assigned, hueco.required),
        link: `/admin/shifts?week=${lunesDe(hueco.date)}`,
      });
      return true;
    });
    if (nuevo) alerted += 1;
  }
  return { gaps: pendientes.length, alerted };
}
