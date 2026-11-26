import type { AdminPlanDto } from '@sanctuary/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { entrarComo, type Agente } from './helpers/sesion.js';
import { prepararApp, type TestApp } from './helpers/test-app.js';

let t: TestApp;
let marta: Agente;
beforeAll(async () => {
  t = await prepararApp();
  marta = await entrarComo(t.app, 'marta');
});
afterAll(() => t.pool.end());

const planes = async (): Promise<AdminPlanDto[]> => (await marta.get('/api/admin/plans')).body.data;

/** Todos los planes como se envían al guardar, con los cambios de cada uno. */
async function todos(cambios: Record<number, Record<string, unknown>> = {}) {
  return (await planes()).map(({ id, name, monthlyAmount, description, isDefault, isActive }) => ({
    id,
    name,
    monthlyAmount,
    description,
    isDefault,
    isActive,
    ...cambios[id],
  }));
}
const guardar = (cuerpo: object) => marta.put('/api/admin/plans').send(cuerpo);

describe('CU-40 Guardar todos los planes a la vez', () => {
  it('solo el administrador: sin sesión 401; cuidadora y adoptante 403', async () => {
    const cuerpo = { plans: await todos() };
    expect((await request(t.app).put('/api/admin/plans').send(cuerpo)).status).toBe(401);
    for (const quien of ['nuria', 'lucia'] as const) {
      const agente = await entrarComo(t.app, quien);
      expect((await agente.put('/api/admin/plans').send(cuerpo)).status).toBe(403);
    }
  });

  it('si un plan no cumple las reglas, no se guarda ninguno', async () => {
    const res = await guardar({ plans: await todos({ 1: { name: 'Simbólica nueva' }, 2: { isDefault: false } }) });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('DEFAULT_PLAN_NEEDS_REPLACEMENT');
    expect(res.body.error.details[0].field).toBe('plans.1.isDefault');
    expect((await planes()).find((p) => p.id === 1)?.name).toBe('Simbólica');
  });

  it('no admite dos planes por defecto ni uno por defecto desactivado', async () => {
    const dos = await guardar({ plans: await todos({ 1: { isDefault: true } }) });
    expect(dos.status).toBe(422);
    expect(dos.body.error.code).toBe('DEFAULT_PLAN_NOT_UNIQUE');
    expect(dos.body.error.details[0].field).toBe('plans.0.isDefault');

    const inactivo = await guardar({ plans: await todos({ 2: { isActive: false } }) });
    expect(inactivo.status).toBe(422);
    expect(inactivo.body.error.code).toBe('DEFAULT_PLAN_MUST_BE_ACTIVE');
    expect(inactivo.body.error.details[0].field).toBe('plans.1.isActive');
  });

  it('guarda todos los cambios juntos, con el nuevo plan por defecto, y anota cada plan cambiado', async () => {
    const res = await guardar({
      plans: await todos({
        1: { name: 'Simbólica+', description: 'Un gesto.' },
        2: { isDefault: false },
        3: { isDefault: true },
      }),
    });
    expect(res.status).toBe(200);
    expect(res.body.data.map((p: AdminPlanDto) => [p.id, p.name, p.isDefault])).toEqual([
      [1, 'Simbólica+', false],
      [2, 'Usual', false],
      [3, 'Extraordinaria', true],
    ]);
    expect((await planes()).filter((p) => p.isDefault).map((p) => p.id)).toEqual([3]);
    const { rows } = await t.pool.query<{ record_id: number }>(
      "SELECT record_id FROM activity_logs WHERE table_name = 'adoption_plans' AND action = 'update' ORDER BY record_id",
    );
    expect(rows.map((r) => r.record_id)).toEqual([1, 2, 3]);
  });

  it('3a: un nuevo importe con adopciones activas pide confirmación', async () => {
    const cuerpo = { plans: await todos({ 2: { monthlyAmount: '6,5' } }) };
    const sinConfirmar = await guardar(cuerpo);
    expect(sinConfirmar.status).toBe(409);
    expect(sinConfirmar.body.error.code).toBe('PLAN_AMOUNT_CHANGE_UNCONFIRMED');
    expect((await planes()).find((p) => p.id === 2)?.monthlyAmount).toBe('5.00');

    const confirmado = await guardar({ ...cuerpo, confirmAmountChange: true });
    expect(confirmado.status).toBe(200);
    expect(confirmado.body.data.find((p: AdminPlanDto) => p.id === 2)?.monthlyAmount).toBe('6.50');
  });

  it('valida cada plan, no admite planes repetidos y responde 404 si uno no existe', async () => {
    const importe = await guardar({ plans: await todos({ 1: { monthlyAmount: '0' } }) });
    expect(importe.status).toBe(400);
    expect(importe.body.error.details.map((d: { field: string }) => d.field)).toContain('plans.0.monthlyAmount');

    const [primero] = await todos();
    expect((await guardar({ plans: [primero, primero] })).status).toBe(400);
    expect((await guardar({ plans: [] })).status).toBe(400);
    expect((await guardar({ plans: [{ ...primero, id: 999 }] })).status).toBe(404);
  });
});
