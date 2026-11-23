import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { diaDeLaSemana, sumarDias } from '../../src/dominio/tareas.js';
import { runGenerateTasks } from '../../src/jobs/generate-tasks.job.js';
import { runTaskAlerts } from '../../src/jobs/task-alerts.job.js';
import { entrarComo } from '../helpers/sesion.js';
import { prepararApp, type TestApp } from '../helpers/test-app.js';
import { depsDePrueba } from './helpers.js';

let t: TestApp;
beforeAll(async () => {
  t = await prepararApp();
});
afterAll(() => t.pool.end());

const contar = async (dia: string, plantillaId?: number): Promise<number> =>
  (
    await t.pool.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM task_instances WHERE due_date = $1 AND ($2::int IS NULL OR template_id = $2)',
      [dia, plantillaId ?? null],
    )
  ).rows[0]!.n;

/** Tareas que tocan ese día según las plantillas activas de TEST_DATA.sql. */
function esperadasEl(dia: string): number {
  const semana = diaDeLaSemana(dia);
  let n = 1 + 2 + 1 + 1 + 1; // alimoches, clínica (2 horas), limpieza clínica y cocina, revisión
  if ([1, 3, 5].includes(semana)) n += 2; // gran voladero y buitres negros
  if ([2, 5].includes(semana)) n += 1; // limpieza del gran voladero
  if (semana === 1) n += 1; // mallas y vallas
  return n;
}

describe('CU-58 Generar las tareas (tarea generate-tasks)', () => {
  it('1: genera las tareas que faltan hasta 7 días vista; con los datos de prueba, el día nuevo', async () => {
    const manana = sumarDias(t.hoy, 1);
    const nuevoDia = sumarDias(manana, 6);
    expect(await contar(nuevoDia)).toBe(0);
    const resultado = await runGenerateTasks(depsDePrueba(t, { hoy: manana }));
    // La carroña colgada (cada 3 días) toca o no según el día.
    const carrona = (await contar(nuevoDia, 9)) as number;
    expect(resultado.created).toBe(esperadasEl(nuevoDia) + carrona);
    expect(await contar(nuevoDia)).toBe(resultado.created);
    // La medicación de Olmo terminó antes: no se genera.
    expect(await contar(nuevoDia, 11)).toBe(0);
  });

  it('2: es idempotente: ejecutarla otra vez no duplica nada', async () => {
    const manana = sumarDias(t.hoy, 1);
    const { rows } = await t.pool.query<{ n: number }>('SELECT count(*)::int AS n FROM task_instances');
    expect(await runGenerateTasks(depsDePrueba(t, { hoy: manana }))).toMatchObject({ created: 0 });
    const { rows: despues } = await t.pool.query<{ n: number }>('SELECT count(*)::int AS n FROM task_instances');
    expect(despues[0]!.n).toBe(rows[0]!.n);
  });

  it('3: las horas se guardan en Madrid (el instante tiene en cuenta el horario de verano)', async () => {
    const { rows } = await t.pool.query<{ ok: boolean }>(
      `SELECT bool_and((due_at AT TIME ZONE 'Europe/Madrid') = (due_date + due_time)) AS ok FROM task_instances`,
    );
    expect(rows[0]!.ok).toBe(true);
  });

  it('4: si un animal deja de estar en el santuario, sus tareas futuras desaparecen y no se generan más', async () => {
    const marta = await entrarComo(t.app, 'marta');
    const manana = sumarDias(t.hoy, 1);
    expect(await contar(manana, 11)).toBe(1);
    const res = await marta.patch('/api/admin/animals/4/status').send({ status: 'transferred', date: t.hoy });
    expect(res.status).toBe(200);
    expect(await contar(manana, 11)).toBe(0);
    // Las ya hechas se conservan.
    expect(await contar(sumarDias(t.hoy, -1), 11)).toBe(1);
    await runGenerateTasks(depsDePrueba(t, { hoy: manana }));
    expect(await contar(manana, 11)).toBe(0);
  });
});

describe('CU-59 Cerrar las tareas del día (tarea task-alerts)', () => {
  it('las tareas que siguen pendientes de días pasados pasan a «no realizada» por el sistema', async () => {
    const ayer = sumarDias(t.hoy, -1);
    await t.pool.query(
      `UPDATE task_instances SET status = 'pending', resolved_by = NULL, resolved_at = NULL
        WHERE template_id = 3 AND due_date = $1`,
      [ayer],
    );
    const resultado = await runTaskAlerts(depsDePrueba(t));
    expect(resultado.closed).toBe(1);
    const { rows } = await t.pool.query(
      'SELECT status, resolved_by FROM task_instances WHERE template_id = 3 AND due_date = $1',
      [ayer],
    );
    expect(rows).toEqual([{ status: 'not_done', resolved_by: null }]);
    // Las de hoy siguen pendientes y repetirla no cambia nada.
    expect((await runTaskAlerts(depsDePrueba(t))).closed).toBe(0);
    const { rows: hoy } = await t.pool.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM task_instances WHERE due_date = $1 AND status = 'pending'",
      [t.hoy],
    );
    expect(hoy[0]!.n).toBeGreaterThan(0);
  });
});
