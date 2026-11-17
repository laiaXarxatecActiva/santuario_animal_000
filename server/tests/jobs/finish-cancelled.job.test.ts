import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sumarDias } from '../../src/dominio/adopcion.js';
import { runFinishCancelled } from '../../src/jobs/finish-cancelled.job.js';
import { prepararApp, type TestApp } from '../helpers/test-app.js';
import { depsDePrueba } from './helpers.js';

let t: TestApp;
beforeAll(async () => {
  t = await prepararApp();
});
afterAll(() => t.pool.end());

const adopcion9 = async () => {
  const { rows } = await t.pool.query(
    'SELECT status, end_reason, end_date::text AS end_date FROM adoptions WHERE id = 9',
  );
  return rows[0];
};

describe('CU-45 Finalizar adopciones dadas de baja (tarea finish-cancelled)', () => {
  it('mientras dura el mes pagado, la baja sigue activa', async () => {
    const { end_date: fin } = await adopcion9();
    expect(await runFinishCancelled(depsDePrueba(t, { hoy: fin }))).toEqual({ finished: 0 });
    expect((await adopcion9()).status).toBe('active');
  });

  it('1-2: al día siguiente del último pagado pasa a finished y se despide del adoptante', async () => {
    const { end_date: fin } = await adopcion9();
    expect(await runFinishCancelled(depsDePrueba(t, { hoy: sumarDias(fin, 1) }))).toEqual({ finished: 1 });
    expect(await adopcion9()).toEqual({ status: 'finished', end_reason: 'user_cancelled', end_date: fin });
    const { rows } = await t.pool.query(
      "SELECT message, link FROM notifications WHERE user_id = 9 AND type = 'adoption_cancelled' ORDER BY id DESC LIMIT 1",
    );
    expect(rows).toEqual([
      {
        message:
          'Tu adopción de Nieve ha terminado. Gracias por tu apoyo durante este tiempo; puedes volver a adoptar cuando quieras.',
        link: '/animals',
      },
    ]);
  });

  it('ejecutarla dos veces no cambia nada (idempotente)', async () => {
    const { end_date: fin } = await adopcion9();
    expect(await runFinishCancelled(depsDePrueba(t, { hoy: sumarDias(fin, 1) }))).toEqual({ finished: 0 });
  });
});
