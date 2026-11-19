import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { entrarComo, USUARIOS, type Agente } from './helpers/sesion.js';
import { prepararApp, type TestApp } from './helpers/test-app.js';

let t: TestApp;
let marta: Agente;
beforeAll(async () => {
  t = await prepararApp();
  marta = await entrarComo(t.app, 'marta');
});
afterAll(() => t.pool.end());

const ruta = (id: number) => `/api/admin/users/${id}/logout-all`;
const MOTIVO = 'Lucía avisa por teléfono de que le han robado el móvil.';
const sesionesDe = async (userId: number) =>
  (await t.pool.query('SELECT 1 FROM user_sessions WHERE user_id = $1', [userId])).rowCount;
const conSesion = async (agente: Agente) => (await agente.get('/api/me/profile')).status;

describe('CU-48 Cerrar todas las sesiones de un usuario', () => {
  it('solo el administrador: sin sesión 401; cuidadora y adoptante 403, sin cerrar nada', async () => {
    const lucia = await entrarComo(t.app, 'lucia');
    expect((await request(t.app).post(ruta(6)).send({ reason: MOTIVO })).status).toBe(401);
    for (const agente of [await entrarComo(t.app, 'nuria'), lucia]) {
      const res = await agente.post(ruta(6)).send({ reason: MOTIVO });
      expect(res.status).toBe(403);
    }
    expect(await conSesion(lucia)).toBe(200);
  });

  it('1-3: cierra todas las sesiones del usuario y dice cuántas, sin tocar las de los demás', async () => {
    await t.pool.query('DELETE FROM user_sessions WHERE user_id = 6');
    const movil = await entrarComo(t.app, 'lucia');
    const portatil = await entrarComo(t.app, 'lucia');
    const nuria = await entrarComo(t.app, 'nuria');

    const res = await marta.post(ruta(6)).send({ reason: MOTIVO });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ closedSessions: 2 });
    expect(await sesionesDe(6)).toBe(0);
    expect(await conSesion(movil)).toBe(401);
    expect(await conSesion(portatil)).toBe(401);
    expect(await conSesion(nuria)).toBe(200);
    expect(await conSesion(marta)).toBe(200);

    // Puede volver a entrar con su contraseña: la cuenta sigue activa.
    expect((await request(t.app).post('/api/auth/login').send(USUARIOS.lucia)).status).toBe(200);
  });

  it('4: anota en el registro de actividad quién lo hizo, a quién, cuántas y el motivo', async () => {
    await entrarComo(t.app, 'andres');
    expect((await marta.post(ruta(4)).send({ reason: '  Revisión de seguridad.  ' })).status).toBe(200);
    const { rows } = await t.pool.query(
      `SELECT user_id, action, details FROM activity_logs
        WHERE table_name = 'users' AND record_id = 4 ORDER BY id DESC LIMIT 1`,
    );
    expect(rows[0]).toEqual({
      user_id: 1,
      action: 'update',
      details: { sessionsClosed: 1, reason: 'Revisión de seguridad.' },
    });
  });

  it('2a: sin motivo responde 400 y no cierra nada', async () => {
    const lucia = await entrarComo(t.app, 'lucia');
    for (const body of [{}, { reason: '   ' }, { reason: 'x'.repeat(501) }]) {
      const res = await marta.post(ruta(6)).send(body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
    expect(await conSesion(lucia)).toBe(200);
  });

  it('1a: un usuario que no existe responde 404', async () => {
    const res = await marta.post(ruta(9999)).send({ reason: MOTIVO });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('1b: un usuario sin sesiones abiertas responde 0', async () => {
    const res = await marta.post(ruta(14)).send({ reason: MOTIVO });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ closedSessions: 0 });
  });

  it('3a: sobre su propia cuenta cierra las demás sesiones y mantiene la actual', async () => {
    await t.pool.query('DELETE FROM user_sessions WHERE user_id = 1');
    const actual = await entrarComo(t.app, 'marta');
    const otra = await entrarComo(t.app, 'marta');
    const res = await actual.post(ruta(1)).send({ reason: 'He entrado desde un ordenador público.' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ closedSessions: 1 });
    expect(await conSesion(actual)).toBe(200);
    expect(await conSesion(otra)).toBe(401);
    marta = actual;
  });
});
