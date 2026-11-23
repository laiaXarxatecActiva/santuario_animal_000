import type { AdminUserDetailDto, AdminUserListItemDto } from '@sanctuary/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { hashToken } from '../src/utils/tokens.js';
import { entrarComo, type Agente } from './helpers/sesion.js';
import { prepararApp, TEST_CLIENT_URL, tokenDelEmail, type TestApp } from './helpers/test-app.js';

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
  const res = await marta.get('/api/admin/users').query(query);
  expect(res.status).toBe(200);
  return res.body as { data: AdminUserListItemDto[]; meta: { total: number } };
};
const ficha = async (id: number): Promise<AdminUserDetailDto> => (await marta.get(`/api/admin/users/${id}`)).body;
const sesionesDe = async (userId: number) =>
  (await t.pool.query('SELECT 1 FROM user_sessions WHERE user_id = $1', [userId])).rowCount;
const adopcion = async (id: number) =>
  (
    await t.pool.query(
      `SELECT status, end_reason, end_date::text, next_billing_date::text, cancel_requested_at
         FROM adoptions WHERE id = $1`,
      [id],
    )
  ).rows[0];

const entrar = async (email: string, password: string) => {
  const agente = request.agent(t.app);
  expect((await agente.post('/api/auth/login').send({ email, password })).status).toBe(200);
  return agente;
};

describe('CU-35 Gestionar usuarios', () => {
  it('solo el administrador: sin sesión 401; cuidadora y adoptante 403', async () => {
    expect((await request(t.app).get('/api/admin/users')).status).toBe(401);
    for (const quien of ['nuria', 'lucia'] as const) {
      const agente = await entrarComo(t.app, quien);
      expect((await agente.get('/api/admin/users')).status).toBe(403);
      expect((await agente.get('/api/admin/users/6')).status).toBe(403);
      expect((await agente.patch('/api/admin/users/6').send({ isActive: false })).status).toBe(403);
      expect((await agente.post('/api/admin/users').send({})).status).toBe(403);
      expect((await agente.post('/api/admin/users/4/invitation').send({})).status).toBe(403);
    }
  });

  it('2: lista los usuarios con su rol, estado, alta y último acceso, sin datos privados', async () => {
    const { data, meta } = await listar({ pageSize: 100 });
    expect(meta.total).toBe(15);
    const lucia = data.find((u) => u.id === 6);
    expect(lucia).toEqual({
      id: 6,
      firstName: 'Lucía',
      lastName: 'Martínez Navarro',
      email: 'lucia.martinez@correo.test',
      role: 'adopter',
      status: 'active',
      createdAt: expect.any(String),
      lastLoginAt: expect.any(String),
    });
    expect(JSON.stringify(data)).not.toContain('argon2');
  });

  it('2: busca por nombre o email (sin tildes ni mayúsculas) y filtra por rol y estado', async () => {
    expect((await listar({ q: 'lucia' })).data.map((u) => u.id)).toEqual([6]);
    expect((await listar({ q: 'SANTUARIO.TEST' })).meta.total).toBe(5);
    expect((await listar({ role: 'admin' })).data.map((u) => u.id).sort()).toEqual([1, 2]);
    expect((await listar({ status: 'inactive' })).data.map((u) => u.id)).toEqual([14]);
    expect((await listar({ status: 'anonymized' })).data.map((u) => u.id)).toEqual([15]);
  });

  it('2: ordena con una lista blanca y pagina', async () => {
    const pagina = await listar({ sort: 'name', pageSize: 2, page: 1 });
    expect(pagina.data).toHaveLength(2);
    expect(pagina.data[0]?.firstName).toBe('Adrián');
    expect((await marta.get('/api/admin/users').query({ sort: 'password_hash' })).status).toBe(400);
  });

  it('3: la ficha de un adoptante incluye sus adopciones, pagos y donaciones', async () => {
    const lucia = await ficha(6);
    expect(lucia).toMatchObject({
      id: 6,
      role: 'adopter',
      status: 'active',
      emailVerified: true,
      invitationPending: false,
    });
    expect(lucia.adoptions.map((a) => a.id).sort((a, b) => a - b)).toEqual([1, 2, 3, 18]);
    expect(lucia.adoptions.find((a) => a.id === 1)).toMatchObject({
      animal: { id: 1 },
      plan: { id: 2, name: 'Usual' },
      status: 'active',
    });
    expect(lucia.payments.length).toBeGreaterThan(0);
    expect(Array.isArray(lucia.donations)).toBe(true);
  });

  it('3: la ficha de un trabajador no lleva adopciones ni aportaciones; 404 si no existe', async () => {
    const nuria = await ficha(3);
    expect(nuria).toMatchObject({ id: 3, role: 'caretaker', adoptions: [], payments: [], donations: [] });
    expect((await marta.get('/api/admin/users/999')).status).toBe(404);
  });

  it('4-5: desactivar a un trabajador cierra sus sesiones; reactivarlo le deja entrar', async () => {
    const andres = await entrarComo(t.app, 'andres');
    expect(await sesionesDe(4)).toBeGreaterThan(0);

    const res = await marta.patch('/api/admin/users/4').send({ isActive: false });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('inactive');
    expect(await sesionesDe(4)).toBe(0);
    expect((await andres.get('/api/auth/me')).body).toEqual({ user: null });

    expect((await marta.patch('/api/admin/users/4').send({ isActive: true })).body.status).toBe('active');
    await entrarComo(t.app, 'andres');
  });

  it('4a: desactivar a un adoptante da de baja sus adopciones (sin más cobros)', async () => {
    // Irene: la 10 está activa y la 11, pendiente de pago.
    const res = await marta.patch('/api/admin/users/10').send({ isActive: false });
    expect(res.status).toBe(200);
    const activa = await adopcion(10);
    expect(activa).toMatchObject({ status: 'active', end_reason: null, next_billing_date: null });
    expect(activa.cancel_requested_at).not.toBeNull();
    expect(activa.end_date).not.toBeNull();
    expect(await adopcion(11)).toMatchObject({ status: 'cancelled', end_reason: 'admin_cancelled', end_date: t.hoy });

    // Elena: la 7 está pausada y termina el último día pagado.
    const { rows } = await t.pool.query<{ ultimo: string }>(
      'SELECT (next_billing_date - 1)::text AS ultimo FROM adoptions WHERE id = 7',
    );
    expect((await marta.patch('/api/admin/users/8').send({ isActive: false })).status).toBe(200);
    expect(await adopcion(7)).toMatchObject({
      status: 'finished',
      end_reason: 'admin_cancelled',
      end_date: rows[0]?.ultimo,
    });
    expect(await adopcion(6)).toMatchObject({ status: 'active', next_billing_date: null });

    // Reactivar no reabre las adopciones.
    await marta.patch('/api/admin/users/10').send({ isActive: true });
    expect(await adopcion(11)).toMatchObject({ status: 'cancelled' });
  });

  it('4b: el administrador no puede desactivar su propia cuenta', async () => {
    const res = await marta.patch('/api/admin/users/1').send({ isActive: false });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('CANNOT_DEACTIVATE_SELF');
  });

  it('4c: una cuenta anonimizada no se puede reactivar', async () => {
    const res = await marta.patch('/api/admin/users/15').send({ isActive: true });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('ANONYMIZED_CANNOT_REACTIVATE');
  });

  it('A1: cambia el rol entre cuidador y administrador', async () => {
    const nuria = await entrarComo(t.app, 'nuria');
    expect((await nuria.get('/api/admin/users')).status).toBe(403);
    const res = await marta.patch('/api/admin/users/3').send({ role: 'admin' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('admin');
    // El rol se relee en cada petición: no hace falta volver a entrar.
    expect((await nuria.get('/api/admin/users')).status).toBe(200);
    expect((await marta.patch('/api/admin/users/3').send({ role: 'caretaker' })).body.role).toBe('caretaker');
  });

  it('A1: un adoptante no se convierte en trabajador ni al revés', async () => {
    const aTrabajador = await marta.patch('/api/admin/users/6').send({ role: 'caretaker' });
    expect(aTrabajador.status).toBe(422);
    expect(aTrabajador.body.error.code).toBe('ROLE_CHANGE_NOT_ALLOWED');
    expect((await marta.patch('/api/admin/users/3').send({ role: 'adopter' })).status).toBe(400);
  });

  it('A1: el último administrador activo no deja de serlo', async () => {
    expect((await marta.patch('/api/admin/users/2').send({ role: 'caretaker' })).status).toBe(200);
    const res = await marta.patch('/api/admin/users/1').send({ role: 'caretaker' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('LAST_ACTIVE_ADMIN');
    expect((await marta.patch('/api/admin/users/2').send({ role: 'admin' })).status).toBe(200);
  });

  it('valida el cuerpo: exactamente uno de isActive o role', async () => {
    expect((await marta.patch('/api/admin/users/3').send({})).status).toBe(400);
    expect((await marta.patch('/api/admin/users/3').send({ isActive: false, role: 'admin' })).status).toBe(400);
    expect((await marta.patch('/api/admin/users/999').send({ isActive: false })).status).toBe(404);
  });
});

describe('CU-36 Crear una cuenta de trabajador', () => {
  const nuevo = {
    firstName: 'Rosa',
    lastName: 'Gil Martí',
    email: 'Rosa.Gil@santuario.test',
    phone: '612-345-678',
    role: 'caretaker',
  };

  it('3-5: crea la cuenta verificada y sin contraseña utilizable, y envía la invitación de 24 horas', async () => {
    const res = await marta.post('/api/admin/users').send(nuevo);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      firstName: 'Rosa',
      email: 'rosa.gil@santuario.test',
      phone: '612345678',
      role: 'caretaker',
      status: 'active',
      emailVerified: true,
      invitationPending: true,
      lastLoginAt: null,
    });

    expect(t.mailer.outbox).toHaveLength(1);
    expect(t.mailer.outbox[0]).toMatchObject({ to: 'rosa.gil@santuario.test' });
    const token = tokenDelEmail(t.mailer, 'rosa.gil@santuario.test');
    expect(t.mailer.outbox[0]?.text).toContain(`${TEST_CLIENT_URL}/reset-password?token=${token}&invite=1`);
    const { rows } = await t.pool.query('SELECT type, expires_at FROM user_tokens WHERE token_hash = $1', [
      hashToken(token),
    ]);
    expect(rows[0]).toEqual({
      type: 'worker_invitation',
      expires_at: new Date(t.reloj.ahora().getTime() + 24 * 3600_000),
    });

    // Pedir la recuperación de contraseña no anula la invitación.
    await request(t.app).post('/api/auth/forgot-password').send({ email: 'rosa.gil@santuario.test' });
    const elegir = await request(t.app)
      .post('/api/auth/reset-password')
      .send({ token, password: 'rosa-cuida-26', passwordConfirm: 'rosa-cuida-26' });
    expect(elegir.status).toBe(204);
    const rosa = await entrar('rosa.gil@santuario.test', 'rosa-cuida-26');
    expect((await rosa.get('/api/admin/dashboard')).status).toBe(200);
    expect((await ficha(res.body.id)).invitationPending).toBe(false);
  });

  it('3a: el email ya está registrado (también si es de un adoptante, que no se convierte)', async () => {
    const res = await marta.post('/api/admin/users').send({ ...nuevo, email: 'LUCIA.martinez@correo.test' });
    expect(res.status).toBe(409);
    expect(res.body.error.details[0]).toMatchObject({
      field: 'email',
      message: 'Ya existe una cuenta con este email.',
    });
    expect((await ficha(6)).role).toBe('adopter');
  });

  it('valida los datos: el rol solo puede ser de trabajador', async () => {
    expect(
      (await marta.post('/api/admin/users').send({ ...nuevo, email: 'x@santuario.test', role: 'adopter' })).status,
    ).toBe(400);
    expect((await marta.post('/api/admin/users').send({ ...nuevo, email: 'no-es-email' })).status).toBe(400);
  });

  it('4a: reenvía la invitación a un trabajador que nunca ha entrado y anula la anterior', async () => {
    const creado = await marta.post('/api/admin/users').send({ ...nuevo, email: 'pau.ferrer@santuario.test' });
    const primera = tokenDelEmail(t.mailer, 'pau.ferrer@santuario.test');

    const res = await marta.post(`/api/admin/users/${creado.body.id}/invitation`).send({});
    expect(res.status).toBe(204);
    const segunda = tokenDelEmail(t.mailer, 'pau.ferrer@santuario.test');
    expect(segunda).not.toBe(primera);

    const conLaPrimera = await request(t.app)
      .post('/api/auth/reset-password')
      .send({ token: primera, password: 'pau-cuida-26', passwordConfirm: 'pau-cuida-26' });
    expect(conLaPrimera.status).toBe(422);
  });

  it('4a: no se reenvía a quien ya ha entrado ni a un adoptante', async () => {
    for (const id of [3, 6]) {
      const res = await marta.post(`/api/admin/users/${id}/invitation`).send({});
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVITATION_NOT_PENDING');
    }
    expect(t.mailer.outbox).toHaveLength(0);
    expect((await marta.post('/api/admin/users/999/invitation').send({})).status).toBe(404);
  });
});

describe('CU-51 Enviar a un trabajador el enlace para cambiar su contraseña', () => {
  // Usuarios de TEST_DATA.sql: 2 Javier (admin), 3 Nuria y 5 Carmen (cuidadoras), 6 Lucía (adoptante).
  const enviar = (agente: Agente | ReturnType<typeof request>, id: number) =>
    agente.post(`/api/admin/users/${id}/password-reset`).send({});

  it('solo el administrador: sin sesión 401; cuidadora 403; usuario que no existe 404', async () => {
    expect((await enviar(request(t.app), 3)).status).toBe(401);
    const nuria = await entrarComo(t.app, 'nuria');
    expect((await enviar(nuria, 5)).status).toBe(403);
    expect((await enviar(marta, 9999)).status).toBe(404);
    expect(t.mailer.outbox).toHaveLength(0);
  });

  it('envía a la cuidadora un enlace de 30 minutos que sirve para elegir otra contraseña', async () => {
    const res = await enviar(marta, 3);
    expect(res.status).toBe(204);
    expect(t.mailer.outbox).toHaveLength(1);
    expect(t.mailer.outbox[0]).toMatchObject({ to: 'nuria.peris@santuario.test' });
    const token = tokenDelEmail(t.mailer, 'nuria.peris@santuario.test');
    expect(t.mailer.outbox[0]?.text).toContain(`${TEST_CLIENT_URL}/reset-password?token=${token}`);
    expect(t.mailer.outbox[0]?.text).not.toContain('invite=1');
    const { rows } = await t.pool.query('SELECT type, expires_at FROM user_tokens WHERE token_hash = $1', [
      hashToken(token),
    ]);
    expect(rows[0]).toEqual({
      type: 'password_reset',
      expires_at: new Date(t.reloj.ahora().getTime() + 30 * 60_000),
    });

    // Hasta que la cambie, su contraseña sigue sirviendo; al cambiarla se cierran sus sesiones.
    const sesionAnterior = await entrar('nuria.peris@santuario.test', 'NuriaPeris26#!');
    const cambio = await request(t.app)
      .post('/api/auth/reset-password')
      .send({ token, password: 'nuria-nueva-2026', passwordConfirm: 'nuria-nueva-2026' });
    expect(cambio.status).toBe(204);
    expect((await sesionAnterior.get('/api/auth/me')).body.user).toBeNull();
    await entrar('nuria.peris@santuario.test', 'nuria-nueva-2026');
  });

  it('también a otro administrador; cada envío anula el anterior', async () => {
    expect((await enviar(marta, 2)).status).toBe(204);
    const primero = tokenDelEmail(t.mailer, 'javier.ortega@santuario.test');
    t.mailer.outbox.length = 0;
    expect((await enviar(marta, 2)).status).toBe(204);
    const segundo = tokenDelEmail(t.mailer, 'javier.ortega@santuario.test');
    const usarPrimero = await request(t.app)
      .post('/api/auth/reset-password')
      .send({ token: primero, password: 'javier-nueva-26', passwordConfirm: 'javier-nueva-26' });
    expect(usarPrimero.status).toBe(422);
    expect(usarPrimero.body.error.code).toBe('INVALID_TOKEN');
    expect(segundo).not.toBe(primero);
  });

  it('no se puede con un adoptante, con una cuenta desactivada ni con la propia cuenta', async () => {
    await t.pool.query('UPDATE users SET is_active = FALSE WHERE id = 5');
    for (const id of [6, 5, 1]) {
      const res = await enviar(marta, id);
      expect(res.status, `usuario ${id}`).toBe(422);
      expect(res.body.error.code).toBe('PASSWORD_RESET_NOT_ALLOWED');
    }
    await t.pool.query('UPDATE users SET is_active = TRUE WHERE id = 5');
    expect(t.mailer.outbox).toHaveLength(0);
  });

  it('queda en el registro de actividad, sin el enlace', async () => {
    await enviar(marta, 4);
    const { rows } = await t.pool.query(
      `SELECT user_id, action, details FROM activity_logs
        WHERE table_name = 'users' AND record_id = 4 ORDER BY id DESC LIMIT 1`,
    );
    expect(rows[0]).toEqual({ user_id: 1, action: 'update', details: { resetLinkSent: true } });
  });
});
