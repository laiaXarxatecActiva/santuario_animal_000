import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { sumarDias } from '../../src/dominio/adopcion.js';
import { runManualPayments } from '../../src/jobs/manual-payments.job.js';
import { prepararApp, type TestApp } from '../helpers/test-app.js';
import { depsDePrueba } from './helpers.js';

let t: TestApp;
beforeAll(async () => {
  t = await prepararApp();
});
afterAll(() => t.pool.end());
beforeEach(async () => {
  t.mailer.outbox.length = 0;
  // Cada caso parte de todas las adopciones con pago automático.
  await t.pool.query("UPDATE adoptions SET payment_mode = 'automatic', payment_reminder_sent_for = NULL");
});

/** Pone una adopción con pago manual y su próxima cuota a `dias` de hoy (negativo: ya pasó). */
const manualA = (id: number, dias: number) =>
  t.pool.query("UPDATE adoptions SET payment_mode = 'manual', next_billing_date = $2 WHERE id = $1", [
    id,
    sumarDias(t.hoy, dias),
  ]);
const adopcion = async (id: number) =>
  (
    await t.pool.query<{ status: string; payment_reminder_sent_for: string | null }>(
      'SELECT status, payment_reminder_sent_for::text AS payment_reminder_sent_for FROM adoptions WHERE id = $1',
      [id],
    )
  ).rows[0];
const avisos = async (userId: number, type: string) =>
  (
    await t.pool.query<{ message: string; link: string }>(
      'SELECT message, link FROM notifications WHERE user_id = $1 AND type = $2 ORDER BY id',
      [userId, type],
    )
  ).rows;

// Adopción 1: Lucía (usuaria 6) adopta a Rufo. Adopción 4: Pablo (usuario 7) adopta a Rufo.
describe('CU-50 Avisar y pausar las cuotas con pago manual (tarea manual-payments)', () => {
  it('con TEST_DATA.sql (todas automáticas) no hace nada', async () => {
    expect(await runManualPayments(depsDePrueba(t))).toEqual({ reminded: 0, paused: 0, errors: 0 });
    expect(t.mailer.outbox).toHaveLength(0);
  });

  it('7 días antes de la cuota avisa en la campana y por email, una sola vez', async () => {
    await manualA(1, 7);
    const antes = (await avisos(6, 'system')).length;
    expect(await runManualPayments(depsDePrueba(t))).toEqual({ reminded: 1, paused: 0, errors: 0 });
    expect((await adopcion(1))?.payment_reminder_sent_for).toBe(sumarDias(t.hoy, 7));
    const nuevos = (await avisos(6, 'system')).slice(antes);
    expect(nuevos).toEqual([{ message: expect.stringContaining('Rufo'), link: '/my-animals' }]);
    expect(t.mailer.outbox.map((m) => m.to)).toEqual(['lucia.martinez@correo.test']);
    expect(t.mailer.outbox[0]?.subject).toContain('Rufo');
    expect(t.mailer.outbox[0]?.text).toContain('http://localhost:5173/my-animals');

    // Idempotente: otra ejecución el mismo día (o días después) no repite el aviso.
    t.mailer.outbox.length = 0;
    expect(await runManualPayments(depsDePrueba(t))).toEqual({ reminded: 0, paused: 0, errors: 0 });
    expect(await runManualPayments(depsDePrueba(t, { hoy: sumarDias(t.hoy, 3) }))).toEqual({
      reminded: 0,
      paused: 0,
      errors: 0,
    });
    expect(t.mailer.outbox).toHaveLength(0);
  });

  it('8 días antes todavía no avisa', async () => {
    await manualA(1, 8);
    expect(await runManualPayments(depsDePrueba(t))).toEqual({ reminded: 0, paused: 0, errors: 0 });
  });

  it('durante los 7 días de margen no pausa; el séptimo día después, sí, y lo avisa', async () => {
    await manualA(4, -6);
    await t.pool.query('UPDATE adoptions SET payment_reminder_sent_for = next_billing_date WHERE id = 4');
    expect(await runManualPayments(depsDePrueba(t))).toEqual({ reminded: 0, paused: 0, errors: 0 });
    expect((await adopcion(4))?.status).toBe('active');

    await manualA(4, -7);
    const antes = (await avisos(7, 'payment_failed')).length;
    expect(await runManualPayments(depsDePrueba(t))).toEqual({ reminded: 0, paused: 1, errors: 0 });
    expect((await adopcion(4))?.status).toBe('paused');
    expect((await avisos(7, 'payment_failed')).slice(antes)).toEqual([
      { message: expect.stringContaining('Rufo'), link: '/my-animals/1' },
    ]);
    expect(t.mailer.outbox.map((m) => m.to)).toEqual(['pablo.garcia@correo.test']);
    // CU-42: la pausa queda en el registro de actividad como «Sistema».
    const { rows } = await t.pool.query(
      `SELECT user_id, details FROM activity_logs WHERE table_name = 'adoptions' AND record_id = 4 ORDER BY id DESC LIMIT 1`,
    );
    expect(rows[0]).toEqual({
      user_id: null,
      details: { status: ['active', 'paused'], reason: 'manual_payment_overdue' },
    });

    // Idempotente: ya está pausada.
    t.mailer.outbox.length = 0;
    expect(await runManualPayments(depsDePrueba(t))).toEqual({ reminded: 0, paused: 0, errors: 0 });
    expect(t.mailer.outbox).toHaveLength(0);
    await t.pool.query("UPDATE adoptions SET status = 'active' WHERE id = 4");
  });

  it('no toca las automáticas ni las que tienen la baja pedida', async () => {
    await t.pool.query('UPDATE adoptions SET next_billing_date = $1 WHERE id = 6', [sumarDias(t.hoy, -10)]);
    await manualA(18, -10);
    await t.pool.query('UPDATE adoptions SET cancel_requested_at = now() WHERE id = 18');
    expect(await runManualPayments(depsDePrueba(t))).toEqual({ reminded: 0, paused: 0, errors: 0 });
    expect((await adopcion(6))?.status).toBe('active');
    expect((await adopcion(18))?.status).toBe('active');
  });
});
