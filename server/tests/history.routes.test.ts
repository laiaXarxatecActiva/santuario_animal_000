import type { HistoryResponse } from '@sanctuary/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sumarDias } from '../src/dominio/adopcion.js';
import { relojFijo } from '../src/dominio/reloj.js';
import { runBilling } from '../src/jobs/billing.job.js';
import { createSimulatedGateway } from '../src/services/payment/simulated.gateway.js';
import { entrarComo, type Agente } from './helpers/sesion.js';
import { prepararApp, type TestApp } from './helpers/test-app.js';
import { depsDePrueba } from './jobs/helpers.js';

let t: TestApp;
let lucia: Agente;
beforeAll(async () => {
  t = await prepararApp();
  lucia = await entrarComo(t.app, 'lucia');
});
afterAll(() => t.pool.end());

const historial = async (query = '') => {
  const res = await lucia.get(`/api/me/history${query}`);
  expect(res.status).toBe(200);
  return res.body as HistoryResponse;
};

describe('CU-15 Historial de «Mis animales»', () => {
  it('devuelve los sucesos del último año, de 10 en 10, del más reciente al más antiguo', async () => {
    const { data, meta } = await historial();
    expect(meta).toMatchObject({ page: 1, pageSize: 10 });
    // Sin los pagos, Lucía tiene menos de 10 sucesos: salen todos en la primera página.
    expect(meta.total).toBeGreaterThan(2);
    expect(data).toHaveLength(Math.min(10, meta.total));
    // Desde el mismo día del año pasado (el reloj de las pruebas es el día de carga de los datos).
    expect(meta.since).toBe(`${Number(t.hoy.slice(0, 4)) - 1}${t.hoy.slice(4)}`);
    expect(data.every((s) => s.date >= meta.since && s.date <= t.hoy)).toBe(true);
    const fechas = data.map((s) => s.date);
    expect([...fechas].sort().reverse()).toEqual(fechas);

    // Por páginas (de 2, para tener más de una).
    const primera = await historial('?pageSize=2');
    const segunda = await historial('?page=2&pageSize=2');
    expect(primera.data.map((s) => s.id)).toEqual(data.slice(0, 2).map((s) => s.id));
    expect(segunda.data.map((s) => s.id)).toEqual(data.slice(2, 4).map((s) => s.id));
  });

  it('filtra por animal', async () => {
    const { data } = await historial('?animalId=1&pageSize=100');
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((s) => s.animal.id === 1 && s.animal.name === 'Rufo')).toBe(true);
  });

  it('apunta lo que hace el adoptante: cambio de plan, forma de pago y baja (CU-20, CU-49, CU-21)', async () => {
    expect((await lucia.patch('/api/me/adoptions/18/plan').send({ planId: 3 })).status).toBe(200);
    expect((await lucia.patch('/api/me/adoptions/18/payment-mode').send({ paymentMode: 'manual' })).status).toBe(200);
    expect((await lucia.post('/api/me/adoptions/18/cancel').send({})).status).toBe(200);

    const { data } = await historial('?animalId=10');
    expect(data.slice(0, 3).map((s) => s.type)).toEqual(
      expect.arrayContaining(['plan_change_requested', 'payment_mode_changed', 'cancel_requested']),
    );
    expect(data.find((s) => s.type === 'plan_change_requested')).toMatchObject({
      date: t.hoy,
      previousPlanName: 'Simbólica',
      planName: 'Extraordinaria',
    });
    expect(data.find((s) => s.type === 'payment_mode_changed')).toMatchObject({ paymentMode: 'manual' });
  });

  it('valida los filtros y solo lo ven los adoptantes', async () => {
    expect((await lucia.get('/api/me/history?animalId=cero')).status).toBe(400);
    expect((await lucia.get('/api/me/history?pageSize=500')).status).toBe(400);
    expect((await request(t.app).get('/api/me/history')).status).toBe(401);
    const nuria = await entrarComo(t.app, 'nuria');
    expect((await nuria.get('/api/me/history')).status).toBe(403);
  });

  it('un animal que no es suyo no le da nada', async () => {
    // Greta (animal 2) la adoptan Pablo y Elena, no Lucía.
    const { data, meta } = await historial('?animalId=2');
    expect(data).toEqual([]);
    expect(meta.total).toBe(0);
  });
});

describe('CU-15 El historial recoge también lo que hacen el panel y las tareas', () => {
  const tipos = async (animalId: number) => (await historial(`?animalId=${animalId}&pageSize=100`)).data;
  const vencerHoy = (id: number) =>
    t.pool.query('UPDATE adoptions SET next_billing_date = $2 WHERE id = $1', [id, t.hoy]);

  it('CU-43: al cobrar la cuota se aplica el cambio de plan pedido; el cobro no sale', async () => {
    // Rufo (adopción 1, plan Usual): pide pasar a Simbólica y la cuota vence hoy.
    expect((await lucia.patch('/api/me/adoptions/1/plan').send({ planId: 1 })).status).toBe(200);
    await vencerHoy(1);
    await runBilling(depsDePrueba(t));

    const [ultimo, ...resto] = await tipos(1);
    expect(ultimo).toMatchObject({ type: 'plan_changed', previousPlanName: 'Usual', planName: 'Simbólica' });
    // El cobro está en «Mis aportaciones» (CU-19), no en el historial.
    expect(resto.map((s) => s.type)).not.toContain('payment_completed');
    expect(resto.find((s) => s.type === 'plan_change_requested')).toMatchObject({ planName: 'Simbólica' });
    // Al aplicarse no se cuenta como «anulado».
    expect(resto.some((s) => s.type === 'plan_change_cancelled')).toBe(false);
  });

  it('CU-43 3a y CU-37: la cuota fallida pausa la adopción; el panel la reanuda', async () => {
    // Adopción 2 de Lucía (animal 8).
    await vencerHoy(2);
    const reloj = relojFijo(`${t.hoy}T03:00:00+01:00`);
    await runBilling({ ...depsDePrueba(t), payments: createSimulatedGateway({ mode: 'always_fail', reloj }) });
    const marta = await entrarComo(t.app, 'marta');
    expect((await marta.patch('/api/admin/adoptions/2/status').send({ action: 'resume' })).status).toBe(200);

    const sucesos = (await tipos(8)).filter((s) => s.date === t.hoy).map((s) => s.type);
    expect(sucesos).toEqual(expect.arrayContaining(['paused', 'resumed']));
    expect(sucesos).not.toContain('payment_failed');
    // La reanudación es lo último que pasó.
    expect(sucesos[0]).toBe('resumed');
  });

  it('CU-21: la baja pedida el día antes de la cuota también sale (sigue activa hasta hoy)', async () => {
    await t.pool.query('UPDATE adoptions SET next_billing_date = $1 WHERE id = 1', [sumarDias(t.hoy, 1)]);
    expect((await lucia.post('/api/me/adoptions/1/cancel').send({})).status).toBe(200);
    expect((await tipos(1)).find((s) => s.type === 'cancel_requested')).toMatchObject({ date: t.hoy });
  });
});
