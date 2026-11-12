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

  it('RN-18: sin sesión 401 y un adoptante 403', async () => {
    expect((await request(t.app).get('/api/admin/dashboard')).status).toBe(401);
    const lucia = await entrar('lucia.martinez@correo.test', 'Lucia.buitres1');
    expect((await lucia.get('/api/admin/dashboard')).status).toBe(403);
  });
});
