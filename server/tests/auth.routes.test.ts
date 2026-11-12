import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { hashToken } from '../src/utils/tokens.js';
import { prepararApp, TEST_CLIENT_URL, tokenDelEmail, type TestApp } from './helpers/test-app.js';

let t: TestApp;
beforeAll(async () => {
  t = await prepararApp();
});
afterAll(() => t.pool.end());
beforeEach(() => {
  t.mailer.outbox.length = 0;
});

const registro = (datos: Record<string, unknown> = {}) => ({
  firstName: 'Ana',
  lastName: 'Ferrer Soler',
  email: 'ana.ferrer@correo.test',
  password: 'buitres-2026',
  passwordConfirm: 'buitres-2026',
  privacyAccepted: true,
  ...datos,
});

const login = (agent: ReturnType<typeof request.agent> | ReturnType<typeof request>, email: string, password: string) =>
  agent.post('/api/auth/login').send({ email, password });

const usuario = async (email: string) => {
  const { rows } = await t.pool.query(
    'SELECT id, role, email_verified, password_hash, privacy_accepted_at, last_login_at FROM users WHERE LOWER(email) = LOWER($1)',
    [email],
  );
  return rows[0];
};

const sesionesDe = async (userId: number) => {
  const { rows } = await t.pool.query("SELECT sid FROM user_sessions WHERE (sess ->> 'userId')::int = $1", [userId]);
  return rows.length;
};

const cookieSid = (res: request.Response) =>
  ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith('sid='));

const insertarToken = (userId: number, type: string, token: string, expiraEnMinutos: number) =>
  t.pool.query(`INSERT INTO user_tokens (user_id, type, token_hash, expires_at) VALUES ($1, $2, $3, $4)`, [
    userId,
    type,
    hashToken(token),
    new Date(t.reloj.ahora().getTime() + expiraEnMinutos * 60_000),
  ]);

describe('GET /api/auth/me', () => {
  it('sin sesión devuelve user null y no crea ninguna cookie', async () => {
    const res = await request(t.app).get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user: null });
    expect(cookieSid(res)).toBeUndefined();
  });
});

describe('CU-07 Registrarse', () => {
  it('crea un adoptante sin verificar, inicia la sesión y envía el email de verificación', async () => {
    const agent = request.agent(t.app);
    const res = await agent.post('/api/auth/register').send(registro());
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      user: {
        id: expect.any(Number),
        firstName: 'Ana',
        lastName: 'Ferrer Soler',
        email: 'ana.ferrer@correo.test',
        role: 'adopter',
        emailVerified: false,
      },
    });

    const fila = await usuario('ana.ferrer@correo.test');
    expect(fila).toMatchObject({ role: 'adopter', email_verified: false });
    expect(fila.password_hash).toMatch(/^\$2[aby]\$10\$/);
    expect(fila.privacy_accepted_at.toISOString()).toBe(t.reloj.ahora().toISOString());

    expect((await agent.get('/api/auth/me')).body.user).toMatchObject({ email: 'ana.ferrer@correo.test' });

    expect(t.mailer.outbox).toHaveLength(1);
    expect(t.mailer.outbox[0]).toMatchObject({ to: 'ana.ferrer@correo.test', subject: 'Verifica tu email' });
    const token = tokenDelEmail(t.mailer, 'ana.ferrer@correo.test');
    expect(t.mailer.outbox[0]?.text).toContain(`${TEST_CLIENT_URL}/verify-email?token=${token}`);

    // En la base de datos solo se guarda el hash del token, que caduca en 24 horas.
    const { rows } = await t.pool.query('SELECT type, token_hash, expires_at FROM user_tokens WHERE user_id = $1', [
      fila.id,
    ]);
    expect(rows).toEqual([
      {
        type: 'email_verification',
        token_hash: hashToken(token),
        expires_at: new Date(t.reloj.ahora().getTime() + 24 * 3600_000),
      },
    ]);
  });

  it('la cookie de sesión es sid, httpOnly y SameSite=Lax', async () => {
    const res = await request(t.app)
      .post('/api/auth/register')
      .send(registro({ email: 'cookie@correo.test' }));
    const cookie = cookieSid(res);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).toMatch(/Expires=/);
  });

  it('ignora el campo role: siempre crea adoptantes (RN-02)', async () => {
    const res = await request(t.app)
      .post('/api/auth/register')
      .send(registro({ email: 'listo@correo.test', role: 'admin' }));
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('adopter');
    expect((await usuario('listo@correo.test')).role).toBe('adopter');
  });

  it('3a: el email ya está registrado (sin distinguir mayúsculas)', async () => {
    const res = await request(t.app)
      .post('/api/auth/register')
      .send(registro({ email: 'Lucia.Martinez@correo.test' }));
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({
      code: 'EMAIL_ALREADY_REGISTERED',
      message: 'Ya existe una cuenta con este email.',
    });
  });

  it('3b y 3c: contraseñas que no coinciden y política sin aceptar', async () => {
    const res = await request(t.app)
      .post('/api/auth/register')
      .send(registro({ email: 'otro@correo.test', passwordConfirm: 'distinta', privacyAccepted: false }));
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d: { field: string }) => d.field)).toContain('privacyAccepted');
    expect(await usuario('otro@correo.test')).toBeUndefined();
  });

  it('3b: contraseña demasiado corta', async () => {
    const res = await request(t.app)
      .post('/api/auth/register')
      .send(registro({ email: 'corta@correo.test', password: 'corta', passwordConfirm: 'corta' }));
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([
      { field: 'password', message: 'La contraseña debe tener al menos 8 caracteres.' },
    ]);
  });

  it('5a: si falla el envío del email, la cuenta se crea igualmente', async () => {
    t.mailer.failNext = true;
    const res = await request(t.app)
      .post('/api/auth/register')
      .send(registro({ email: 'sin-correo@correo.test' }));
    expect(res.status).toBe(201);
    expect(await usuario('sin-correo@correo.test')).toMatchObject({ email_verified: false });
    expect(t.mailer.outbox).toHaveLength(0);
  });

  it('solo acepta JSON en las peticiones que modifican datos (CSRF)', async () => {
    const res = await request(t.app)
      .post('/api/auth/register')
      .type('form')
      .send('firstName=Ana&email=form@correo.test');
    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });
});

describe('CU-08 Verificar el email', () => {
  it('verifica el email con el token del registro y lo marca como usado', async () => {
    const agent = request.agent(t.app);
    await agent.post('/api/auth/register').send(registro({ email: 'verifica@correo.test' }));
    const token = tokenDelEmail(t.mailer, 'verifica@correo.test');

    const res = await request(t.app).post('/api/auth/verify-email').send({ token });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'verified' });
    expect((await usuario('verifica@correo.test')).email_verified).toBe(true);
    const { rows } = await t.pool.query('SELECT used_at FROM user_tokens WHERE token_hash = $1', [hashToken(token)]);
    expect(rows[0].used_at).toEqual(t.reloj.ahora());

    // La sesión abierta ve el cambio al momento (el usuario se relee en cada petición).
    expect((await agent.get('/api/auth/me')).body.user.emailVerified).toBe(true);
  });

  it('3a: si el email ya estaba verificado, lo indica (aunque el enlace se use dos veces)', async () => {
    await request(t.app)
      .post('/api/auth/register')
      .send(registro({ email: 'dos-veces@correo.test' }));
    const token = tokenDelEmail(t.mailer, 'dos-veces@correo.test');
    await request(t.app).post('/api/auth/verify-email').send({ token });
    const res = await request(t.app).post('/api/auth/verify-email').send({ token });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'already_verified' });
  });

  it('2a: token caducado, inexistente o de otro tipo', async () => {
    await insertarToken(13, 'email_verification', 'caducado', -1);
    await insertarToken(13, 'password_reset', 'de-otro-tipo', 60);
    for (const token of ['caducado', 'no-existe', 'de-otro-tipo']) {
      const res = await request(t.app).post('/api/auth/verify-email').send({ token });
      expect(res.status).toBe(422);
      expect(res.body.error).toMatchObject({ code: 'INVALID_TOKEN', message: 'El enlace no es válido o ha caducado.' });
    }
    expect((await usuario('adrian.moreno@correo.test')).email_verified).toBe(false);
  });

  it('2a: un token usado de un email sin verificar no vale', async () => {
    await t.pool.query(
      `INSERT INTO user_tokens (user_id, type, token_hash, expires_at, used_at)
       VALUES (13, 'email_verification', $1, NOW() + INTERVAL '1 day', NOW())`,
      [hashToken('usado')],
    );
    const res = await request(t.app).post('/api/auth/verify-email').send({ token: 'usado' });
    expect(res.status).toBe(422);
  });

  it('sin token responde 400', async () => {
    expect((await request(t.app).post('/api/auth/verify-email').send({})).status).toBe(400);
  });

  describe('A1 Reenviar el email de verificación', () => {
    it('sin sesión responde 401', async () => {
      const res = await request(t.app).post('/api/auth/resend-verification').send({});
      expect(res.status).toBe(401);
    });

    it('invalida el token anterior y envía uno nuevo', async () => {
      await insertarToken(13, 'email_verification', 'anterior', 60);
      const agent = request.agent(t.app);
      expect((await login(agent, 'adrian.moreno@correo.test', 'Adrian_99')).status).toBe(200);

      const res = await agent.post('/api/auth/resend-verification').send({});
      expect(res.status).toBe(204);
      expect(t.mailer.outbox.map((m) => m.to)).toEqual(['adrian.moreno@correo.test']);

      expect((await request(t.app).post('/api/auth/verify-email').send({ token: 'anterior' })).status).toBe(422);
      const nuevo = tokenDelEmail(t.mailer, 'adrian.moreno@correo.test');
      expect((await request(t.app).post('/api/auth/verify-email').send({ token: nuevo })).body).toEqual({
        status: 'verified',
      });
    });

    it('3a: si el email ya está verificado responde 409', async () => {
      const agent = request.agent(t.app);
      await login(agent, 'lucia.martinez@correo.test', 'Lucia.buitres1');
      const res = await agent.post('/api/auth/resend-verification').send({});
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('EMAIL_ALREADY_VERIFIED');
    });

    it('como máximo 3 reenvíos por hora', async () => {
      const agent = request.agent(t.app);
      await agent.post('/api/auth/register').send(registro({ email: 'reenvios@correo.test' }));
      for (let i = 0; i < 3; i++) {
        expect((await agent.post('/api/auth/resend-verification').send({})).status).toBe(204);
      }
      const res = await agent.post('/api/auth/resend-verification').send({});
      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe('TOO_MANY_REQUESTS');
    });
  });
});

describe('CU-09 Iniciar sesión', () => {
  it('inicia la sesión de un adoptante y guarda el último acceso', async () => {
    const agent = request.agent(t.app);
    const res = await login(agent, 'Lucia.Martinez@correo.test', 'Lucia.buitres1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      user: {
        id: 6,
        firstName: 'Lucía',
        lastName: 'Martínez Navarro',
        email: 'lucia.martinez@correo.test',
        role: 'adopter',
        emailVerified: true,
      },
    });
    expect(cookieSid(res)).toBeDefined();
    expect((await usuario('lucia.martinez@correo.test')).last_login_at).toEqual(t.reloj.ahora());
    expect((await agent.get('/api/auth/me')).body.user.id).toBe(6);
  });

  it('los trabajadores entran con su rol', async () => {
    const res = await login(request(t.app), 'nuria.peris@santuario.test', 'NuriaPeris26#!');
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('caretaker');
  });

  it('regenera la sesión al entrar (fijación de sesión)', async () => {
    const agent = request.agent(t.app);
    const sid1 = cookieSid(await login(agent, 'raquel.font@correo.test', 'RaquelFont!'));
    const sid2 = cookieSid(await login(agent, 'raquel.font@correo.test', 'RaquelFont!'));
    expect(sid1).toBeDefined();
    expect(sid2?.split(';')[0]).not.toBe(sid1?.split(';')[0]);
    expect(await sesionesDe(12)).toBe(1);
  });

  it('3a: email o contraseña incorrectos dan el mismo mensaje', async () => {
    const malaClave = await login(request(t.app), 'irene.dominguez@correo.test', 'incorrecta');
    const sinCuenta = await login(request(t.app), 'nadie@correo.test', 'incorrecta');
    for (const res of [malaClave, sinCuenta]) {
      expect(res.status).toBe(401);
      expect(res.body.error).toEqual({
        code: 'INVALID_CREDENTIALS',
        message: 'Email o contraseña incorrectos.',
        details: [],
      });
      expect(cookieSid(res)).toBeUndefined();
    }
  });

  it('3b: una cuenta desactivada no puede entrar', async () => {
    const res = await login(request(t.app), 'teresa.vicent@correo.test', 'Teresa*55');
    expect(res.status).toBe(403);
    expect(res.body.error).toMatchObject({
      code: 'ACCOUNT_INACTIVE',
      message: 'Esta cuenta no está activa. Contacta con el santuario.',
    });
  });

  it('3b: una cuenta anonimizada no puede entrar', async () => {
    await t.pool.query("UPDATE users SET password_hash = crypt('Clave-conocida1', gen_salt('bf', 4)) WHERE id = 15");
    const res = await login(request(t.app), 'deleted-15@anonymized.invalid', 'Clave-conocida1');
    expect(res.status).toBe(403);
  });

  it('5a: con el email sin verificar entra igualmente', async () => {
    // Un test anterior verifica a Adrián al probar el reenvío.
    await t.pool.query('UPDATE users SET email_verified = FALSE WHERE id = 13');
    const res = await login(request(t.app), 'adrian.moreno@correo.test', 'Adrian_99');
    expect(res.status).toBe(200);
    expect(res.body.user.emailVerified).toBe(false);
  });

  it('3c: tras 5 intentos fallidos en 15 minutos bloquea ese email', async () => {
    for (let i = 0; i < 5; i++) {
      expect((await login(request(t.app), 'hector.benet@correo.test', 'mala')).status).toBe(401);
    }
    const bloqueado = await login(request(t.app), 'hector.benet@correo.test', 'Hector1234');
    expect(bloqueado.status).toBe(429);
    expect(bloqueado.body.error.message).toBe('Demasiados intentos; espera unos minutos.');
    // Otro email desde la misma IP sigue pudiendo entrar.
    expect((await login(request(t.app), 'sergio.llorens@correo.test', 'Sergio#Vuela7')).status).toBe(200);
  });

  it('si la cuenta se desactiva, la sesión abierta deja de valer', async () => {
    const agent = request.agent(t.app);
    await login(agent, 'elena.rubio@correo.test', 'elenita_88');
    await t.pool.query('UPDATE users SET is_active = FALSE WHERE id = 8');
    expect((await agent.get('/api/auth/me')).body).toEqual({ user: null });
    await t.pool.query('UPDATE users SET is_active = TRUE WHERE id = 8');
  });

  it('valida los datos', async () => {
    const res = await request(t.app).post('/api/auth/login').send({ email: '' });
    expect(res.status).toBe(400);
  });
});

describe('CU-10 Recuperar la contraseña', () => {
  const NEUTRO = { message: 'Si existe una cuenta con ese email, recibirás un enlace.' };

  it('envía un enlace que caduca en 1 hora', async () => {
    const res = await request(t.app).post('/api/auth/forgot-password').send({ email: 'Pablo.Garcia@correo.test' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(NEUTRO);
    expect(t.mailer.outbox).toHaveLength(1);
    expect(t.mailer.outbox[0]).toMatchObject({ to: 'pablo.garcia@correo.test', subject: 'Recupera tu contraseña' });
    const token = tokenDelEmail(t.mailer, 'pablo.garcia@correo.test');
    expect(t.mailer.outbox[0]?.text).toContain(`${TEST_CLIENT_URL}/reset-password?token=${token}`);
    const { rows } = await t.pool.query('SELECT expires_at FROM user_tokens WHERE token_hash = $1', [hashToken(token)]);
    expect(rows[0].expires_at).toEqual(new Date(t.reloj.ahora().getTime() + 3600_000));
  });

  it('3a: con un email que no existe o una cuenta inactiva responde igual y no envía nada', async () => {
    for (const email of ['nadie@correo.test', 'teresa.vicent@correo.test']) {
      const res = await request(t.app).post('/api/auth/forgot-password').send({ email });
      expect(res.status).toBe(200);
      expect(res.body).toEqual(NEUTRO);
    }
    expect(t.mailer.outbox).toHaveLength(0);
  });

  it('cambia la contraseña, marca el token como usado y cierra todas las sesiones', async () => {
    const sesion1 = request.agent(t.app);
    const sesion2 = request.agent(t.app);
    await login(sesion1, 'pablo.garcia@correo.test', 'Pablo2024!');
    await login(sesion2, 'pablo.garcia@correo.test', 'Pablo2024!');
    expect(await sesionesDe(7)).toBe(2);

    await request(t.app).post('/api/auth/forgot-password').send({ email: 'pablo.garcia@correo.test' });
    const token = tokenDelEmail(t.mailer, 'pablo.garcia@correo.test');
    const res = await sesion1
      .post('/api/auth/reset-password')
      .send({ token, password: 'otra-clave-1', passwordConfirm: 'otra-clave-1' });
    expect(res.status).toBe(204);

    expect(await sesionesDe(7)).toBe(0);
    expect((await sesion1.get('/api/auth/me')).body).toEqual({ user: null });
    expect((await sesion2.get('/api/auth/me')).body).toEqual({ user: null });
    expect((await login(request(t.app), 'pablo.garcia@correo.test', 'Pablo2024!')).status).toBe(401);
    expect((await login(request(t.app), 'pablo.garcia@correo.test', 'otra-clave-1')).status).toBe(200);

    // 5a: el mismo enlace ya no sirve.
    const otraVez = await request(t.app)
      .post('/api/auth/reset-password')
      .send({ token, password: 'tercera-clave', passwordConfirm: 'tercera-clave' });
    expect(otraVez.status).toBe(422);
    expect(otraVez.body.error.code).toBe('INVALID_TOKEN');
  });

  it('pedir otro enlace invalida el anterior', async () => {
    await request(t.app).post('/api/auth/forgot-password').send({ email: 'irene.dominguez@correo.test' });
    const primero = tokenDelEmail(t.mailer, 'irene.dominguez@correo.test');
    await request(t.app).post('/api/auth/forgot-password').send({ email: 'irene.dominguez@correo.test' });
    const res = await request(t.app)
      .post('/api/auth/reset-password')
      .send({ token: primero, password: 'nueva-clave', passwordConfirm: 'nueva-clave' });
    expect(res.status).toBe(422);
  });

  it('5a: token caducado o de verificación de email', async () => {
    await insertarToken(9, 'password_reset', 'reset-caducado', -1);
    await insertarToken(9, 'email_verification', 'reset-otro-tipo', 60);
    for (const token of ['reset-caducado', 'reset-otro-tipo']) {
      const res = await request(t.app)
        .post('/api/auth/reset-password')
        .send({ token, password: 'nueva-clave', passwordConfirm: 'nueva-clave' });
      expect(res.status).toBe(422);
    }
  });

  it('5b: la contraseña no cumple el mínimo o no coincide', async () => {
    await insertarToken(9, 'password_reset', 'reset-valido', 60);
    const corta = await request(t.app)
      .post('/api/auth/reset-password')
      .send({ token: 'reset-valido', password: 'corta', passwordConfirm: 'corta' });
    expect(corta.status).toBe(400);
    const distinta = await request(t.app)
      .post('/api/auth/reset-password')
      .send({ token: 'reset-valido', password: 'nueva-clave', passwordConfirm: 'otra-clave' });
    expect(distinta.status).toBe(400);
    expect(distinta.body.error.details).toEqual([
      { field: 'passwordConfirm', message: 'Las contraseñas no coinciden.' },
    ]);
  });
});

describe('CU-11 Cerrar sesión', () => {
  it('destruye la sesión en el servidor y borra la cookie', async () => {
    const agent = request.agent(t.app);
    await login(agent, 'sergio.llorens@correo.test', 'Sergio#Vuela7');
    const antes = await sesionesDe(9);

    const res = await agent.post('/api/auth/logout').send({});
    expect(res.status).toBe(204);
    expect(cookieSid(res)).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect(await sesionesDe(9)).toBe(antes - 1);
    expect((await agent.get('/api/auth/me')).body).toEqual({ user: null });
  });

  it('sin sesión responde 401', async () => {
    const res = await request(t.app).post('/api/auth/logout').send({});
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
