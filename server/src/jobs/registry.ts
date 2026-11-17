import { NotFoundError } from '../errors/app-error.js';
import { runBilling } from './billing.job.js';
import { runExpirePending } from './expire-pending.job.js';
import { runFinishCancelled } from './finish-cancelled.job.js';
import type { JobDeps, JobResult } from './job.types.js';

// Tareas programadas (TECH_SPEC §11.4). Horario en Europe/Madrid.
export const JOBS = {
  billing: { schedule: '0 3 * * *', run: runBilling },
  'expire-pending': { schedule: '30 3 * * *', run: runExpirePending },
  'finish-cancelled': { schedule: '45 3 * * *', run: runFinishCancelled },
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
