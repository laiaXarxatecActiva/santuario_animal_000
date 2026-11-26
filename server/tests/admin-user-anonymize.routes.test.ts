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

const ruta = (id: number) => `/api/admin/users/${id}/anonymize`;

describe('CU-76 Anonimizar una cuenta desde el panel', () => {
  it('solo el administrador: sin sesión 401; cuidadora y adoptante 403', async () => {
    expect((await request(t.app).post(ruta(13)).send({})).status).toBe(401);
    for (const agente of [await entrarComo(t.app, 'nuria'), await entrarComo(t.app, 'lucia')]) {
      expect((await agente.post(ruta(13)).send({})).status).toBe(403);
    }
    const { rows } = await t.pool.query('SELECT anonymized_at FROM users WHERE id = 13');
    expect(rows[0].anonymized_at).toBeNull();
  });

  it('adoptante: borra sus datos personales, cierra adopciones y sesiones y conserva los pagos', async () => {
    const lucia = await entrarComo(t.app, 'lucia');
    const pagosAntes = (
      await t.pool.query('SELECT 1 FROM payments p JOIN adoptions a ON a.id = p.adoption_id WHERE a.user_id = 6')
    ).rowCount;

    const res = await marta.post(ruta(6)).send({});
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('anonymized');
    expect(res.body.email).toBe('deleted-6@anonymized.invalid');
    expect(res.body.phone).toBeNull();

    const abiertas = await t.pool.query(
      "SELECT 1 FROM adoptions WHERE user_id = 6 AND status IN ('pending', 'active', 'paused')",
    );
    expect(abiertas.rowCount).toBe(0);
    const pagos = await t.pool.query(
      'SELECT 1 FROM payments p JOIN adoptions a ON a.id = p.adoption_id WHERE a.user_id = 6',
    );
    expect(pagos.rowCount).toBe(pagosAntes);
    expect((await lucia.get('/api/me/profile')).status).toBe(401);
    expect((await request(t.app).post('/api/auth/login').send(USUARIOS.lucia)).status).toBe(401);
  });

  it('trabajador: se anonimiza y pierde sus turnos futuros; queda en el registro con el motivo', async () => {
    const res = await marta.post(ruta(4)).send({ reason: 'Ya no trabaja aquí.' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('anonymized');
    const turnos = await t.pool.query(
      'SELECT 1 FROM shift_assignments WHERE user_id = 4 AND shift_date > CURRENT_DATE AND checked_in_at IS NULL',
    );
    expect(turnos.rowCount).toBe(0);
    const { rows } = await t.pool.query(
      `SELECT user_id, action, details FROM activity_logs
        WHERE table_name = 'users' AND record_id = 4 ORDER BY id DESC LIMIT 1`,
    );
    expect(rows[0]).toEqual({
      user_id: 1,
      action: 'update',
      details: { anonymized: true, reason: 'Ya no trabaja aquí.' },
    });
  });

  it('no se puede anonimizar la propia cuenta ni una ya anonimizada', async () => {
    const propia = await marta.post(ruta(1)).send({});
    expect(propia.status).toBe(422);
    expect(propia.body.error.code).toBe('CANNOT_DELETE_SELF');
    const repetida = await marta.post(ruta(15)).send({});
    expect(repetida.status).toBe(422);
    expect(repetida.body.error.code).toBe('ALREADY_ANONYMIZED');
  });

  it('un usuario que no existe responde 404', async () => {
    expect((await marta.post(ruta(9999)).send({})).status).toBe(404);
  });
});
