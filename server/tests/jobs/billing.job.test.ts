import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { sumarDias, sumarMeses } from '../../src/dominio/adopcion.js';
import { runBilling } from '../../src/jobs/billing.job.js';
import type { PaymentGateway } from '../../src/services/payment/payment.service.js';
import { createSimulatedGateway } from '../../src/services/payment/simulated.gateway.js';
import { relojFijo } from '../../src/dominio/reloj.js';
import { prepararApp, type TestApp } from '../helpers/test-app.js';
import { depsDePrueba } from './helpers.js';

let t: TestApp;
beforeAll(async () => {
  t = await prepararApp();
});
afterAll(() => t.pool.end());
beforeEach(() => {
  t.mailer.outbox.length = 0;
});

const adopcion = async (id: number) => {
  const { rows } = await t.pool.query(
    `SELECT status, plan_id, next_plan_id, next_billing_date::text AS next_billing_date FROM adoptions WHERE id = $1`,
    [id],
  );
  return rows[0];
};
const pagos = async (id: number) => {
  const { rows } = await t.pool.query(
    `SELECT amount, period_start::text AS period_start, period_end::text AS period_end, status, failure_reason
       FROM payments WHERE adoption_id = $1 ORDER BY id`,
    [id],
  );
  return rows;
};
const notificaciones = async (userId: number, type: string) => {
  const { rows } = await t.pool.query<{ message: string; link: string }>(
    'SELECT message, link FROM notifications WHERE user_id = $1 AND type = $2 ORDER BY id',
    [userId, type],
  );
  return rows;
};
const vencerHoy = (id: number, fecha = t.hoy) =>
  t.pool.query('UPDATE adoptions SET next_billing_date = $2 WHERE id = $1', [id, fecha]);

describe('CU-43 Cobrar las cuotas mensuales (tarea billing)', () => {
  it('con TEST_DATA.sql recién cargado no hay cuotas vencidas (la pausada no se cobra)', async () => {
    expect(await runBilling(depsDePrueba(t))).toEqual({ charged: 0, failed: 0, alreadyPaid: 0, errors: 0 });
    expect((await adopcion(7)).status).toBe('paused');
  });

  it('1-3: aplica el cambio de plan, cobra el nuevo importe, avanza un mes, avisa y envía el recibo', async () => {
    await vencerHoy(5);
    const antes = (await pagos(5)).length;
    expect(await runBilling(depsDePrueba(t))).toEqual({ charged: 1, failed: 0, alreadyPaid: 0, errors: 0 });

    expect(await adopcion(5)).toEqual({
      status: 'active',
      plan_id: 3,
      next_plan_id: null,
      next_billing_date: sumarMeses(t.hoy, 1),
    });
    const nuevos = (await pagos(5)).slice(antes);
    expect(nuevos).toEqual([
      {
        amount: '12.00',
        period_start: t.hoy,
        period_end: sumarDias(sumarMeses(t.hoy, 1), -1),
        status: 'completed',
        failure_reason: null,
      },
    ]);
    expect(await notificaciones(7, 'payment_completed')).toEqual([
      { message: 'Hemos cobrado la cuota de Greta. ¡Gracias!', link: '/my-animals/2' },
    ]);
    expect(t.mailer.outbox.map((m) => [m.to, m.subject])).toEqual([['pablo.garcia@correo.test', 'Cuota cobrada: Greta']]);
    expect(t.mailer.outbox[0]?.text).toContain('12,00');
  });

  it('ejecutarla dos veces el mismo día no cobra ni avisa de nuevo (idempotente)', async () => {
    const antes = (await pagos(5)).length;
    expect(await runBilling(depsDePrueba(t))).toEqual({ charged: 0, failed: 0, alreadyPaid: 0, errors: 0 });
    expect(await pagos(5)).toHaveLength(antes);
    expect(await notificaciones(7, 'payment_completed')).toHaveLength(1);
    expect(t.mailer.outbox).toHaveLength(0);
  });

  it('2a: si el periodo ya estaba pagado, no cobra y solo avanza la fecha del siguiente cobro', async () => {
    const { next_billing_date: siguiente } = await adopcion(4);
    const yaPagado = sumarMeses(siguiente, -1);
    await vencerHoy(4, yaPagado);
    const antes = (await pagos(4)).length;
    expect(await runBilling(depsDePrueba(t))).toEqual({ charged: 0, failed: 0, alreadyPaid: 1, errors: 0 });
    expect((await adopcion(4)).next_billing_date).toBe(siguiente);
    expect(await pagos(4)).toHaveLength(antes);
  });

  it('3a: un cobro fallido guarda el pago fallido, pausa la adopción, avisa y envía el enlace para regularizar', async () => {
    await vencerHoy(6);
    const deps = depsDePrueba(t, { payments: createSimulatedGateway({ mode: 'always_fail', reloj: relojFijo(t.hoy) }) });
    expect(await runBilling(deps)).toEqual({ charged: 0, failed: 1, alreadyPaid: 0, errors: 0 });

    expect(await adopcion(6)).toMatchObject({ status: 'paused', next_billing_date: t.hoy });
    expect((await pagos(6)).at(-1)).toMatchObject({
      period_start: t.hoy,
      status: 'failed',
      failure_reason: expect.any(String),
    });
    expect(await notificaciones(8, 'payment_failed')).toContainEqual({
      message: 'No hemos podido cobrar la cuota de tu adopción de Greta. La adopción está pausada hasta que se regularice el pago.',
      link: '/my-animals/2',
    });
    const email = t.mailer.outbox[0];
    expect(email).toMatchObject({ to: 'elena.rubio@correo.test', subject: 'No hemos podido cobrar la cuota de Greta' });
    expect(email?.text).toContain('http://localhost:5173/my-animals/2');

    // Pausada, la tarea ya no la vuelve a intentar.
    expect(await runBilling(deps)).toEqual({ charged: 0, failed: 0, alreadyPaid: 0, errors: 0 });
  });

  it('error inesperado con una adopción: deshace la suya, lo registra y sigue con las demás', async () => {
    await vencerHoy(8);
    await vencerHoy(10);
    const roto: PaymentGateway = {
      charge: async (pedido) => {
        if (pedido.description.includes('Turia')) throw new Error('La pasarela no responde');
        return { success: true, reference: `SIM-${pedido.description}` };
      },
      refund: async () => ({ success: true }),
    };
    const errores: unknown[] = [];
    expect(await runBilling(depsDePrueba(t, { payments: roto, errores }))).toEqual({
      charged: 1,
      failed: 0,
      alreadyPaid: 0,
      errors: 1,
    });
    expect(errores).toHaveLength(1);
    expect(await adopcion(10)).toMatchObject({ status: 'active', next_billing_date: t.hoy });
    expect((await adopcion(8)).next_billing_date).toBe(sumarMeses(t.hoy, 1));
  });

  it('cobra todas las cuotas atrasadas hasta ponerse al día (postcondición)', async () => {
    const dentroDeDosMeses = sumarMeses(t.hoy, 2);
    const resultado = await runBilling(depsDePrueba(t, { hoy: dentroDeDosMeses }));
    expect(resultado.failed).toBe(0);
    expect(resultado.errors).toBe(0);
    expect(resultado.charged).toBeGreaterThan(0);
    const { rows } = await t.pool.query(
      `SELECT id FROM adoptions
        WHERE status = 'active' AND cancel_requested_at IS NULL AND next_billing_date <= $1`,
      [dentroDeDosMeses],
    );
    expect(rows).toEqual([]);
    // La adopción 10 (Turia) estaba vencida hoy: se cobran hoy, dentro de un mes y dentro de dos.
    expect((await pagos(10)).filter((p) => p.period_start >= t.hoy).map((p) => p.period_start)).toEqual([
      t.hoy,
      sumarMeses(t.hoy, 1),
      dentroDeDosMeses,
    ]);
  });
});
