import type { ActivityLogDto } from '@sanctuary/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { entrarComo, type Agente } from './helpers/sesion.js';
import { prepararApp, type TestApp } from './helpers/test-app.js';

let t: TestApp;
let marta: Agente;
let nuria: Agente;
beforeAll(async () => {
  t = await prepararApp();
  marta = await entrarComo(t.app, 'marta');
  nuria = await entrarComo(t.app, 'nuria');
});
afterAll(() => t.pool.end());

const listar = async (query = ''): Promise<ActivityLogDto[]> => {
  const res = await marta.get(`/api/admin/activity-logs${query}`);
  expect(res.status).toBe(200);
  return res.body.data;
};

/** Última entrada anotada sobre un registro. */
const ultimaDe = async (tableName: string, recordId: number) =>
  (await listar(`?tableName=${tableName}&pageSize=100`)).find((e) => e.recordId === recordId);

describe('CU-42 Consultar el registro de actividad', () => {
  it('solo el administrador: sin sesión 401; cuidadora y adoptante 403', async () => {
    expect((await request(t.app).get('/api/admin/activity-logs')).status).toBe(401);
    expect((await nuria.get('/api/admin/activity-logs')).status).toBe(403);
    expect((await (await entrarComo(t.app, 'lucia')).get('/api/admin/activity-logs')).status).toBe(403);
  });

  it('2: muestra quién hizo qué, sobre qué registro y cuándo, de más reciente a más antiguo', async () => {
    const res = await marta.get('/api/admin/activity-logs');
    expect(res.body.meta).toMatchObject({ page: 1, pageSize: 20, total: 8 });
    const lista: ActivityLogDto[] = res.body.data;
    const fechas = lista.map((e) => e.createdAt);
    expect(fechas).toEqual([...fechas].sort().reverse());
    expect(lista[0]).toMatchObject({
      user: { id: 3, name: 'Nuria Peris Gil' },
      action: 'create',
      tableName: 'animals',
      recordId: 14,
      details: { name: 'Pipa' },
    });
  });

  it('Notas: las acciones de las tareas automáticas aparecen sin usuario («Sistema»)', async () => {
    const sistema = await listar('?userId=system');
    expect(sistema).toHaveLength(1);
    expect(sistema[0]).toMatchObject({ user: null, tableName: 'adoptions', recordId: 7 });
  });

  it('2: filtra por usuario, tabla, acción y fechas', async () => {
    expect((await listar('?userId=2')).every((e) => e.user?.id === 2)).toBe(true);
    expect(await listar('?tableName=adoptions')).toHaveLength(3);
    expect(await listar('?action=create')).toHaveLength(3);
    expect(await listar(`?from=${t.hoy}`)).toHaveLength(0);
    expect((await marta.get('/api/admin/activity-logs?tableName=sessions')).status).toBe(400);
  });

  it('se anotan las escrituras del panel con su autor, sin contraseñas ni tokens', async () => {
    const creada = await nuria.post('/api/admin/species').send({ name: 'Pigargo' });
    expect(creada.status).toBe(201);
    expect(await ultimaDe('species', creada.body.id)).toMatchObject({
      user: { id: 3 },
      action: 'create',
      details: { name: 'Pigargo' },
    });

    expect((await nuria.put(`/api/admin/species/${creada.body.id}`).send({ name: 'Pigargo europeo' })).status).toBe(
      200,
    );
    expect(await ultimaDe('species', creada.body.id)).toMatchObject({ action: 'update', user: { id: 3 } });

    expect((await marta.delete(`/api/admin/species/${creada.body.id}`).send({})).status).toBe(204);
    expect(await ultimaDe('species', creada.body.id)).toMatchObject({ action: 'delete', user: { id: 1 } });

    const trabajador = await marta
      .post('/api/admin/users')
      .send({ firstName: 'Rosa', lastName: 'Vidal', email: 'rosa.vidal@santuario.test', role: 'caretaker' });
    expect(trabajador.status).toBe(201);
    const alta = await ultimaDe('users', trabajador.body.id);
    expect(alta).toMatchObject({ action: 'create', details: { role: 'caretaker' } });
    expect(JSON.stringify(alta?.details)).not.toMatch(/password|token/i);
  });

  it('un fallecimiento o traslado se anota como «archive»', async () => {
    const res = await nuria.patch('/api/admin/animals/14/status').send({ status: 'transferred' });
    expect(res.status).toBe(200);
    expect(await ultimaDe('animals', 14)).toMatchObject({
      action: 'archive',
      details: { status: ['in_treatment', 'transferred'] },
    });
  });

  it('las acciones del administrador sobre las adopciones se anotan con la acción', async () => {
    const { rows } = await t.pool.query<{ id: number }>(
      "SELECT id FROM adoptions WHERE status = 'active' AND cancel_requested_at IS NULL ORDER BY id LIMIT 1",
    );
    const id = rows[0]!.id;
    const res = await marta.patch(`/api/admin/adoptions/${id}/status`).send({ action: 'pause', notes: 'Prueba' });
    expect(res.status).toBe(200);
    expect(await ultimaDe('adoptions', id)).toMatchObject({
      user: { id: 1 },
      action: 'update',
      details: { status: ['active', 'paused'], action: 'pause' },
    });
  });

  it('una tarea lanzada a mano anota sus cambios como «Sistema»', async () => {
    const res = await marta.post('/api/admin/jobs/expire-pending/run').send({});
    expect(res.body.result.cancelled).toBe(1);
    expect(await ultimaDe('adoptions', 12)).toMatchObject({
      user: null,
      action: 'update',
      details: { status: ['pending', 'cancelled'], reason: 'payment_not_completed' },
    });
  });
});
