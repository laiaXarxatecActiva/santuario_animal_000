import cron from 'node-cron';
import { describe, expect, it } from 'vitest';
import { JOB_NAMES, JOBS, createJobRunner } from '../../src/jobs/registry.js';
import { startScheduler } from '../../src/jobs/scheduler.js';
import type { JobDeps } from '../../src/jobs/job.types.js';
import { NotFoundError } from '../../src/errors/app-error.js';

describe('Tareas programadas (TECH_SPEC §11.4)', () => {
  it('están registradas con su horario de TECH_SPEC, válido para node-cron', () => {
    expect(JOB_NAMES).toEqual([
      'billing',
      'manual-payments',
      'expire-pending',
      'finish-cancelled',
      'monthly-digest',
      'update-reminder',
      'generate-tasks',
      'task-alerts',
      'coverage-check',
      'staff-emails',
      'daily-summary',
    ]);
    expect(Object.fromEntries(JOB_NAMES.map((n) => [n, JOBS[n].schedule]))).toEqual({
      billing: '0 3 * * *',
      'manual-payments': '15 3 * * *',
      'expire-pending': '30 3 * * *',
      'finish-cancelled': '45 3 * * *',
      'monthly-digest': '0 9 1 * *',
      'update-reminder': '0 7 * * *',
      'generate-tasks': '10 0 * * *',
      'task-alerts': '*/15 * * * *',
      'coverage-check': '5 * * * *',
      'staff-emails': '*/5 * * * *',
      'daily-summary': '*/15 * * * *',
    });
    for (const nombre of JOB_NAMES) expect(cron.validate(JOBS[nombre].schedule)).toBe(true);
  });

  it('el ejecutor lanza la tarea por su nombre, registra el resultado y rechaza nombres desconocidos', async () => {
    const registros: unknown[] = [];
    const runner = createJobRunner({} as JobDeps, {
      info: (datos) => registros.push(datos),
      error: () => {},
      tasks: { billing: async () => ({ charged: 2 }) },
    });
    expect(await runner.run('billing')).toEqual({ charged: 2 });
    expect(registros).toEqual([{ job: 'billing', result: { charged: 2 } }]);
    await expect(runner.run('no-existe')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('el programador crea una tarea por cada una, en la zona horaria del santuario', () => {
    const tareas = startScheduler(createJobRunner({} as JobDeps), () => {});
    try {
      expect(tareas.map((t) => t.name).sort()).toEqual([...JOB_NAMES].sort());
    } finally {
      for (const tarea of tareas) void tarea.destroy();
    }
  });
});
