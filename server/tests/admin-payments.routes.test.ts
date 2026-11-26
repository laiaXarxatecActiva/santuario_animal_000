import type { AdminAdoptionDetailDto, AdminPaymentListItemDto, AdminPaymentsPage } from '@sanctuary/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { sumarMeses } from '../src/dominio/adopcion.js';
import { entrarComo, type Agente } from './helpers/sesion.js';
import { prepararApp, type TestApp } from './helpers/test-app.js';

let t: TestApp;
let marta: Agente;
beforeAll(async () => {
  t = await prepararApp();
  marta = await entrarComo(t.app, 'marta');
});
afterAll(() => t.pool.end());
beforeEach(() => {
  t.mailer.outbox.length = 0;
});

const listar = async (query: Record<string, string | number> = {}): Promise<AdminPaymentsPage> => {
  const res = await marta.get('/api/admin/payments').query({ pageSize: 100, ...query });
  expect(res.status).toBe(200);
  return res.body;
};
const ids = async (query: Record<string, string | number>) =>
  (await listar(query)).data.map((p) => p.id).sort((a, b) => a - b);
const idsSql = async (where: string, params: unknown[] = []) =>
  (await t.pool.query<{ id: number }>(`SELECT pa.id FROM payments pa WHERE ${where} ORDER BY pa.id`, params)).rows.map(
    (r) => r.id,
  );
const pago = async (id: number) =>
  (
    await t.pool.query(
      'SELECT status, method, amount, period_start::text, refunded_at, recorded_by, plan_id FROM payments WHERE id = $1',
      [id],
    )
  ).rows[0];
const adopcion = async (id: number) =>
  (
    await t.pool.query(
      'SELECT status, start_date::text, next_billing_date::text, plan_id, next_plan_id FROM adoptions WHERE id = $1',
      [id],
    )
  ).rows[0];
const ultimoCobrado = async (adoptionId: number) =>
  (
    await t.pool.query<{ id: number; amount: string }>(
      `SELECT id, amount FROM payments WHERE adoption_id = $1 AND status = 'completed'
        ORDER BY period_start DESC, id DESC LIMIT 1`,
      [adoptionId],
    )
  ).rows[0] as { id: number; amount: string };
const notificaciones = async (userId: number) =>
  (await t.pool.query('SELECT type, message FROM notifications WHERE user_id = $1 ORDER BY id DESC', [userId])).rows;
const emailsA = (to: string) => t.mailer.outbox.filter((m) => m.to === to);

describe('CU-38 Gestionar pagos: acceso', () => {
  it('solo el administrador: sin sesión 401; cuidadora y adoptante 403', async () => {
    expect((await request(t.app).get('/api/admin/payments')).status).toBe(401);
    for (const quien of ['nuria', 'lucia'] as const) {
      const agente = await entrarComo(t.app, quien);
      expect((await agente.get('/api/admin/payments')).status).toBe(403);
      expect((await agente.get('/api/admin/payments/export.csv')).status).toBe(403);
      expect((await agente.post('/api/admin/payments').send({})).status).toBe(403);
      expect((await agente.post('/api/admin/payments/1/refund').send({})).status).toBe(403);
    }
  });
});

describe('CU-38 Gestionar pagos: listado', () => {
  it('2: lista las cuotas con adoptante, animal, plan, periodo, importe, método y estado', async () => {
    const { data, meta } = await listar();
    const [{ total }] = (await t.pool.query('SELECT count(*)::int AS total FROM payments')).rows;
    expect(meta.total).toBe(total);
    const transferencia = data.find((p) => p.method === 'bank_transfer') as AdminPaymentListItemDto;
    expect(transferencia).toEqual({
      id: expect.any(Number),
      adoptionId: 14,
      adopter: { id: 12, firstName: 'Raquel', lastName: 'Font Escrivà', email: 'raquel.font@correo.test' },
      animal: { id: 9, name: 'Ébano' },
      plan: { id: 3, name: 'Extraordinaria' },
      amount: '12.00',
      periodStart: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      periodEnd: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      method: 'bank_transfer',
      status: 'completed',
      reference: expect.stringMatching(/^TRF-/),
      date: expect.any(String),
      refundedAt: null,
      failureReason: null,
      recordedBy: { id: 1, name: 'Marta Soler Ferrer' },
    });
  });

  it('2: por defecto, los más recientes primero', async () => {
    const { data } = await listar();
    const fechas = data.map((p) => p.date);
    expect([...fechas].sort().reverse()).toEqual(fechas);
  });

  it('2: filtra por estado, método y adopción', async () => {
    expect(await ids({ status: 'refunded' })).toEqual(await idsSql("pa.status = 'refunded'"));
    expect(await ids({ status: 'failed' })).toEqual(await idsSql("pa.status = 'failed'"));
    expect(await ids({ method: 'bank_transfer' })).toEqual(await idsSql("pa.method = 'bank_transfer'"));
    expect(await ids({ adoptionId: 14 })).toEqual(await idsSql('pa.adoption_id = 14'));
  });

  it('2: busca por adoptante (nombre o email) o por animal', async () => {
    expect(await ids({ q: 'raquel' })).toEqual(await idsSql('pa.adoption_id IN (14, 15)'));
    expect(await ids({ q: 'ebano' })).toEqual(await idsSql('pa.adoption_id = 14'));
  });

  it('2: filtra por fechas (el día del cobro o, si no se cobró, del intento)', async () => {
    const desde = sumarMeses(t.hoy, -1);
    const esperado = await idsSql(
      `(COALESCE(pa.paid_at, pa.created_at) AT TIME ZONE 'Europe/Madrid')::date BETWEEN $1 AND $2`,
      [desde, t.hoy],
    );
    expect(esperado.length).toBeGreaterThan(0);
    expect(await ids({ from: desde, to: t.hoy })).toEqual(esperado);
    expect((await marta.get('/api/admin/payments').query({ from: t.hoy, to: desde })).status).toBe(400);
  });

  it('2: suma solo lo cobrado con los filtros actuales', async () => {
    const [{ suma }] = (
      await t.pool.query(
        `SELECT COALESCE(sum(amount), 0)::numeric(12,2)::text AS suma
           FROM payments WHERE adoption_id IN (1, 2, 3, 18) AND status = 'completed'`,
      )
    ).rows;
    expect((await listar({ q: 'lucia' })).totalCollected).toBe(suma);
    expect((await listar({ status: 'failed' })).totalCollected).toBe('0.00');
  });

  it('2: pagina; el orden pasa por una lista blanca', async () => {
    const res = await marta.get('/api/admin/payments').query({ pageSize: 5, page: 2 });
    expect(res.body.data).toHaveLength(5);
    expect(res.body.meta).toMatchObject({ page: 2, pageSize: 5 });
    expect((await marta.get('/api/admin/payments').query({ sort: 'amount; DROP' })).status).toBe(400);
  });
});

describe('CU-38 Gestionar pagos: exportar CSV', () => {
  it('3: descarga los pagos filtrados en CSV para hoja de cálculo', async () => {
    const res = await marta.get('/api/admin/payments/export.csv').query({ method: 'bank_transfer' });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(res.headers['content-disposition']).toBe(`attachment; filename="pagos-${t.hoy}.csv"`);
    const lineas = res.text.split('\r\n');
    expect(lineas[0]).toBe(
      '﻿Fecha;Referencia;Adoptante;Email;Animal;Plan;Periodo desde;Periodo hasta;Importe;Forma de pago;Estado;Devuelto el;Registrado por',
    );
    expect(lineas).toHaveLength(3); // cabecera, una fila y el final de línea
    const campos = (lineas[1] ?? '').split(';');
    expect(campos[0]).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(campos.slice(2, 6)).toEqual(['Raquel Font Escrivà', 'raquel.font@correo.test', 'Ébano', 'Extraordinaria']);
    expect(campos.slice(8)).toEqual(['12,00', 'Transferencia', 'Cobrado', '', 'Marta Soler Ferrer']);
  });

  it('una cuenta eliminada sale como «Usuario eliminado», sin email', async () => {
    const res = await marta.get('/api/admin/payments/export.csv').query({ adoptionId: 17 });
    const campos = (res.text.split('\r\n')[1] ?? '').split(';');
    expect(campos.slice(2, 4)).toEqual(['Usuario eliminado', '']);
  });

  it('una devolución lleva su fecha', async () => {
    const res = await marta.get('/api/admin/payments/export.csv').query({ status: 'refunded' });
    const campos = (res.text.split('\r\n')[1] ?? '').split(';');
    expect(campos[10]).toBe('Devuelto');
    expect(campos[11]).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });
});

describe('CU-38 Gestionar pagos: devolver (A1)', () => {
  it('devuelve un pago cobrado, avisa al adoptante y la adopción no cambia', async () => {
    const { id } = await ultimoCobrado(1);
    const antes = await adopcion(1);
    const res = await marta.post(`/api/admin/payments/${id}/refund`).send({});
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id, status: 'refunded', refundedAt: expect.any(String) });
    expect(await pago(id)).toMatchObject({ status: 'refunded', refunded_at: expect.any(Date) });
    expect(await adopcion(1)).toEqual(antes);
    expect((await notificaciones(6))[0]?.message).toContain('devuelto');
    const [email] = emailsA('lucia.martinez@correo.test');
    expect(email?.subject).toBe('Te hemos devuelto una cuota de Rufo');
  });

  it('un pago por transferencia también se puede devolver', async () => {
    const [id] = await idsSql("pa.method = 'bank_transfer'");
    expect((await marta.post(`/api/admin/payments/${id}/refund`).send({})).body.status).toBe('refunded');
  });

  it('A1a: no se devuelve un pago que no está cobrado', async () => {
    for (const where of ["pa.status = 'refunded'", "pa.status = 'failed'"]) {
      const [id] = await idsSql(where);
      const res = await marta.post(`/api/admin/payments/${id}/refund`).send({});
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('PAYMENT_NOT_REFUNDABLE');
    }
    expect((await marta.post('/api/admin/payments/99999/refund').send({})).status).toBe(404);
  });
});

describe('CU-38 Gestionar pagos: pago manual (A2)', () => {
  const registrar = (body: object) => marta.post('/api/admin/payments').send(body);

  it('regulariza una pausada: vuelve a activa y avanza el próximo cobro', async () => {
    const antes = await adopcion(7);
    const res = await registrar({ adoptionId: 7, amount: '5,00', method: 'bank_transfer' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      adoptionId: 7,
      amount: '5.00',
      periodStart: antes.next_billing_date,
      method: 'bank_transfer',
      status: 'completed',
      reference: expect.stringMatching(/^TRF-/),
      recordedBy: { id: 1, name: 'Marta Soler Ferrer' },
    });
    expect(await adopcion(7)).toMatchObject({
      status: 'active',
      next_billing_date: sumarMeses(antes.next_billing_date, 1),
    });
    expect((await notificaciones(8))[0]).toMatchObject({ type: 'payment_completed' });
    expect(emailsA('elena.rubio@correo.test')).toHaveLength(1);
  });

  it('adelanta la cuota de una activa; el importe lo decide el administrador', async () => {
    const antes = await adopcion(4);
    const res = await registrar({ adoptionId: 4, amount: '3.50', method: 'bank_transfer' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ periodStart: antes.next_billing_date, amount: '3.50' });
    expect((await adopcion(4)).next_billing_date).toBe(sumarMeses(antes.next_billing_date, 1));
  });

  it('con un cambio de plan programado, la cuota ya es del plan nuevo', async () => {
    const res = await registrar({ adoptionId: 5, amount: '12.00', method: 'bank_transfer' });
    expect(res.status).toBe(201);
    expect(res.body.plan).toMatchObject({ id: 3 });
    expect(await adopcion(5)).toMatchObject({ plan_id: 3, next_plan_id: null });
  });

  it('activa una pendiente: el primer mes empieza hoy y se da la bienvenida', async () => {
    const res = await registrar({ adoptionId: 11, amount: '5.00', method: 'bank_transfer' });
    expect(res.status).toBe(201);
    expect(res.body.periodStart).toBe(t.hoy);
    expect(await adopcion(11)).toMatchObject({
      status: 'active',
      start_date: t.hoy,
      next_billing_date: sumarMeses(t.hoy, 1),
    });
    expect((await notificaciones(10))[0]).toMatchObject({ type: 'adoption_welcome' });
  });

  it('sin cuota que pagar: pendiente caducada, baja solicitada o cerrada', async () => {
    const res = await registrar({ adoptionId: 12, amount: '5.00', method: 'bank_transfer' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('ADOPTION_PAYMENT_EXPIRED');
    for (const adoptionId of [9, 3, 13]) {
      const r = await registrar({ adoptionId, amount: '5.00', method: 'bank_transfer' });
      expect(r.status).toBe(422);
      expect(r.body.error.code).toBe('MANUAL_PAYMENT_NOT_ALLOWED');
    }
    expect((await registrar({ adoptionId: 999, amount: '5.00', method: 'bank_transfer' })).status).toBe(404);
  });

  it('A2a: ese periodo ya está pagado', async () => {
    const { next_billing_date: inicio } = await adopcion(6);
    await t.pool.query(
      `INSERT INTO payments (adoption_id, plan_id, amount, period_start, period_end, method, status, payment_reference, paid_at)
       VALUES (6, 1, 1.00, $1, ($1::date + INTERVAL '1 month' - INTERVAL '1 day')::date, 'card', 'completed', 'CARD-PRUEBA-A2A', NOW())`,
      [inicio],
    );
    const res = await registrar({ adoptionId: 6, amount: '1.00', method: 'bank_transfer' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({
      code: 'PAYMENT_ALREADY_COMPLETED',
      message: 'Este periodo ya está pagado.',
    });
  });

  it('valida el importe y el método (solo transferencia: ni tarjeta ni efectivo)', async () => {
    for (const method of ['card', 'cash']) {
      const res = await registrar({ adoptionId: 6, amount: '0', method });
      expect(res.status).toBe(400);
      expect(res.body.error.details.map((d: { field: string }) => d.field).sort()).toEqual(['amount', 'method']);
    }
  });
});

describe('CU-37 y CU-38: la ficha de la adopción', () => {
  const ficha = async (id: number): Promise<AdminAdoptionDetailDto> =>
    (await marta.get(`/api/admin/adoptions/${id}`)).body;

  it('indica la cuota pendiente que se puede registrar a mano (o null)', async () => {
    const activa = await ficha(2);
    expect(activa.pendingFee).toEqual({
      periodStart: activa.nextBillingDate,
      periodEnd: expect.any(String),
      amount: '12.00',
    });
    expect((await ficha(9)).pendingFee).toBeNull();
  });

  it('indica la última cuota cobrada que se podría devolver (o null)', async () => {
    const ultimo = await ultimoCobrado(2);
    expect((await ficha(2)).lastRefundablePayment).toEqual({ id: ultimo.id, amount: ultimo.amount });
    expect((await ficha(12)).lastRefundablePayment).toBeNull();
  });

  it('6: cancelar puede devolver también la última cuota cobrada', async () => {
    const ultimo = await ultimoCobrado(2);
    const res = await marta
      .patch('/api/admin/adoptions/2/status')
      .send({ action: 'cancel', notes: 'Lo pidió.', refundLastPayment: true });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelled');
    expect((await pago(ultimo.id)).status).toBe('refunded');
    expect(emailsA('lucia.martinez@correo.test').map((m) => m.subject)).toEqual([
      'Adopción cancelada: Sombra',
      'Te hemos devuelto una cuota de Sombra',
    ]);
  });

  it('6: sin la casilla, cancelar no devuelve nada', async () => {
    const ultimo = await ultimoCobrado(18);
    await marta.patch('/api/admin/adoptions/18/status').send({ action: 'cancel', notes: 'x' });
    expect((await pago(ultimo.id)).status).toBe('completed');
  });

  it('6: la casilla solo vale al cancelar, y si no hay nada cobrado es un error', async () => {
    const r1 = await marta
      .patch('/api/admin/adoptions/19/status')
      .send({ action: 'pause', notes: 'x', refundLastPayment: true });
    expect(r1.status).toBe(400);
    const r2 = await marta
      .patch('/api/admin/adoptions/12/status')
      .send({ action: 'cancel', notes: 'x', refundLastPayment: true });
    expect(r2.status).toBe(422);
    expect(r2.body.error.code).toBe('PAYMENT_NOT_REFUNDABLE');
    expect((await adopcion(12)).status).toBe('pending'); // no se ha cancelado a medias
  });
});
