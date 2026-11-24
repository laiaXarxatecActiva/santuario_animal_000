import { withTransaction } from '../db/transaction.js';
import { sumarDias } from '../dominio/tareas.js';
import * as staffAlertModel from '../models/staff-alert.model.js';
import * as taskModel from '../models/task.model.js';
import * as vetVisitModel from '../models/vet-visit.model.js';
import * as settingsModel from '../models/work-settings.model.js';
import { destinatarios, enlaceCuidados } from '../servicios/avisos-cuidados.js';
import { avisos } from '../servicios/textos-avisos.js';
import type { JobDeps } from './job.types.js';
import { avisarAlPersonal } from '../servicios/avisos-personal.js';

export interface TaskAlertsResult {
  /** Tareas de días pasados cerradas como «no realizadas». */
  closed: number;
  /** CU-69: dosis no dadas avisadas por primera vez. */
  medicationMissed: number;
  /** CU-68: visitas veterinarias de hoy avisadas por primera vez. */
  vetVisitsToday: number;
}

/**
 * CU-59, CU-68 y CU-69 (tarea `task-alerts`, cada 15 minutos): cierra como «no
 * realizadas» las tareas que siguen pendientes de días anteriores y avisa de
 * las dosis de medicación no dadas (de ayer y de hoy: pendientes pasada la hora
 * y el margen, o marcadas como no realizadas) y de las visitas veterinarias de
 * hoy. Idempotente: cada aviso se envía una sola vez (`staff_alerts`).
 */
export async function runTaskAlerts({ db, reloj }: JobDeps): Promise<TaskAlertsResult> {
  const hoy = reloj.hoy();
  const ahora = reloj.ahora();
  const { lateMarginMinutes } = await settingsModel.get(db);

  // Antes de cerrar el día: una dosis de anoche también se avisa.
  const dosis = await taskModel.listMissedDoses(db, {
    desde: sumarDias(hoy, -1),
    hasta: hoy,
    limite: new Date(ahora.getTime() - lateMarginMinutes * 60_000),
  });
  let medicationMissed = 0;
  for (const d of dosis) {
    const nuevo = await withTransaction(db, async (client) => {
      if (!(await staffAlertModel.registerIfNew(client, 'medication_missed', String(d.id)))) return false;
      await avisarAlPersonal(client, await destinatarios(client, d.dueDate, d.zoneId), {
        type: 'medication_missed',
        message: avisos.medicacionNoDada(d.animal?.name ?? '', d.dueTime, d.title),
        link: d.animal ? enlaceCuidados(d.animal.id) : '/admin/my-day',
      });
      return true;
    });
    if (nuevo) medicationMissed += 1;
  }

  let vetVisitsToday = 0;
  for (const v of await vetVisitModel.listScheduledOn(db, hoy)) {
    const nuevo = await withTransaction(db, async (client) => {
      if (!(await staffAlertModel.registerIfNew(client, 'vet_visit_today', String(v.id)))) return false;
      await avisarAlPersonal(client, await destinatarios(client, hoy, v.zoneId), {
        type: 'vet_visit_today',
        message: avisos.visitaHoy(v.animalName, v.time, v.reason),
        link: enlaceCuidados(v.animalId),
      });
      return true;
    });
    if (nuevo) vetVisitsToday += 1;
  }

  const closed = await taskModel.closePastPending(db, hoy, ahora);
  return { closed, medicationMissed, vetVisitsToday };
}
