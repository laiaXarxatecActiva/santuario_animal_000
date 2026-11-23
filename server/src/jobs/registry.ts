import { NotFoundError } from '../errors/app-error.js';
import { runBilling } from './billing.job.js';
import { runExpirePending } from './expire-pending.job.js';
import { runFinishCancelled } from './finish-cancelled.job.js';
import { runGenerateTasks } from './generate-tasks.job.js';
import type { JobDeps, JobResult } from './job.types.js';
import { runManualPayments } from './manual-payments.job.js';
import { runMonthlyDigest } from './monthly-digest.job.js';
import { runTaskAlerts } from './task-alerts.job.js';
import { runUpdateReminder } from './update-reminder.job.js';

// Tareas programadas (TECH_SPEC §11.4). Horario en Europe/Madrid.
export const JOBS = {
  billing: { schedule: '0 3 * * *', run: runBilling },
  // CU-50: después del cobro automático.
  'manual-payments': { schedule: '15 3 * * *', run: runManualPayments },
  'expire-pending': { schedule: '30 3 * * *', run: runExpirePending },
  'finish-cancelled': { schedule: '45 3 * * *', run: runFinishCancelled },
  'monthly-digest': { schedule: '0 9 1 * *', run: runMonthlyDigest },
  'update-reminder': { schedule: '0 7 * * *', run: runUpdateReminder },
  // CU-58 y CU-59: trabajo diario del personal.
  'generate-tasks': { schedule: '10 0 * * *', run: runGenerateTasks },
  'task-alerts': { schedule: '*/15 * * * *', run: runTaskAlerts },
} as const;

export type JobName = keyof typeof JOBS;
export const JOB_NAMES = Object.keys(JOBS) as JobName[];

const esJobName = (nombre: string): nombre is JobName => Object.hasOwn(JOBS, nombre);

export interface JobRunner {
  /** Ejecuta la tarea y devuelve su resumen. Un nombre desconocido es 404. */
  run(nombre: string): Promise<JobResult>;
}

export interface JobRunnerOptions {
  info?: (datos: { job: JobName; result: JobResult }) => void;
  error?: (error: unknown, contexto: string) => void;
  /** Sustituye la implementación de algunas tareas (pruebas). */
  tasks?: Partial<Record<JobName, (deps: JobDeps) => Promise<JobResult>>>;
}

export function createJobRunner(deps: JobDeps, opciones: JobRunnerOptions = {}): JobRunner {
  return {
    async run(nombre) {
      if (!esJobName(nombre)) throw new NotFoundError(`No existe la tarea «${nombre}».`);
      const tarea = opciones.tasks?.[nombre] ?? JOBS[nombre].run;
      const result: JobResult = { ...(await tarea(deps)) };
      opciones.info?.({ job: nombre, result });
      return result;
    },
  };
}
