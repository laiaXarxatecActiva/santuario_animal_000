import type { DashboardDto } from '@sanctuary/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prepararApp, type TestApp } from './helpers/test-app.js';

let t: TestApp;
beforeAll(async () => {
  t = await prepararApp();
});
afterAll(() => t.pool.end());

async function entrar(email: string, password: string) {
  const agent = request.agent(t.app);
  expect((await agent.post('/api/auth/login').send({ email, password })).status).toBe(200);
  return agent;
}

describe('CU-27 Consultar el escritorio del panel', () => {
  it('2: muestra los animales por estado, las adopciones activas y las pendientes de pago', async () => {
    const res = await (await entrar('nuria.peris@santuario.test', 'NuriaPeris26#!')).get('/api/admin/dashboard');
    expect(res.status).toBe(200);
    const escritorio: DashboardDto = res.body;
    expect(escritorio.animalsByStatus).toEqual({ in_sanctuary: 10, in_treatment: 3, deceased: 1, transferred: 1 });
    expect(escritorio.activeAdoptions).toBe(11);
    expect(escritorio.pendingAdoptions).toBe(2);
  });

  it('2 (nota): Turia aparece en rojo (16 días) y Ébano en amarillo (12 días)', async () => {
    const res = await (await entrar('marta.soler@santuario.test', 'MartaSoler26#!')).get('/api/admin/dashboard');
    expect(res.body.updateAlerts).toEqual([
      {
        animal: { id: 3, name: 'Turia' },
        daysWithoutUpdate: 16,
        level: 'error',
        activeAdopters: 1,
      },
      {
        animal: { id: 9, name: 'Ébano' },
        daysWithoutUpdate: 12,
        level: 'warning',
        activeAdopters: 1,
      },
    ]);
  });

  it('una actualización nueva quita la alerta del animal', async () => {
    await t.pool.query(
      "INSERT INTO animal_updates (animal_id, author_id, title, body) VALUES (9, 4, 'Ébano al sol', 'Texto')",
    );
    const res = await (await entrar('nuria.peris@santuario.test', 'NuriaPeris26#!')).get('/api/admin/dashboard');
    expect(res.body.updateAlerts.map((a: { animal: { name: string } }) => a.animal.name)).toEqual(['Turia']);
  });

  it('sin actualizaciones, cuenta desde la primera adopción activa del animal', async () => {
    // Brisa no tiene adoptantes activos; se le da uno desde hace 20 días.
    await t.pool.query('DELETE FROM animal_updates WHERE animal_id = 5');
    await t.pool.query(
      `INSERT INTO adoptions (user_id, animal_id, plan_id, status, start_date, next_billing_date)
       VALUES (13, 5, 2, 'active', CURRENT_DATE - 20, CURRENT_DATE + 10)`,
    );
    const res = await (await entrar('nuria.peris@santuario.test', 'NuriaPeris26#!')).get('/api/admin/dashboard');
    expect(res.body.updateAlerts).toContainEqual({
      animal: { id: 5, name: 'Brisa' },
      daysWithoutUpdate: 20,
      level: 'error',
      activeAdopters: 1,
    });
  });

  it('3: el administrador ve los ingresos del mes, con cuotas y donaciones por separado', async () => {
    const marta = await entrar('marta.soler@santuario.test', 'MartaSoler26#!');
    const antes: DashboardDto = (await marta.get('/api/admin/dashboard')).body;
    expect(antes.revenue?.month).toBe(t.hoy.slice(0, 7));
    const suma = async (a: string, b: string) =>
      (await t.pool.query<{ s: string }>('SELECT ($1::numeric + $2::numeric)::text AS s', [a, b])).rows[0]?.s;
    expect(antes.revenue?.total).toBe(await suma(antes.revenue?.fees ?? '', antes.revenue?.donations ?? ''));

    // Cuenta lo cobrado este mes; no lo devuelto ni lo del mes anterior.
    const ahora = t.reloj.ahora();
    const haceUnMes = new Date(ahora.getTime() - 40 * 24 * 60 * 60 * 1000);
    await t.pool.query(
      `INSERT INTO donations (amount, method, status, payment_reference, paid_at, refunded_at) VALUES
         (2.50, 'card', 'completed', 'TEST-DASH-1', $1, NULL),
         (7.00, 'card', 'refunded',  'TEST-DASH-2', $1, $1),
         (9.00, 'card', 'completed', 'TEST-DASH-3', $2, NULL),
         (4.00, 'card', 'pending',   'TEST-DASH-4', NULL, NULL)`,
      [ahora, haceUnMes],
    );
    await t.pool.query(
      `INSERT INTO payments (adoption_id, plan_id, amount, period_start, period_end, method, status, payment_reference, paid_at)
       VALUES (1, 2, 5.00, '2000-01-01', '2000-01-31', 'card', 'completed', 'TEST-DASH-5', $1)`,
      [ahora],
    );
    const despues: DashboardDto = (await marta.get('/api/admin/dashboard')).body;
    expect(despues.revenue?.donations).toBe(await suma(antes.revenue?.donations ?? '', '2.50'));
    expect(despues.revenue?.fees).toBe(await suma(antes.revenue?.fees ?? '', '5.00'));
    expect(despues.revenue?.total).toBe(await suma(antes.revenue?.total ?? '', '7.50'));
  });

  it('3: el cuidador no ve los ingresos', async () => {
    const res = await (await entrar('nuria.peris@santuario.test', 'NuriaPeris26#!')).get('/api/admin/dashboard');
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('revenue');
  });

  it('RN-18: sin sesión 401 y un adoptante 403', async () => {
    expect((await request(t.app).get('/api/admin/dashboard')).status).toBe(401);
    const lucia = await entrar('lucia.martinez@correo.test', 'Lucia.buitres1');
    expect((await lucia.get('/api/admin/dashboard')).status).toBe(403);
  });
});
