import cron, { type ScheduledTask } from 'node-cron';
import { ZONA_HORARIA_SANTUARIO } from '../dominio/reloj.js';
import { JOB_NAMES, JOBS, type JobRunner } from './registry.js';

/**
 * Programa todas las tareas con node-cron en la zona del santuario. Si una
 * ejecución sigue en marcha, la siguiente se salta (`noOverlap`). Los errores
 * se registran y no tumban el servidor.
 */
export function startScheduler(runner: JobRunner, logError: (error: unknown, job: string) => void): ScheduledTask[] {
  return JOB_NAMES.map((nombre) =>
    cron.schedule(
      JOBS[nombre].schedule,
      async () => {
        try {
          await runner.run(nombre);
        } catch (error) {
          logError(error, nombre);
        }
      },
      { name: nombre, timezone: ZONA_HORARIA_SANTUARIO, noOverlap: true },
    ),
  );
}
