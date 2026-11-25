import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runExpirePending } from '../../src/jobs/expire-pending.job.js';
import { prepararApp, type TestApp } from '../helpers/test-app.js';
import { depsDePrueba } from './helpers.js';

let t: TestApp;
beforeAll(async () => {
  t = await prepararApp();
});
afterAll(() => t.pool.end());

const adopcion = async (id: number) => {
  const { rows } = await t.pool.query(
    'SELECT status, end_reason, end_date::text AS end_date FROM adoptions WHERE id = $1',
    [id],
  );
  return rows[0];
};

describe('CU-44 Cancelar adopciones pendientes caducadas (tarea expire-pending)', () => {
  it('1-2: cancela la pendiente de más de 7 días (la 12) y avisa; la reciente (la 11) sigue pendiente', async () => {
    const deps = depsDePrueba(t);
    const ahora = deps.reloj.ahora();
    await t.pool.query(
      `INSERT INTO user_tokens (user_id, type, token_hash, expires_at)
       VALUES (13, 'email_verification', repeat('a', 64), $1::timestamptz - INTERVAL '1 hour'),
              (13, 'email_verification', repeat('b', 64), $1::timestamptz + INTERVAL '1 hour')`,
      [ahora],
    );
    expect(await runExpirePending(deps)).toEqual({ cancelled: 1, expiredTokensDeleted: 1 });

    expect(await adopcion(12)).toEqual({ status: 'cancelled', end_reason: 'payment_not_completed', end_date: t.hoy });
    expect((await adopcion(11)).status).toBe('pending');
    const { rows } = await t.pool.query(
      "SELECT message, link FROM notifications WHERE user_id = 11 AND type = 'adoption_cancelled'",
    );
    expect(rows).toEqual([
      {
        message:
          'Tu adopción de Canelo se ha cancelado porque no se completó el pago en 7 días. Puedes intentarlo de nuevo cuando quieras.',
        link: '/animals/6',
      },
    ]);
    // 3: solo quedan los tokens vigentes.
    const tokens = await t.pool.query("SELECT token_hash FROM user_tokens WHERE user_id = 13 AND token_hash LIKE 'b%'");
    expect(tokens.rows).toHaveLength(1);
    expect((await t.pool.query('SELECT 1 FROM user_tokens WHERE expires_at < $1', [ahora])).rowCount).toBe(0);
  });

  it('ejecutarla dos veces no cancela ni avisa de nuevo (idempotente)', async () => {
    expect(await runExpirePending(depsDePrueba(t))).toEqual({ cancelled: 0, expiredTokensDeleted: 0 });
    const { rows } = await t.pool.query(
      "SELECT 1 FROM notifications WHERE user_id = 11 AND type = 'adoption_cancelled'",
    );
    expect(rows).toHaveLength(1);
  });
});
