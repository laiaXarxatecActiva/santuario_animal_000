import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { diaDeLaSemana, sumarDias } from '../../src/dominio/tareas.js';
import { lunesDe } from '../../src/dominio/turnos.js';
import { runCoverageCheck } from '../../src/jobs/coverage-check.job.js';
import { prepararApp, type TestApp } from '../helpers/test-app.js';
import { depsDePrueba } from './helpers.js';

let t: TestApp;
beforeAll(async () => {
  t = await prepararApp();
});
afterAll(() => t.pool.end());

const avisos = async (userId: number) =>
  (
    await t.pool.query<{ message: string; link: string }>(
      "SELECT message, link FROM notifications WHERE type = 'coverage_gap' AND user_id = $1 ORDER BY id",
      [userId],
    )
  ).rows;

describe('CU-64 Avisar de turnos sin cubrir (tarea coverage-check)', () => {
  it('1-2: avisa a cada administrador activo de cada zona sin cubrir de los próximos 7 días', async () => {
    const resultado = await runCoverageCheck(depsDePrueba(t));
    // Domingo por la mañana: gran voladero y cocina. Vacaciones de Carmen: dos tardes, gran voladero y clínica.
    expect(resultado).toEqual({ gaps: 6, alerted: 6 });

    const deMarta = await avisos(1);
    expect(deMarta).toHaveLength(6);
    expect(await avisos(2)).toHaveLength(6); // Javier, el otro administrador
    expect(await avisos(3)).toEqual([]); // los cuidadores, no

    const tarde = sumarDias(t.hoy, 3);
    const aviso = deMarta.find((a) => a.message.includes('Tarde') && a.message.includes('Clínica y recuperación'));
    expect(aviso).toEqual({
      message: expect.stringMatching(
        /^Falta personal en «Clínica y recuperación» en el turno de Tarde del .+: 0 de 1\.$/,
      ),
      link: `/admin/shifts?week=${lunesDe(tarde)}`,
    });
  });

  it('es idempotente: cada hueco se avisa una sola vez', async () => {
    expect(await runCoverageCheck(depsDePrueba(t))).toEqual({ gaps: 6, alerted: 0 });
    expect(await avisos(1)).toHaveLength(6);
  });

  it('un hueco cubierto deja de contar', async () => {
    const domingo = Array.from({ length: 7 }, (_, i) => sumarDias(t.hoy, i)).find((d) => diaDeLaSemana(d) === 7)!;
    const { rows } = await t.pool.query<{ id: number }>(
      'INSERT INTO shift_assignments (shift_template_id, shift_date, user_id) VALUES (1, $1, 4) RETURNING id',
      [domingo],
    );
    await t.pool.query('INSERT INTO shift_assignment_zones (assignment_id, zone_id) VALUES ($1, 1), ($1, 5)', [
      rows[0]!.id,
    ]);
    expect(await runCoverageCheck(depsDePrueba(t))).toEqual({ gaps: 4, alerted: 0 });
  });
});
