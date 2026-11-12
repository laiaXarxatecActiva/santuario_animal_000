import type { FeedResponse } from '@sanctuary/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prepararApp, type TestApp } from './helpers/test-app.js';

let t: TestApp;
beforeAll(async () => {
  t = await prepararApp();
});
afterAll(() => t.pool.end());

type Agent = ReturnType<typeof request.agent>;
const sesiones = new Map<string, Agent>();
const CLAVES: Record<string, string> = {
  'lucia.martinez@correo.test': 'Lucia.buitres1',
  'elena.rubio@correo.test': 'elenita_88',
  'adrian.moreno@correo.test': 'Adrian_99',
  'nuria.peris@santuario.test': 'NuriaPeris26#!',
};

async function como(email: string): Promise<Agent> {
  const existente = sesiones.get(email);
  if (existente) return existente;
  const agent = request.agent(t.app);
  const res = await agent.post('/api/auth/login').send({ email, password: CLAVES[email] });
  expect(res.status).toBe(200);
  sesiones.set(email, agent);
  return agent;
}

const muro = async (email: string, query: Record<string, string | number> = {}) => {
  const res = await (await como(email)).get('/api/me/feed').query(query);
  expect(res.status).toBe(200);
  return res.body as FeedResponse;
};

describe('CU-17 Consultar el muro de actualizaciones', () => {
  it('2: lista las actualizaciones de los animales con adopción activa, las más recientes primero', async () => {
    const res = await muro('lucia.martinez@correo.test');
    expect(res.data.map((u) => [u.id, u.animal.name, u.isRead])).toEqual([
      [2, 'Rufo', true],
      [14, 'Carbón', false],
      [4, 'Sombra', true],
      [3, 'Sombra', true],
      [1, 'Rufo', true],
    ]);
    expect(res.meta).toEqual({ page: 1, pageSize: 20, total: 5, totalPages: 1, unreadCount: 1 });
  });

  it('2: incluye las fotos exclusivas de cada actualización', async () => {
    const res = await muro('lucia.martinez@correo.test');
    const revision = res.data.find((u) => u.id === 2);
    expect(revision?.photos.map((p) => [p.id, p.visibility])).toEqual([[19, 'adopters']]);
    expect(revision?.animal).toMatchObject({ id: 1, name: 'Rufo', coverPhoto: { id: 1 } });
  });

  it('3: filtra por no leídas y por animal', async () => {
    expect((await muro('lucia.martinez@correo.test', { unread: 'true' })).data.map((u) => u.id)).toEqual([14]);
    expect((await muro('lucia.martinez@correo.test', { animalId: 8 })).data.map((u) => u.id)).toEqual([4, 3]);
  });

  it('pagina el muro; el contador de no leídas no depende de la página', async () => {
    const res = await muro('lucia.martinez@correo.test', { page: 2, pageSize: 2 });
    expect(res.data.map((u) => u.id)).toEqual([4, 3]);
    expect(res.meta).toMatchObject({ page: 2, total: 5, totalPages: 3, unreadCount: 1 });
  });

  it('RN-15: una adopción pausada no muestra actualizaciones (Elena con Lupe)', async () => {
    const res = await muro('elena.rubio@correo.test');
    expect(res.data.map((u) => u.animal.name)).toEqual(['Greta', 'Greta']);
  });

  it('2a: sin adopciones activas el muro está vacío', async () => {
    const res = await muro('adrian.moreno@correo.test');
    expect(res.data).toEqual([]);
    expect(res.meta).toMatchObject({ total: 0, unreadCount: 0 });
  });

  it('4: marca como leída y como no leída, y el contador se actualiza', async () => {
    const lucia = await como('lucia.martinez@correo.test');
    expect((await lucia.put('/api/me/feed/14/read').send({})).status).toBe(204);
    expect((await lucia.put('/api/me/feed/14/read').send({})).status).toBe(204);
    expect((await muro('lucia.martinez@correo.test')).meta.unreadCount).toBe(0);

    expect((await lucia.delete('/api/me/feed/14/read').send({})).status).toBe(204);
    const res = await muro('lucia.martinez@correo.test');
    expect(res.meta.unreadCount).toBe(1);
    expect(res.data.find((u) => u.id === 14)?.isRead).toBe(false);
  });

  it('4: una actualización de un animal sin adopción activa no existe (404)', async () => {
    const elena = await como('elena.rubio@correo.test');
    expect((await elena.put('/api/me/feed/7/read').send({})).status).toBe(404); // Lupe, pausada
    expect((await elena.put('/api/me/feed/9999/read').send({})).status).toBe(404);
    expect((await elena.delete('/api/me/feed/2/read').send({})).status).toBe(404); // Rufo, no lo adopta
  });

  it('sin sesión 401, trabajadores 403 y filtros no válidos 400', async () => {
    expect((await request(t.app).get('/api/me/feed')).status).toBe(401);
    expect((await request(t.app).put('/api/me/feed/1/read').send({})).status).toBe(401);
    const nuria = await como('nuria.peris@santuario.test');
    expect((await nuria.get('/api/me/feed')).status).toBe(403);
    expect((await nuria.put('/api/me/feed/1/read').send({})).status).toBe(403);
    const lucia = await como('lucia.martinez@correo.test');
    expect((await lucia.get('/api/me/feed').query({ unread: 'quizas' })).status).toBe(400);
    expect((await lucia.put('/api/me/feed/abc/read').send({})).status).toBe(400);
  });
});
