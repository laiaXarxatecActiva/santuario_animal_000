import type { ContributionsResponse, ReceiptDto } from '@sanctuary/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { entrarComo, type Agente } from './helpers/sesion.js';
import { prepararApp, type TestApp } from './helpers/test-app.js';

let t: TestApp;
let lucia: Agente;
beforeAll(async () => {
  t = await prepararApp();
  lucia = await entrarComo(t.app, 'lucia');
});
afterAll(() => t.pool.end());

async function entrar(email: string, password: string): Promise<Agente> {
  const agent = request.agent(t.app);
  expect((await agent.post('/api/auth/login').send({ email, password })).status).toBe(200);
  return agent;
}

const aportaciones = async (agente: Agente, query: Record<string, string | number> = {}) => {
  const res = await agente.get('/api/me/contributions').query(query);
  expect(res.status).toBe(200);
  return res.body as ContributionsResponse;
};

/** Total cobrado (cuotas y donaciones) de un usuario, calculado aparte. */
const totalCobrado = async (userId: number) => {
  const { rows } = await t.pool.query<{ total: string }>(
    `SELECT to_char(
              COALESCE((SELECT sum(p.amount) FROM payments p JOIN adoptions a ON a.id = p.adoption_id
                         WHERE a.user_id = $1 AND p.status = 'completed'), 0)
            + COALESCE((SELECT sum(amount) FROM donations WHERE user_id = $1 AND status = 'completed'), 0),
            'FM999990.00') AS total`,
    [userId],
  );
  return rows[0]?.total;
};

describe('CU-19 Consultar mis aportaciones', () => {
  it('sin sesión 401; los trabajadores 403', async () => {
    expect((await request(t.app).get('/api/me/contributions')).status).toBe(401);
    expect((await (await entrarComo(t.app, 'nuria')).get('/api/me/contributions')).status).toBe(403);
  });

  it('2: lista las cuotas y donaciones propias, las más recientes primero', async () => {
    const res = await aportaciones(lucia);
    const { rows } = await t.pool.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM payments p JOIN adoptions a ON a.id = p.adoption_id WHERE a.user_id = 6',
    );
    expect(res.payments).toHaveLength(rows[0]?.n ?? -1);
    expect(new Set(res.payments.map((p) => p.animal.name))).toEqual(new Set(['Rufo', 'Sombra', 'Carbón', 'Faro']));
    const fechas = res.payments.map((p) => p.date);
    expect(fechas).toEqual([...fechas].sort().reverse());
    expect(res.payments[0]).toEqual({
      id: expect.any(Number),
      adoptionId: expect.any(Number),
      animal: { id: expect.any(Number), name: expect.any(String) },
      amount: expect.stringMatching(/^\d+\.\d{2}$/),
      periodStart: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      periodEnd: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      date: expect.any(String),
      status: 'completed',
      method: 'card',
      reference: expect.stringMatching(/^CARD-/),
    });
    expect(res.donations.map((d) => d.id)).toEqual([12, 1]);
    expect(res.donations[1]).toEqual({
      id: 1,
      amount: '20.00',
      date: expect.any(String),
      status: 'completed',
      method: 'card',
      reference: 'CARD-D0001',
      isAnonymous: false,
    });
  });

  it('3: totales por año y desde el principio, solo con lo cobrado', async () => {
    const { totals } = await aportaciones(lucia);
    expect(totals.allTime).toBe(await totalCobrado(6));
    const suma = totals.years.reduce((acc, y) => acc + Math.round(Number(y.total) * 100), 0);
    expect(suma).toBe(Math.round(Number(totals.allTime) * 100));
    const anios = totals.years.map((y) => y.year);
    expect(anios).toEqual([...anios].sort((a, b) => b - a));
  });

  it('?year filtra los listados, pero no los totales', async () => {
    const todo = await aportaciones(lucia);
    const anio = Number(t.hoy.slice(0, 4));
    const filtrado = await aportaciones(lucia, { year: anio });
    expect(filtrado.payments.length).toBeGreaterThan(0);
    expect(filtrado.payments.length).toBeLessThan(todo.payments.length);
    expect(filtrado.totals).toEqual(todo.totals);
    expect((await aportaciones(lucia, { year: 2001 })).payments).toEqual([]);
    expect((await lucia.get('/api/me/contributions').query({ year: 'x' })).status).toBe(400);
  });

  it('4b: los devueltos aparecen como devueltos y no suman', async () => {
    const pablo = await entrar('pablo.garcia@correo.test', 'Pablo2024!');
    const res = await aportaciones(pablo);
    expect(res.payments.filter((p) => p.status === 'refunded').map((p) => p.animal.name)).toEqual(['Nieve']);
    expect(res.donations.map((d) => [d.id, d.isAnonymous])).toEqual([[5, true]]);
    expect(res.totals.allTime).toBe(await totalCobrado(7));
  });

  it('2a: sin aportaciones, listas vacías y total 0', async () => {
    const adrian = await entrar('adrian.moreno@correo.test', 'Adrian_99');
    expect(await aportaciones(adrian)).toEqual({
      payments: [],
      donations: [],
      totals: { allTime: '0.00', years: [] },
    });
  });
});

describe('CU-19 Recibos', () => {
  const idPago = async (adoptionId: number, status: string) => {
    const { rows } = await t.pool.query<{ id: number }>(
      'SELECT id FROM payments WHERE adoption_id = $1 AND status = $2 ORDER BY id LIMIT 1',
      [adoptionId, status],
    );
    return rows[0]?.id ?? 0;
  };

  it('5: recibo de una cuota cobrada con los datos del pagador y del pago', async () => {
    const id = await idPago(1, 'completed');
    const res = await lucia.get(`/api/me/payments/${id}/receipt`);
    expect(res.status).toBe(200);
    expect(res.body as ReceiptDto).toEqual({
      kind: 'payment',
      id,
      reference: expect.stringMatching(/^CARD-A0001-/),
      amount: expect.any(String),
      method: 'card',
      status: 'completed',
      paidAt: expect.any(String),
      refundedAt: null,
      animalName: 'Rufo',
      planName: 'Usual',
      periodStart: expect.any(String),
      periodEnd: expect.any(String),
      payer: { fullName: expect.stringContaining('Lucía'), email: 'lucia.martinez@correo.test' },
    });
  });

  it('5: el recibo muestra el plan con el que se cobró, aunque después se cambie', async () => {
    const id = await idPago(1, 'completed');
    await t.pool.query('UPDATE adoptions SET plan_id = 3 WHERE id = 1');
    try {
      const res = await lucia.get(`/api/me/payments/${id}/receipt`);
      expect(res.body.planName).toBe('Usual');
    } finally {
      await t.pool.query('UPDATE adoptions SET plan_id = 2 WHERE id = 1');
    }
  });

  it('4b: recibo de una cuota devuelta con su fecha de devolución', async () => {
    const pablo = await entrar('pablo.garcia@correo.test', 'Pablo2024!');
    const res = await pablo.get(`/api/me/payments/${await idPago(20, 'refunded')}/receipt`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'refunded', refundedAt: expect.any(String), animalName: 'Nieve' });
  });

  it('4a: una cuota fallida no tiene recibo (422); una ajena es 404', async () => {
    const elena = await entrar('elena.rubio@correo.test', 'elenita_88');
    const fallida = await elena.get(`/api/me/payments/${await idPago(7, 'failed')}/receipt`);
    expect(fallida.status).toBe(422);
    expect(fallida.body.error.code).toBe('RECEIPT_NOT_AVAILABLE');
    expect((await lucia.get(`/api/me/payments/${await idPago(4, 'completed')}/receipt`)).status).toBe(404);
  });

  it('5: recibo de una donación; las pendientes no tienen, las ajenas son 404', async () => {
    const res = await lucia.get('/api/me/donations/1/receipt');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      kind: 'donation',
      id: 1,
      reference: 'CARD-D0001',
      amount: '20.00',
      method: 'card',
      status: 'completed',
      paidAt: expect.any(String),
      refundedAt: null,
      animalName: null,
      planName: null,
      periodStart: null,
      periodEnd: null,
      payer: { fullName: expect.stringContaining('Lucía'), email: 'lucia.martinez@correo.test' },
    });
    const irene = await entrar('irene.dominguez@correo.test', 'Irene2025ok');
    expect((await irene.get('/api/me/donations/10/receipt')).status).toBe(422);
    expect((await lucia.get('/api/me/donations/5/receipt')).status).toBe(404);
    expect((await lucia.get('/api/me/donations/abc/receipt')).status).toBe(400);
  });
});
