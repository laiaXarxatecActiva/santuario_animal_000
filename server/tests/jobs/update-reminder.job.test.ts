import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runUpdateReminder } from '../../src/jobs/update-reminder.job.js';
import { prepararApp, type TestApp } from '../helpers/test-app.js';
import { depsDePrueba } from './helpers.js';

let t: TestApp;
beforeAll(async () => {
  t = await prepararApp();
});
afterAll(() => t.pool.end());

const avisosDeHoy = async () =>
  (
    await t.pool.query(
      `SELECT user_id, message, link FROM notifications
        WHERE type = 'update_reminder' AND (created_at AT TIME ZONE 'Europe/Madrid')::date = $1::date
        ORDER BY link, user_id`,
      [t.hoy],
    )
  ).rows;

describe('CU-47 Avisar de animales sin actualización (tarea update-reminder)', () => {
  it('1-2: avisa a cada cuidador y administrador activo de cada animal con 12 días o más', async () => {
    // Carmen (5) deja de estar activa: no recibe avisos.
    await t.pool.query('UPDATE users SET is_active = FALSE WHERE id = 5');
    // Con adoptantes activos: Turia (3) lleva 16 días y Ébano (9), 12. El resto, menos.
    expect(await runUpdateReminder(depsDePrueba(t))).toEqual({ animals: 2, notified: 8 });
    const avisos = await avisosDeHoy();
    expect(avisos.map((a) => [a.link, a.user_id])).toEqual([
      ['/admin/animals/3', 1],
      ['/admin/animals/3', 2],
      ['/admin/animals/3', 3],
      ['/admin/animals/3', 4],
      ['/admin/animals/9', 1],
      ['/admin/animals/9', 2],
      ['/admin/animals/9', 3],
      ['/admin/animals/9', 4],
    ]);
    expect(avisos[0].message).toBe('Turia lleva 16 días sin actualización.');
    expect(avisos[4].message).toBe('Ébano lleva 12 días sin actualización.');
  });

  it('2: como máximo un aviso por animal y día', async () => {
    expect(await runUpdateReminder(depsDePrueba(t))).toEqual({ animals: 2, notified: 0 });
    expect(await avisosDeHoy()).toHaveLength(8);
  });

  it('al día siguiente se vuelve a avisar si sigue sin actualización', async () => {
    const manana = new Date(`${t.hoy}T12:00:00Z`);
    manana.setUTCDate(manana.getUTCDate() + 1);
    const resultado = await runUpdateReminder(depsDePrueba(t, { hoy: manana.toISOString().slice(0, 10) }));
    expect(resultado).toEqual({ animals: 2, notified: 8 });
  });
});
