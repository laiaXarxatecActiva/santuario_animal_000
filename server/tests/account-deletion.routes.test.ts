import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { entrarComo, USUARIOS } from './helpers/sesion.js';
import { prepararApp, type TestApp } from './helpers/test-app.js';

let t: TestApp;
beforeAll(async () => {
  t = await prepararApp();
});
afterAll(() => t.pool.end());

const borrar = (agente: ReturnType<typeof request.agent>, password: unknown) =>
  agente.delete('/api/me').send({ password });

const cuenta = async (tabla: string, userId: number) =>
  (await t.pool.query(`SELECT count(*)::int AS n FROM ${tabla} WHERE user_id = $1`, [userId])).rows[0].n as number;

describe('CU-25 Eliminar la cuenta', () => {
  it('sin sesión es 401; 1a: un trabajador no puede (403)', async () => {
    expect((await request(t.app).delete('/api/me').send({ password: 'x' })).status).toBe(401);
    const nuria = await entrarComo(t.app, 'nuria');
    const res = await borrar(nuria, USUARIOS.nuria.password);
    expect(res.status).toBe(403);
    const { rows } = await t.pool.query('SELECT anonymized_at FROM users WHERE id = 3');
    expect(rows[0].anonymized_at).toBeNull();
  });

  it('3: la contraseña es obligatoria', async () => {
    const lucia = await entrarComo(t.app, 'lucia');
    const res = await borrar(lucia, '');
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ field: 'password', message: 'Escribe tu contraseña.' }]);
  });

  it('3a: con la contraseña incorrecta no se elimina nada', async () => {
    const lucia = await entrarComo(t.app, 'lucia');
    const res = await borrar(lucia, 'no-es-esta');
    expect(res.status).toBe(422);
    expect(res.body.error).toMatchObject({
      code: 'INVALID_PASSWORD',
      details: [{ field: 'password', message: 'La contraseña no es correcta.' }],
    });
    const { rows } = await t.pool.query('SELECT email, is_active FROM users WHERE id = 6');
    expect(rows[0]).toEqual({ email: 'lucia.martinez@correo.test', is_active: true });
    expect((await lucia.get('/api/auth/me')).body.user).toMatchObject({ id: 6 });
  });

  it('4-5: anonimiza, cierra las adopciones, vacía las donaciones, borra lo personal y cierra todas las sesiones', async () => {
    const pagosAntes = (
      await t.pool.query(
        'SELECT count(*)::int AS n, sum(amount)::text AS total FROM payments WHERE adoption_id IN (SELECT id FROM adoptions WHERE user_id = 6)',
      )
    ).rows[0];
    await t.pool.query(
      "INSERT INTO user_tokens (user_id, type, token_hash, expires_at) VALUES (6, 'password_reset', repeat('a', 64), NOW() + INTERVAL '1 hour')",
    );
    const otraSesion = await entrarComo(t.app, 'lucia');
    const lucia = await entrarComo(t.app, 'lucia');

    const res = await borrar(lucia, USUARIOS.lucia.password);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Tu cuenta se ha eliminado.' });
    expect(String(res.headers['set-cookie'])).toMatch(/sid=;/);

    // 4.2 Anonimización (TECH_SPEC §13).
    const { rows: usuario } = await t.pool.query(
      `SELECT first_name, last_name, email, phone, is_active, show_public_name, email_notifications,
              anonymized_at IS NOT NULL AS anonimizado, last_login_at
         FROM users WHERE id = 6`,
    );
    expect(usuario[0]).toEqual({
      first_name: 'Usuario',
      last_name: 'eliminado',
      email: 'deleted-6@anonymized.invalid',
      phone: null,
      is_active: false,
      show_public_name: false,
      email_notifications: false,
      anonimizado: true,
      last_login_at: null,
    });

    // 4.1 Las abiertas (Rufo, Sombra y Carbón, activas) terminan hoy; la que ya estaba cerrada no cambia.
    const { rows: adopciones } = await t.pool.query(
      `SELECT id, status, end_reason, end_date::text, next_billing_date FROM adoptions WHERE user_id = 6 ORDER BY id`,
    );
    expect(adopciones).toEqual([
      { id: 1, status: 'finished', end_reason: 'account_deleted', end_date: t.hoy, next_billing_date: null },
      { id: 2, status: 'finished', end_reason: 'account_deleted', end_date: t.hoy, next_billing_date: null },
      expect.objectContaining({ id: 3, status: 'finished' }),
      { id: 18, status: 'finished', end_reason: 'account_deleted', end_date: t.hoy, next_billing_date: null },
    ]);
    expect(adopciones[2].end_reason).not.toBe('account_deleted');

    // 4.3 Donaciones sin nombre ni email; se conservan los importes.
    const { rows: donaciones } = await t.pool.query(
      'SELECT id, donor_name, donor_email, amount::text FROM donations WHERE user_id = 6 ORDER BY id',
    );
    expect(donaciones).toEqual([
      { id: 1, donor_name: null, donor_email: null, amount: '20.00' },
      { id: 12, donor_name: null, donor_email: null, amount: '10.00' },
    ]);
    const pagosDespues = (
      await t.pool.query(
        'SELECT count(*)::int AS n, sum(amount)::text AS total FROM payments WHERE adoption_id IN (SELECT id FROM adoptions WHERE user_id = 6)',
      )
    ).rows[0];
    expect(pagosDespues).toEqual(pagosAntes);

    // 4.4 Notificaciones, lecturas, tokens y sesiones.
    for (const tabla of ['notifications', 'update_reads', 'user_tokens', 'user_sessions']) {
      expect(await cuenta(tabla, 6)).toBe(0);
    }
    expect((await otraSesion.get('/api/auth/me')).body.user).toBeNull();
    const entrar = await request(t.app).post('/api/auth/login').send(USUARIOS.lucia);
    expect(entrar.status).not.toBe(200);
  });

  it('4.1: una pendiente pasa a cancelled; una activa, a finished', async () => {
    const irene = request.agent(t.app);
    await irene.post('/api/auth/login').send({ email: 'irene.dominguez@correo.test', password: 'Irene2025ok' });
    expect((await borrar(irene, 'Irene2025ok')).status).toBe(200);
    const { rows } = await t.pool.query(
      `SELECT id, status, end_reason FROM adoptions WHERE user_id = 10 AND end_reason = 'account_deleted' ORDER BY id`,
    );
    expect(rows).toEqual([
      { id: 10, status: 'finished', end_reason: 'account_deleted' },
      { id: 11, status: 'cancelled', end_reason: 'account_deleted' },
    ]);
  });
});
