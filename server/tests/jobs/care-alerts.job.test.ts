import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { relojFijo } from '../../src/dominio/reloj.js';
import { sumarDias } from '../../src/dominio/tareas.js';
import { runGenerateTasks } from '../../src/jobs/generate-tasks.job.js';
import { runTaskAlerts } from '../../src/jobs/task-alerts.job.js';
import { prepararApp, type TestApp } from '../helpers/test-app.js';
import { depsDePrueba } from './helpers.js';

// En TEST_DATA.sql, la doxiciclina de Carbón (pauta 1) es a las 10:00: ayer no
// se la tomó (ya avisado) y la de hoy sigue pendiente. Pipa tiene una visita
// mañana a las 11:00. En la clínica tienen turno Nuria (mañana) y Carmen (tarde).

let t: TestApp;
beforeAll(async () => {
  t = await prepararApp();
});
afterAll(() => t.pool.end());

/** Las dependencias de las tareas, a una hora de Madrid de un día. */
const a = (dia: string, hora: string) => ({
  ...depsDePrueba(t, { hoy: dia }),
  reloj: relojFijo(`${dia}T${hora}:00+01:00`),
});

const avisos = async (tipo: string) =>
  (
    await t.pool.query<{ user_id: number; message: string; link: string }>(
      'SELECT user_id, message, link FROM notifications WHERE type = $1 ORDER BY id',
      [tipo],
    )
  ).rows;

describe('CU-69 Aviso de medicación no dada (tarea task-alerts)', () => {
  it('antes de la hora más el margen no avisa', async () => {
    const resultado = await runTaskAlerts(a(t.hoy, '10:20'));
    expect(resultado.medicationMissed).toBe(0);
    expect(await avisos('medication_missed')).toEqual([]);
  });

  it('pasado el margen, avisa una vez a los administradores y a quien tiene turno en la zona', async () => {
    const resultado = await runTaskAlerts(a(t.hoy, '10:45'));
    expect(resultado.medicationMissed).toBe(1);
    const lista = await avisos('medication_missed');
    expect(lista.map((x) => x.user_id)).toEqual([1, 2, 3, 5]);
    expect(lista[0]).toEqual({
      user_id: 1,
      message: 'Carbón no ha recibido la dosis de las 10:00: Doxiciclina · 100 mg.',
      link: '/admin/animals/10/care',
    });
    // La de ayer ya estaba avisada y repetir no avisa otra vez.
    expect((await runTaskAlerts(a(t.hoy, '11:00'))).medicationMissed).toBe(0);
    expect(await avisos('medication_missed')).toHaveLength(4);
  });
});

describe('CU-68 Aviso de visita veterinaria (tarea task-alerts)', () => {
  it('el día de la visita avisa una vez a los administradores y a quien tiene turno en la zona', async () => {
    const manana = sumarDias(t.hoy, 1);
    expect((await runTaskAlerts(a(t.hoy, '09:00'))).vetVisitsToday).toBe(0);
    expect((await runTaskAlerts(a(manana, '07:00'))).vetVisitsToday).toBe(1);
    const lista = await avisos('vet_visit_today');
    expect(lista.map((x) => x.user_id)).toEqual([1, 2, 3, 5]);
    expect(lista[0]).toEqual({
      user_id: 1,
      message: 'Hoy a las 11:00, visita veterinaria de Pipa: Revisión de la cuarentena y análisis de sangre.',
      link: '/admin/animals/14/care',
    });
    expect((await runTaskAlerts(a(manana, '07:15'))).vetVisitsToday).toBe(0);
  });
});

describe('CU-69 Aviso de medicación no dada (después de la visita de mañana)', () => {
  it('una dosis marcada como no realizada también se avisa', async () => {
    const manana = sumarDias(t.hoy, 1);
    await t.pool.query(
      `UPDATE task_instances SET status = 'not_done', resolved_by = 3, resolved_at = due_at, observations = 'Vomitó.'
        WHERE medication_plan_id = 1 AND due_date = $1`,
      [manana],
    );
    expect((await runTaskAlerts(a(manana, '10:05'))).medicationMissed).toBe(1);
  });
});

describe('CU-58 y CU-69 Generar las dosis de las pautas (tarea generate-tasks)', () => {
  it('genera las dosis que faltan hasta 7 días vista, sin duplicar', async () => {
    await t.pool.query(
      `INSERT INTO medication_plans (animal_id, medication, dose, route, times, start_date, qualification_id)
       VALUES (14, 'Vitamina B', '1 ml', 'injection', ARRAY['12:00']::TIME[], $1, 1)`,
      [t.hoy],
    );
    const resultado = await runGenerateTasks(depsDePrueba(t));
    // De hoy (las 03:00) a dentro de 6 días: 7 dosis. La pauta de Carbón ya las tenía.
    expect(resultado.medicationTasks).toBe(7);
    expect((await runGenerateTasks(depsDePrueba(t))).medicationTasks).toBe(0);
    const { rows } = await t.pool.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM task_instances WHERE title = 'Vitamina B · 1 ml' AND zone_id = 4",
    );
    expect(rows[0]!.n).toBe(7);
  });
});
