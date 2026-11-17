import type { AdoptionDto } from '@sanctuary/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { sumarDias } from '../src/dominio/adopcion.js';
import { prepararApp, type TestApp } from './helpers/test-app.js';

let t: TestApp;
beforeAll(async () => {
  t = await prepararApp();
});
afterAll(() => t.pool.end());
beforeEach(() => {
  t.mailer.outbox.length = 0;
});

type Agent = ReturnType<typeof request.agent>;
const CLAVES: Record<string, string> = {
  lucia: 'Lucia.buitres1',
  pablo: 'Pablo2024!',
  elena: 'elenita_88',
  irene: 'Irene2025ok',
  sergio: 'Sergio#Vuela7',
};
const EMAILS: Record<string, string> = {
  lucia: 'lucia.martinez@correo.test',
  pablo: 'pablo.garcia@correo.test',
  elena: 'elena.rubio@correo.test',
  irene: 'irene.dominguez@correo.test',
  sergio: 'sergio.llorens@correo.test',
};
const sesiones = new Map<string, Agent>();
async function como(quien: string): Promise<Agent> {
  const existente = sesiones.get(quien);
  if (existente) return existente;
  const agent = request.agent(t.app);
  const res = await agent.post('/api/auth/login').send({ email: EMAILS[quien], password: CLAVES[quien] });
  expect(res.status).toBe(200);
  sesiones.set(quien, agent);
  return agent;
}

const cambiarPlan = async (quien: string, adoptionId: number, planId: number) =>
  (await como(quien)).patch(`/api/me/adoptions/${adoptionId}/plan`).send({ planId });
const darDeBaja = async (quien: string, adoptionId: number) =>
  (await como(quien)).post(`/api/me/adoptions/${adoptionId}/cancel`).send({});
const notificaciones = async (userId: number, type: string) =>
  (
    await t.pool.query<{ message: string; link: string }>(
      'SELECT message, link FROM notifications WHERE user_id = $1 AND type = $2 ORDER BY id',
      [userId, type],
    )
  ).rows;
const fila = async (id: number) =>
  (
    await t.pool.query(
      `SELECT status, plan_id, next_plan_id, end_reason, end_date::text AS end_date,
              next_billing_date::text AS next_billing_date, cancel_requested_at IS NOT NULL AS cancel_requested
         FROM adoptions WHERE id = $1`,
      [id],
    )
  ).rows[0];

describe('CU-20 Cambiar de plan', () => {
  it('sin sesión 401; cuerpo no válido 400', async () => {
    expect((await request(t.app).patch('/api/me/adoptions/4/plan').send({ planId: 2 })).status).toBe(401);
    expect((await (await como('pablo')).patch('/api/me/adoptions/4/plan').send({ planId: 'dos' })).status).toBe(400);
  });

  it('4: programa el cambio para la próxima cuota, avisa y envía el email', async () => {
    const { next_billing_date: proxima } = await fila(4);
    const res = await cambiarPlan('pablo', 4, 2);
    expect(res.status).toBe(200);
    const adopcion = res.body as AdoptionDto;
    expect(adopcion.plan.name).toBe('Simbólica');
    expect(adopcion.nextPlan).toEqual({ id: 2, name: 'Usual', monthlyAmount: '5.00' });
    expect(adopcion.nextBillingDate).toBe(proxima);
    expect((await notificaciones(7, 'plan_changed')).filter((n) => n.link === '/my-animals/1')).toEqual([
      { message: expect.stringContaining('Rufo'), link: '/my-animals/1' },
    ]);
    expect(t.mailer.outbox.map((m) => [m.to, m.subject])).toEqual([
      ['pablo.garcia@correo.test', 'Cambio de plan programado: Rufo'],
    ]);
    expect(t.mailer.outbox[0]?.text).toContain('Usual');
    expect(t.mailer.outbox[0]?.text).toMatch(/5,00\s€/);
  });

  it('3b: un tercer plan sustituye el cambio programado', async () => {
    const res = await cambiarPlan('pablo', 4, 3);
    expect(res.status).toBe(200);
    expect((res.body as AdoptionDto).nextPlan?.name).toBe('Extraordinaria');
    expect((await fila(4)).next_plan_id).toBe(3);
  });

  it('3a: elegir el plan actual anula el cambio, sin email; repetirlo no hace nada', async () => {
    const res = await cambiarPlan('pablo', 4, 1);
    expect(res.status).toBe(200);
    expect((res.body as AdoptionDto).nextPlan).toBeNull();
    expect((await fila(4)).next_plan_id).toBeNull();
    expect(t.mailer.outbox).toHaveLength(0);

    const antes = (await notificaciones(7, 'plan_changed')).length;
    expect((await cambiarPlan('pablo', 4, 1)).status).toBe(200);
    expect(await notificaciones(7, 'plan_changed')).toHaveLength(antes);
  });

  it('1a: pausada o con baja solicitada no se puede cambiar (422)', async () => {
    const pausada = await cambiarPlan('elena', 7, 3);
    expect(pausada.status).toBe(422);
    expect(pausada.body.error.code).toBe('PLAN_CHANGE_NOT_ALLOWED');
    const conBaja = await cambiarPlan('sergio', 9, 1);
    expect(conBaja.status).toBe(422);
    expect(conBaja.body.error.code).toBe('PLAN_CHANGE_NOT_ALLOWED');
  });

  it('una adopción ajena es 404 y un plan inexistente 422', async () => {
    expect((await cambiarPlan('lucia', 4, 2)).status).toBe(404);
    const plan = await cambiarPlan('pablo', 4, 999);
    expect(plan.status).toBe(422);
    expect(plan.body.error.code).toBe('PLAN_NOT_AVAILABLE');
  });
});

describe('CU-21 Darse de baja de una adopción', () => {
  it('sin sesión 401', async () => {
    expect((await request(t.app).post('/api/me/adoptions/18/cancel').send({})).status).toBe(401);
  });

  it('4-5: activa: sigue activa hasta el último día pagado, sin más cobros; avisa y envía el email', async () => {
    await t.pool.query('UPDATE adoptions SET next_plan_id = 2 WHERE id = 18');
    const { next_billing_date: proxima } = await fila(18);
    const res = await darDeBaja('lucia', 18);
    expect(res.status).toBe(200);
    const adopcion = res.body as AdoptionDto;
    expect(adopcion).toMatchObject({
      status: 'active',
      cancelRequested: true,
      endDate: sumarDias(proxima, -1),
      nextBillingDate: null,
      nextPlan: null,
    });
    expect(await fila(18)).toMatchObject({ status: 'active', cancel_requested: true, end_reason: null });
    const avisos = await notificaciones(6, 'adoption_cancelled');
    expect(avisos.at(-1)).toEqual({ message: expect.stringContaining('Carbón'), link: '/my-animals/10' });
    expect(t.mailer.outbox.map((m) => [m.to, m.subject])).toEqual([
      ['lucia.martinez@correo.test', 'Baja confirmada: Carbón'],
    ]);
  });

  it('pedir la baja otra vez responde 409', async () => {
    const res = await darDeBaja('lucia', 18);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ADOPTION_CANCEL_ALREADY_REQUESTED');
  });

  it('1a: pendiente: pasa a cancelada hoy', async () => {
    const res = await darDeBaja('irene', 11);
    expect(res.status).toBe(200);
    expect(await fila(11)).toMatchObject({ status: 'cancelled', end_reason: 'user_cancelled', end_date: t.hoy });
  });

  it('1b: pausada: termina el último día pagado y la cuota pendiente no se cobra', async () => {
    const { next_billing_date: pendiente } = await fila(7);
    const res = await darDeBaja('elena', 7);
    expect(res.status).toBe(200);
    expect(await fila(7)).toMatchObject({
      status: 'finished',
      end_reason: 'user_cancelled',
      end_date: sumarDias(pendiente, -1),
      next_billing_date: null,
    });
  });

  it('una cerrada responde 422 y una ajena 404', async () => {
    const cerrada = await darDeBaja('lucia', 3);
    expect(cerrada.status).toBe(422);
    expect(cerrada.body.error.code).toBe('ADOPTION_CLOSED');
    expect((await darDeBaja('lucia', 4)).status).toBe(404);
  });
});
