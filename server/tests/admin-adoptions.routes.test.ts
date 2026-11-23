import type { AdminAdoptionDetailDto, AdminAdoptionListItemDto } from '@sanctuary/shared';
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

const listar = async (query: Record<string, string | number> = {}) => {
  const res = await marta.get('/api/admin/adoptions').query({ pageSize: 100, ...query });
  expect(res.status).toBe(200);
  return res.body as { data: AdminAdoptionListItemDto[]; meta: { total: number } };
};
const ids = async (query: Record<string, string | number>) =>
  (await listar(query)).data.map((a) => a.id).sort((a, b) => a - b);
const ficha = async (id: number): Promise<AdminAdoptionDetailDto> => {
  const res = await marta.get(`/api/admin/adoptions/${id}`);
  expect(res.status).toBe(200);
  return res.body;
};
const accion = (id: number, body: object) => marta.patch(`/api/admin/adoptions/${id}/status`).send(body);
const notificaciones = async (userId: number) =>
  (
    await t.pool.query<{ type: string; message: string }>(
      'SELECT type, message FROM notifications WHERE user_id = $1 ORDER BY id DESC',
      [userId],
    )
  ).rows;
const emailsA = (to: string) => t.mailer.outbox.filter((m) => m.to === to);

describe('CU-37 Gestionar adopciones: acceso', () => {
  it('solo el administrador: sin sesión 401; cuidadora y adoptante 403', async () => {
    expect((await request(t.app).get('/api/admin/adoptions')).status).toBe(401);
    for (const quien of ['nuria', 'lucia'] as const) {
      const agente = await entrarComo(t.app, quien);
      expect((await agente.get('/api/admin/adoptions')).status).toBe(403);
      expect((await agente.get('/api/admin/adoptions/1')).status).toBe(403);
      expect((await agente.post('/api/admin/adoptions').send({})).status).toBe(403);
      expect((await agente.patch('/api/admin/adoptions/1/status').send({ action: 'resume' })).status).toBe(403);
    }
  });
});

describe('CU-37 Gestionar adopciones: consulta', () => {
  it('2: lista todas las adopciones con adoptante, animal, plan y fechas', async () => {
    const { data, meta } = await listar();
    expect(meta.total).toBe(20);
    expect(data.find((a) => a.id === 14)).toEqual({
      id: 14,
      adopter: { id: 12, firstName: 'Raquel', lastName: 'Font Escrivà', email: 'raquel.font@correo.test' },
      animal: { id: 9, name: 'Ébano' },
      plan: { id: 3, name: 'Extraordinaria', monthlyAmount: '12.00' },
      status: 'active',
      startDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      endDate: null,
      nextBillingDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      cancelRequested: false,
      createdAt: expect.any(String),
    });
  });

  it('2: por defecto, las más recientes primero; el orden pasa por una lista blanca', async () => {
    expect((await listar()).data[0]?.id).toBe(11);
    expect((await marta.get('/api/admin/adoptions').query({ sort: 'user_id; DROP TABLE x' })).status).toBe(400);
  });

  it('2: filtra por estado, plan, animal y adoptante', async () => {
    expect(await ids({ status: 'paused' })).toEqual([7]);
    expect(await ids({ status: 'pending' })).toEqual([11, 12]);
    expect(await ids({ planId: 3 })).toEqual([2, 9, 14]);
    expect(await ids({ animalId: 1 })).toEqual([1, 4, 15]);
    expect(await ids({ userId: 6 })).toEqual([1, 2, 3, 18]);
    expect(await ids({ status: 'active', userId: 6 })).toEqual([1, 2, 18]);
  });

  it('2: busca por adoptante (nombre o email) o por animal, sin tildes ni mayúsculas', async () => {
    expect(await ids({ q: 'raquel' })).toEqual([14, 15]);
    expect(await ids({ q: 'HECTOR.BENET' })).toEqual([12, 13]);
    expect(await ids({ q: 'ebano' })).toEqual([14]);
  });

  it('2: pagina los resultados', async () => {
    const res = await marta.get('/api/admin/adoptions').query({ pageSize: 5, page: 2 });
    expect(res.body.data).toHaveLength(5);
    expect(res.body.meta).toEqual({ page: 2, pageSize: 5, total: 20, totalPages: 4 });
  });

  it('3: la ficha incluye las notas internas, quién la creó y los pagos (los más recientes primero)', async () => {
    const adopcion = await ficha(14);
    expect(adopcion.notes).toBe('Alta en la jornada de puertas abiertas; primera cuota pagada en efectivo.');
    expect(adopcion.createdBy).toEqual({ id: 1, name: 'Marta Soler Ferrer' });
    expect(adopcion.endReason).toBeNull();
    expect(adopcion.payments).toHaveLength(2);
    expect(adopcion.payments[0]?.method).toBe('simulated');
    expect(adopcion.payments[1]).toEqual({
      id: expect.any(Number),
      amount: '12.00',
      periodStart: adopcion.startDate,
      periodEnd: expect.any(String),
      method: 'cash',
      status: 'completed',
      reference: 'CASH-A0014-' + (adopcion.startDate ?? '').replaceAll('-', ''),
      paidAt: expect.any(String),
      refundedAt: null,
      failureReason: null,
      recordedBy: { id: 1, name: 'Marta Soler Ferrer' },
    });
  });

  it('3: una adopción que no existe es 404', async () => {
    expect((await marta.get('/api/admin/adoptions/999')).status).toBe(404);
  });
});

describe('CU-37 Gestionar adopciones: alta manual', () => {
  const alta = (body: object) => marta.post('/api/admin/adoptions').send(body);
  const base = { userId: 13, animalId: 5, planId: 2, method: 'cash' };

  it('3-4: crea la adopción activa con su primer pago cobrado y avisa al adoptante', async () => {
    const res = await alta({ ...base, notes: '  Pagó en la caseta de la entrada.  ' });
    expect(res.status).toBe(201);
    const adopcion = res.body as AdminAdoptionDetailDto;
    expect(adopcion).toMatchObject({
      adopter: { id: 13 },
      animal: { id: 5, name: 'Brisa' },
      plan: { id: 2 },
      status: 'active',
      startDate: t.hoy,
      nextBillingDate: sumarMeses(t.hoy, 1),
      createdBy: { id: 1, name: 'Marta Soler Ferrer' },
    });
    expect(adopcion.notes).toMatch(
      /^\d{2}\/\d{2}\/\d{4} · Alta manual · Marta Soler Ferrer: Pagó en la caseta de la entrada\.$/,
    );
    expect(adopcion.payments).toEqual([
      expect.objectContaining({
        amount: '5.00',
        periodStart: t.hoy,
        method: 'cash',
        status: 'completed',
        reference: expect.stringMatching(/^CASH-/),
        recordedBy: { id: 1, name: 'Marta Soler Ferrer' },
      }),
    ]);

    expect((await notificaciones(13))[0]).toMatchObject({ type: 'adoption_welcome' });
    const [email] = emailsA('adrian.moreno@correo.test');
    expect(email?.subject).toBe('¡Ya adoptas a Brisa!');
  });

  it('una transferencia lleva su propia referencia y las notas son opcionales', async () => {
    const res = await alta({ userId: 12, animalId: 6, planId: 1, method: 'bank_transfer' });
    expect(res.status).toBe(201);
    expect(res.body.notes).toBeNull();
    expect(res.body.payments[0].reference).toMatch(/^TRF-/);
  });

  it('2a: un trabajador no puede adoptar (RN-03)', async () => {
    const res = await alta({ ...base, userId: 3 });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('WORKER_CANNOT_ADOPT');
  });

  it('2a: la cuenta debe existir y estar activa', async () => {
    for (const userId of [14, 15, 999]) {
      const res = await alta({ ...base, userId });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('ADOPTER_NOT_AVAILABLE');
    }
  });

  it('2a: ya tiene una adopción abierta de ese animal (RN-05)', async () => {
    const res = await alta({ ...base, userId: 6, animalId: 1 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ADOPTION_ALREADY_OPEN');
  });

  it('2a: el animal debe admitir adopciones (RN-06)', async () => {
    // Fallecido: ya no se muestra en la web, como en CU-13.
    expect((await alta({ ...base, animalId: 12 })).body.error.code).toBe('ANIMAL_NOT_AVAILABLE');
    expect((await alta({ ...base, animalId: 15 })).body.error.code).toBe('ANIMAL_NOT_ADOPTABLE');
    expect((await alta({ ...base, animalId: 14 })).body.error.code).toBe('ANIMAL_NOT_AVAILABLE');
  });

  it('el plan debe estar disponible y el método ser efectivo o transferencia', async () => {
    expect((await alta({ ...base, planId: 999 })).body.error.code).toBe('PLAN_NOT_AVAILABLE');
    const res = await alta({ ...base, method: 'simulated' });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([expect.objectContaining({ field: 'method' })]);
  });
});

describe('CU-37 Gestionar adopciones: pausar, reanudar y cancelar', () => {
  it('A1: pausa una activa con nota obligatoria, la añade a las notas y avisa al adoptante', async () => {
    const antes = await ficha(4);
    const res = await accion(4, { action: 'pause', notes: 'Lo pidió por teléfono.' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 4, status: 'paused', nextBillingDate: antes.nextBillingDate });
    expect(res.body.notes).toMatch(/· Pausa · Marta Soler Ferrer: Lo pidió por teléfono\.$/);
    expect((await notificaciones(7))[0]?.message).toContain('pausado');
    expect(emailsA('pablo.garcia@correo.test')).toHaveLength(1);
    // La nota interna nunca llega al adoptante.
    expect(JSON.stringify(t.mailer.outbox)).not.toContain('teléfono');
    expect(JSON.stringify(await notificaciones(7))).not.toContain('teléfono');
  });

  it('A2: reanuda una pausada sin cambiar la fecha del próximo cobro; la nota es opcional', async () => {
    const antes = await ficha(4);
    const res = await accion(4, { action: 'resume' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'active', nextBillingDate: antes.nextBillingDate, notes: antes.notes });
    expect((await notificaciones(7))[0]?.message).toContain('reanudado');
    expect(emailsA('pablo.garcia@correo.test')).toHaveLength(1);
  });

  it('A1 y A3: sin nota, error en el campo', async () => {
    for (const action of ['pause', 'cancel']) {
      const res = await accion(1, { action, notes: '   ' });
      expect(res.status).toBe(400);
      expect(res.body.error.details).toEqual([{ field: 'notes', message: 'Escribe el motivo.' }]);
    }
  });

  it('A3: cancela una abierta: termina hoy con admin_cancelled, sin más cobros', async () => {
    const res = await accion(10, { action: 'cancel', notes: 'Duplicada.' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'cancelled',
      endReason: 'admin_cancelled',
      endDate: t.hoy,
      nextBillingDate: null,
    });
    expect((await notificaciones(10))[0]).toMatchObject({ type: 'adoption_cancelled' });
    expect(emailsA('irene.dominguez@correo.test')).toHaveLength(1);
  });

  it('A3: también una pendiente y una con la baja ya solicitada', async () => {
    expect((await accion(11, { action: 'cancel', notes: 'No va a pagar.' })).body.status).toBe('cancelled');
    expect((await accion(9, { action: 'cancel', notes: 'Adelanta la baja.' })).body.status).toBe('cancelled');
  });

  it('acciones que no corresponden al estado: 422', async () => {
    const casos = [
      { id: 12, body: { action: 'pause', notes: 'x' } }, // pendiente
      { id: 1, body: { action: 'resume' } }, // activa
      { id: 13, body: { action: 'cancel', notes: 'x' } }, // ya cancelada
      { id: 3, body: { action: 'cancel', notes: 'x' } }, // finalizada
    ];
    for (const { id, body } of casos) {
      const res = await accion(id, body);
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('ADOPTION_ACTION_NOT_ALLOWED');
    }
  });

  it('una adopción que no existe es 404; una acción desconocida, 400', async () => {
    expect((await accion(999, { action: 'cancel', notes: 'x' })).status).toBe(404);
    expect((await accion(1, { action: 'delete' })).status).toBe(400);
  });
});

describe('CU-37 y CU-49 La ficha del panel muestra la forma de pago', () => {
  it('automática por defecto; manual si el adoptante la eligió', async () => {
    expect((await ficha(14)).paymentMode).toBe('automatic');
    await t.pool.query("UPDATE adoptions SET payment_mode = 'manual' WHERE id = 14");
    expect((await ficha(14)).paymentMode).toBe('manual');
    await t.pool.query("UPDATE adoptions SET payment_mode = 'automatic' WHERE id = 14");
  });
});
