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
const plan = async (id: number) => (await planes()).find((p) => p.id === id);
const publicos = async (): Promise<{ id: number; name: string }[]> =>
  (await request(t.app).get('/api/plans')).body.data;

/** Cuerpo completo del PUT a partir del plan actual. */
async function edicion(id: number, cambios: Record<string, unknown>) {
  const actual = await plan(id);
  if (!actual) throw new Error(`No existe el plan ${id}`);
  const { name, monthlyAmount, description, isDefault, isActive } = actual;
  return { name, monthlyAmount, description, isDefault, isActive, ...cambios };
}

const activasDelPlan = async (id: number) => {
  const { rows } = await t.pool.query<{ n: number }>(
    "SELECT count(*)::int AS n FROM adoptions WHERE plan_id = $1 AND status = 'active'",
    [id],
  );
  return rows[0]?.n;
};

describe('CU-40 Gestionar planes de adopción', () => {
  it('solo el administrador: sin sesión 401; cuidadora y adoptante 403', async () => {
    expect((await request(t.app).get('/api/admin/plans')).status).toBe(401);
    for (const quien of ['nuria', 'lucia'] as const) {
      const agente = await entrarComo(t.app, quien);
      expect((await agente.get('/api/admin/plans')).status).toBe(403);
      expect((await agente.post('/api/admin/plans').send({ name: 'X', monthlyAmount: '2' })).status).toBe(403);
      expect((await agente.put('/api/admin/plans/1').send(await edicion(1, {}))).status).toBe(403);
    }
  });

  it('2: lista los planes con su importe, descripción, por defecto, activo y adopciones activas', async () => {
    const lista = await planes();
    expect(lista.map((p) => [p.name, p.monthlyAmount, p.isDefault, p.isActive])).toEqual([
      ['Simbólica', '1.00', false, true],
      ['Usual', '5.00', true, true],
      ['Extraordinaria', '12.00', false, true],
    ]);
    expect(lista[0]?.description).toBe('Para quien quiere colaborar con lo mínimo.');
    for (const p of lista) expect(p.activeAdoptions).toBe(await activasDelPlan(p.id));
    expect(lista.find((p) => p.id === 2)?.activeAdoptions).toBeGreaterThan(0);
  });

  it('3: edita el nombre y la descripción, y se ven en la web pública', async () => {
    const res = await marta
      .put('/api/admin/plans/1')
      .send(await edicion(1, { name: 'Simbólica ', description: 'Un gesto pequeño.' }));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 1, name: 'Simbólica', description: 'Un gesto pequeño.' });
    expect((await publicos()).find((p) => p.id === 1)?.name).toBe('Simbólica');
  });

  it('3a: cambiar el importe con adopciones activas pide confirmación', async () => {
    const sinConfirmar = await marta.put('/api/admin/plans/3').send(await edicion(3, { monthlyAmount: '15' }));
    expect(sinConfirmar.status).toBe(409);
    expect(sinConfirmar.body.error.code).toBe('PLAN_AMOUNT_CHANGE_UNCONFIRMED');
    expect((await plan(3))?.monthlyAmount).toBe('12.00');

    const confirmado = await marta
      .put('/api/admin/plans/3')
      .send(await edicion(3, { monthlyAmount: '15', confirmAmountChange: true }));
    expect(confirmado.status).toBe(200);
    expect(confirmado.body.monthlyAmount).toBe('15.00');
  });

  it('3b: importe menor o igual a 0 o con más de dos decimales: error en el campo', async () => {
    for (const monthlyAmount of ['0', '-1', '1.234', 'cinco']) {
      const res = await marta.put('/api/admin/plans/1').send(await edicion(1, { monthlyAmount }));
      expect(res.status).toBe(400);
      expect(res.body.error.details.map((d: { field: string }) => d.field)).toContain('monthlyAmount');
    }
  });

  it('3: cambia el plan por defecto; el anterior deja de serlo', async () => {
    const res = await marta.put('/api/admin/plans/3').send(await edicion(3, { isDefault: true }));
    expect(res.status).toBe(200);
    expect((await planes()).filter((p) => p.isDefault).map((p) => p.id)).toEqual([3]);
  });

  it('A1: no se puede desactivar el plan por defecto ni dejarlo sin elegir otro', async () => {
    const desactivar = await marta.put('/api/admin/plans/3').send(await edicion(3, { isActive: false }));
    expect(desactivar.status).toBe(422);
    expect(desactivar.body.error).toMatchObject({ code: 'DEFAULT_PLAN_MUST_BE_ACTIVE' });
    expect(desactivar.body.error.details[0].field).toBe('isActive');

    const quitar = await marta.put('/api/admin/plans/3').send(await edicion(3, { isDefault: false }));
    expect(quitar.status).toBe(422);
    expect(quitar.body.error).toMatchObject({ code: 'DEFAULT_PLAN_NEEDS_REPLACEMENT' });
    expect(quitar.body.error.details[0].field).toBe('isDefault');
    expect((await plan(3))?.isDefault).toBe(true);
  });

  it('A1: un plan desactivado deja de ofrecerse, pero sus adopciones siguen con él', async () => {
    const antes = await activasDelPlan(1);
    const res = await marta.put('/api/admin/plans/1').send(await edicion(1, { isActive: false }));
    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);
    expect((await publicos()).map((p) => p.id)).not.toContain(1);
    expect(await activasDelPlan(1)).toBe(antes);
  });

  it('A2: crea un plan mensual, que se ofrece el último', async () => {
    const res = await marta
      .post('/api/admin/plans')
      .send({ name: 'Padrino de honor', monthlyAmount: '25,5', description: '', period: 'yearly' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(Number),
      name: 'Padrino de honor',
      monthlyAmount: '25.50',
      description: null,
      isDefault: false,
      isActive: true,
      activeAdoptions: 0,
      deletable: true,
    });
    expect((await publicos()).at(-1)?.name).toBe('Padrino de honor');

    // Sin adopciones activas, el importe cambia sin confirmar.
    const cambio = await marta
      .put(`/api/admin/plans/${res.body.id}`)
      .send(await edicion(res.body.id, { monthlyAmount: '30' }));
    expect(cambio.status).toBe(200);
  });

  it('A2: un plan nuevo puede ser el de por defecto', async () => {
    const res = await marta.post('/api/admin/plans').send({ name: 'Familia', monthlyAmount: '8', isDefault: true });
    expect(res.status).toBe(201);
    expect((await planes()).filter((p) => p.isDefault).map((p) => p.id)).toEqual([res.body.id]);
  });

  it('nombre repetido (sin distinguir mayúsculas): error en el campo', async () => {
    const res = await marta.post('/api/admin/plans').send({ name: 'USUAL', monthlyAmount: '3' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: 'PLAN_ALREADY_EXISTS' });
    expect(res.body.error.details[0].field).toBe('name');
  });

  it('valida los datos y responde 404 si el plan no existe', async () => {
    expect((await marta.post('/api/admin/plans').send({ name: '', monthlyAmount: '3' })).status).toBe(400);
    const res = await marta.put('/api/admin/plans/999').send(await edicion(2, {}));
    expect(res.status).toBe(404);
  });
});

describe('CU-40 A3 Borrar un plan que nunca se ha usado', () => {
  const ruta = (id: number) => `/api/admin/plans/${id}`;
  const nuevo = async (name: string, extra: Record<string, unknown> = {}): Promise<number> => {
    const res = await marta.post('/api/admin/plans').send({ name, monthlyAmount: '3', ...extra });
    expect(res.status).toBe(201);
    return res.body.id as number;
  };

  it('solo el administrador: sin sesión 401; cuidadora y adoptante 403, sin borrar nada', async () => {
    const id = await nuevo('Sin uso para permisos');
    expect((await request(t.app).delete(ruta(id)).send({})).status).toBe(401);
    for (const quien of ['nuria', 'lucia'] as const) {
      const agente = await entrarComo(t.app, quien);
      expect((await agente.delete(ruta(id)).send({})).status).toBe(403);
    }
    expect(await plan(id)).toBeDefined();
  });

  it('cada plan dice si se puede borrar: solo los que nunca se han usado y no son el de por defecto', async () => {
    const id = await nuevo('Recién creado');
    const lista = await planes();
    expect(lista.find((p) => p.id === id)?.deletable).toBe(true);
    // Los planes de RN-04 tienen adopciones y pagos; Usual, además, es el de por defecto.
    for (const p of lista.filter((x) => x.id <= 3)) expect(p.deletable).toBe(false);
  });

  it('borra para siempre un plan sin uso, deja de ofrecerse y queda en el registro de actividad', async () => {
    const id = await nuevo('Para borrar');
    const res = await marta.delete(ruta(id)).send({});
    expect(res.status).toBe(204);
    expect(await plan(id)).toBeUndefined();
    expect((await publicos()).some((p) => p.id === id)).toBe(false);
    const { rows } = await t.pool.query(
      "SELECT action, details FROM activity_logs WHERE table_name = 'adoption_plans' AND record_id = $1",
      [id],
    );
    expect(rows).toEqual([
      { action: 'create', details: expect.anything() },
      { action: 'delete', details: { name: 'Para borrar', monthlyAmount: '3.00' } },
    ]);
  });

  it('un plan con adopciones, pagos o historial no se borra (409): se desactiva', async () => {
    for (const id of [1, 3]) {
      const res = await marta.delete(ruta(id)).send({});
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('PLAN_HAS_HISTORY');
      expect(await plan(id)).toBeDefined();
    }
  });

  it('el plan por defecto no se borra (422), aunque no se haya usado', async () => {
    const id = await nuevo('Nuevo por defecto', { isDefault: true });
    expect((await planes()).find((p) => p.id === id)?.deletable).toBe(false);
    const res = await marta.delete(ruta(id)).send({});
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('DEFAULT_PLAN_CANNOT_BE_DELETED');
    expect(await plan(id)).toBeDefined();
  });

  it('un plan que no existe responde 404 y un id no válido, 400', async () => {
    expect((await marta.delete(ruta(9999)).send({})).status).toBe(404);
    expect((await marta.delete('/api/admin/plans/abc').send({})).status).toBe(400);
  });
});
