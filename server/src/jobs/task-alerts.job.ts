import * as taskModel from '../models/task.model.js';
import type { JobDeps } from './job.types.js';

export interface TaskAlertsResult {
  /** Tareas de días pasados cerradas como «no realizadas». */
  closed: number;
}

/**
 * CU-59 (tarea `task-alerts`, cada 15 minutos): cierra como «no realizadas» las
 * tareas que siguen pendientes de días anteriores. Idempotente.
 */
export async function runTaskAlerts({ db, reloj }: JobDeps): Promise<TaskAlertsResult> {
  const closed = await taskModel.closePastPending(db, reloj.hoy(), reloj.ahora());
  return { closed };
}
