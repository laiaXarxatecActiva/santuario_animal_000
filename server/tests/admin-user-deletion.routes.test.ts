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

const ruta = (id: number) => `/api/admin/users/${id}`;
const datosDe = (id: number) => `/api/admin/users/${id}/linked-data`;
const cuantos = async (sql: string, params: unknown[]) => (await t.pool.query(sql, params)).rowCount;
const existe = async (id: number) => (await cuantos('SELECT 1 FROM users WHERE id = $1', [id])) === 1;

/** Un trabajador recién creado (por ejemplo, por error): no tiene nada enlazado. */
async function nuevoTrabajador(email: string): Promise<number> {
  const res = await marta
    .post('/api/admin/users')
    .send({ firstName: 'Prueba', lastName: 'Por error', email, role: 'caretaker' });
  expect(res.status).toBe(201);
  return res.body.id as number;
}

describe('CU-75 Eliminar una cuenta desde el panel', () => {
  it('solo el administrador: sin sesión 401; cuidadora y adoptante 403, sin borrar nada', async () => {
    expect((await request(t.app).delete(ruta(13)).send({})).status).toBe(401);
    expect((await request(t.app).get(datosDe(13))).status).toBe(401);
    for (const agente of [await entrarComo(t.app, 'nuria'), await entrarComo(t.app, 'lucia')]) {
      expect((await agente.delete(ruta(13)).send({ force: true })).status).toBe(403);
      expect((await agente.get(datosDe(13))).status).toBe(403);
    }
    expect(await existe(13)).toBe(true);
  });

  it('2: muestra los datos enlazados; una cuenta sin nada da total 0', async () => {
    const id = await nuevoTrabajador('sin.datos@santuario.test');
    const vacia = await marta.get(datosDe(id));
    expect(vacia.status).toBe(200);
    expect(vacia.body.total).toBe(0);

    const lucia = await marta.get(datosDe(6));
    expect(lucia.status).toBe(200);
    expect(lucia.body.adoptions).toBeGreaterThan(0);
    expect(lucia.body.payments).toBeGreaterThan(0);
    expect(lucia.body.total).toBeGreaterThan(0);
  });

  it('3: una cuenta sin datos enlazados se borra del todo y queda en el registro de actividad', async () => {
    const id = await nuevoTrabajador('creado.por.error@santuario.test');
    const res = await marta.delete(ruta(id)).send({ reason: '  Creado por error.  ' });
    expect(res.status).toBe(204);
    expect(await existe(id)).toBe(false);
    expect((await marta.get(ruta(id))).status).toBe(404);

    const { rows } = await t.pool.query(
      `SELECT user_id, action, details FROM activity_logs
        WHERE table_name = 'users' AND record_id = $1 AND action = 'delete'`,
      [id],
    );
    expect(rows).toEqual([{ user_id: 1, action: 'delete', details: { reason: 'Creado por error.' } }]);
  });

  it('el motivo es opcional, pero no puede pasar de 500 caracteres', async () => {
    const id = await nuevoTrabajador('sin.motivo@santuario.test');
    const largo = await marta.delete(ruta(id)).send({ reason: 'x'.repeat(501) });
    expect(largo.status).toBe(400);
    expect(largo.body.error.code).toBe('VALIDATION_ERROR');
    expect(await existe(id)).toBe(true);
    expect((await marta.delete(ruta(id)).send({})).status).toBe(204);
    expect(await existe(id)).toBe(false);
  });

  it('3a: con datos enlazados y sin forzar responde 409 y no borra nada', async () => {
    const res = await marta.delete(ruta(6)).send({});
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ACCOUNT_HAS_DATA');
    expect(await existe(6)).toBe(true);
    expect(await cuantos('SELECT 1 FROM adoptions WHERE user_id = 6', [])).toBeGreaterThan(0);
  });

  it('3b: forzado, borra al adoptante con sus adopciones, pagos y donaciones, y cierra sus sesiones', async () => {
    const lucia = await entrarComo(t.app, 'lucia');
    const res = await marta.delete(ruta(6)).send({ force: true, reason: 'Lo pide por escrito.' });
    expect(res.status).toBe(204);
    expect(await existe(6)).toBe(false);
    expect(await cuantos('SELECT 1 FROM adoptions WHERE user_id = 6', [])).toBe(0);
    expect(await cuantos('SELECT 1 FROM donations WHERE user_id = 6', [])).toBe(0);
    expect(await cuantos('SELECT 1 FROM user_sessions WHERE user_id = 6', [])).toBe(0);
    expect((await lucia.get('/api/me/profile')).status).toBe(401);
    expect((await request(t.app).post('/api/auth/login').send(USUARIOS.lucia)).status).toBe(401);
  });

  it('3b: forzado, borra a una cuidadora con su trabajo; lo que es del santuario se queda sin autor', async () => {
    const antes = await marta.get(datosDe(3));
    expect(antes.body.total).toBeGreaterThan(0);
    const res = await marta.delete(ruta(3)).send({ force: true });
    expect(res.status).toBe(204);
    expect(await existe(3)).toBe(false);
    expect(await cuantos('SELECT 1 FROM incidents WHERE reported_by = 3 OR resolved_by = 3', [])).toBe(0);
    expect(await cuantos('SELECT 1 FROM handover_notes WHERE author_id = 3', [])).toBe(0);
    expect(await cuantos('SELECT 1 FROM task_instances WHERE resolved_by = 3 OR assigned_to = 3', [])).toBe(0);
    expect(await cuantos('SELECT 1 FROM activity_logs WHERE user_id = 3', [])).toBe(0);
    // Los animales siguen teniendo su historial veterinario.
    expect(await cuantos('SELECT 1 FROM vet_records', [])).toBeGreaterThan(0);
  });

  it('una cuenta ya anonimizada también se puede borrar del todo (forzando, si conserva pagos)', async () => {
    expect((await marta.delete(ruta(15)).send({})).status).toBe(409);
    expect((await marta.delete(ruta(15)).send({ force: true })).status).toBe(204);
    expect(await existe(15)).toBe(false);
  });

  it('1a: el administrador no puede borrar su propia cuenta', async () => {
    const res = await marta.delete(ruta(1)).send({ force: true });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('CANNOT_DELETE_SELF');
    expect(await existe(1)).toBe(true);
  });

  it('un usuario que no existe responde 404', async () => {
    expect((await marta.delete(ruta(9999)).send({})).status).toBe(404);
    expect((await marta.get(datosDe(9999))).status).toBe(404);
  });
});
