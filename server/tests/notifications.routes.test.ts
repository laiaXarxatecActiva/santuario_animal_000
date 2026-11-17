import type { NotificationsResponse } from '@sanctuary/shared';
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

const listar = async (agente: Agente, query: Record<string, string | number> = {}) => {
  const res = await agente.get('/api/me/notifications').query(query);
  expect(res.status).toBe(200);
  return res.body as NotificationsResponse;
};

const idDe = async (userId: number, mensaje: string) => {
  const { rows } = await t.pool.query<{ id: number }>(
    'SELECT id FROM notifications WHERE user_id = $1 AND message LIKE $2',
    [userId, `${mensaje}%`],
  );
  return rows[0]?.id ?? 0;
};

describe('CU-18 Consultar las notificaciones', () => {
  it('sin sesión responde 401 en todas las rutas', async () => {
    const anonimo = request(t.app);
    expect((await anonimo.get('/api/me/notifications')).status).toBe(401);
    expect((await anonimo.patch('/api/me/notifications/1').send({ isRead: true })).status).toBe(401);
    expect((await anonimo.post('/api/me/notifications/read-all').send({})).status).toBe(401);
    expect((await anonimo.delete('/api/me/notifications/1').send({})).status).toBe(401);
  });

  it('2: lista las del usuario, las más recientes primero, con el número de no leídas', async () => {
    const res = await listar(lucia);
    expect(res.data.map((n) => [n.type, n.isRead])).toEqual([
      ['new_update', true],
      ['new_update', false],
      ['donation_thanks', true],
      ['adoption_welcome', true],
      ['adoption_closed', true],
    ]);
    expect(res.data[0]).toEqual({
      id: expect.any(Number),
      type: 'new_update',
      message: 'Nueva actualización de Rufo: «Revisión del ala: todo en orden».',
      link: '/my-animals/1',
      isRead: true,
      createdAt: expect.any(String),
    });
    expect(res.meta).toEqual({ page: 1, pageSize: 20, total: 5, totalPages: 1, unreadCount: 1 });
  });

  it('?unread=true solo devuelve las no leídas; la paginación funciona', async () => {
    const noLeidas = await listar(lucia, { unread: 'true' });
    expect(noLeidas.data.map((n) => n.message)).toEqual(['Nueva actualización de Carbón: «Carbón respira mejor».']);
    const pagina = await listar(lucia, { page: 2, pageSize: 2 });
    expect(pagina.data.map((n) => n.type)).toEqual(['donation_thanks', 'adoption_welcome']);
    expect(pagina.meta).toMatchObject({ page: 2, pageSize: 2, total: 5, totalPages: 3, unreadCount: 1 });
  });

  it('los trabajadores también tienen campana (CU-47)', async () => {
    const res = await listar(await entrarComo(t.app, 'nuria'));
    expect(res.data.map((n) => n.type)).toEqual(['update_reminder']);
    expect(res.meta.unreadCount).toBe(1);
  });

  it('3: marca una como leída y otra vez como no leída', async () => {
    const id = await idDe(6, 'Nueva actualización de Carbón');
    const leida = await lucia.patch(`/api/me/notifications/${id}`).send({ isRead: true });
    expect(leida.status).toBe(200);
    expect(leida.body).toMatchObject({ id, isRead: true });
    expect((await listar(lucia)).meta.unreadCount).toBe(0);

    const otraVez = await lucia.patch(`/api/me/notifications/${id}`).send({ isRead: false });
    expect(otraVez.body).toMatchObject({ id, isRead: false });
    expect((await listar(lucia)).meta.unreadCount).toBe(1);
  });

  it('una notificación de otra persona responde 404, también al borrarla', async () => {
    const ajena = await idDe(7, 'Nueva actualización de Greta');
    expect((await lucia.patch(`/api/me/notifications/${ajena}`).send({ isRead: true })).status).toBe(404);
    expect((await lucia.delete(`/api/me/notifications/${ajena}`).send({})).status).toBe(404);
    const { rows } = await t.pool.query('SELECT is_read FROM notifications WHERE id = $1', [ajena]);
    expect(rows).toEqual([{ is_read: false }]);
  });

  it('valida el cuerpo y el id', async () => {
    expect((await lucia.patch('/api/me/notifications/abc').send({ isRead: true })).status).toBe(400);
    expect((await lucia.patch('/api/me/notifications/1').send({ isRead: 'si' })).status).toBe(400);
    expect((await lucia.patch('/api/me/notifications/999999').send({ isRead: true })).status).toBe(404);
  });

  it('4: marca todas como leídas sin tocar las de otras personas', async () => {
    const res = await lucia.post('/api/me/notifications/read-all').send({});
    expect(res.status).toBe(204);
    expect((await listar(lucia)).meta.unreadCount).toBe(0);
    const { rows } = await t.pool.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM notifications WHERE user_id = 7 AND NOT is_read',
    );
    expect(rows[0]?.n).toBe(1);
  });

  it('4: borra una notificación propia', async () => {
    const id = await idDe(6, 'Gracias por tu donación');
    expect((await lucia.delete(`/api/me/notifications/${id}`).send({})).status).toBe(204);
    expect((await listar(lucia)).data.map((n) => n.id)).not.toContain(id);
    expect((await lucia.delete(`/api/me/notifications/${id}`).send({})).status).toBe(404);
  });

  it('2a: sin notificaciones devuelve una lista vacía', async () => {
    const adrian = request.agent(t.app);
    await adrian.post('/api/auth/login').send({ email: 'adrian.moreno@correo.test', password: 'Adrian_99' });
    const res = await listar(adrian);
    expect(res).toEqual({ data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0, unreadCount: 0 } });
  });
});
