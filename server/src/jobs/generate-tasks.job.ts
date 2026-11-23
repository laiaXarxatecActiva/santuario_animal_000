import { generarTodas } from '../servicios/generacion-tareas.js';
import type { JobDeps } from './job.types.js';

export interface GenerateTasksResult {
  /** Plantillas activas revisadas. */
  templates: number;
  /** Tareas nuevas creadas en esta ejecución. */
  created: number;
}

/**
 * CU-58 (tarea `generate-tasks`): crea las tareas de las plantillas activas de
 * hoy a 6 días vista, con las horas de Madrid. Idempotente: lo que ya existe no
 * se duplica, así que se puede ejecutar varias veces al día.
 */
export async function runGenerateTasks({ db, reloj, logError }: JobDeps): Promise<GenerateTasksResult> {
  return generarTodas(db, reloj.hoy(), reloj.ahora(), logError);
}
