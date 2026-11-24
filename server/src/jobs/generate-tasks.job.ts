import { generarTodas, generarTodasLasPautas } from '../servicios/generacion-tareas.js';
import type { JobDeps } from './job.types.js';

export interface GenerateTasksResult {
  /** Plantillas activas revisadas. */
  templates: number;
  /** Tareas nuevas de las plantillas creadas en esta ejecución. */
  created: number;
  /** CU-69: dosis nuevas de las pautas de medicación. */
  medicationTasks: number;
}

/**
 * CU-58 (tarea `generate-tasks`): crea las tareas de las plantillas activas de
 * hoy a 6 días vista, con las horas de Madrid. Idempotente: lo que ya existe no
 * se duplica, así que se puede ejecutar varias veces al día. También crea las
 * dosis de las pautas de medicación (CU-69).
 */
export async function runGenerateTasks({ db, reloj, logError }: JobDeps): Promise<GenerateTasksResult> {
  const plantillas = await generarTodas(db, reloj.hoy(), reloj.ahora(), logError);
  const medicationTasks = await generarTodasLasPautas(db, reloj.hoy(), reloj.ahora(), logError);
  return { ...plantillas, medicationTasks };
}
