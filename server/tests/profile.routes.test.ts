import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prepararApp, type TestApp } from './helpers/test-app.js';

let t: TestApp;
beforeAll(async () => {
  t = await prepararApp();
});
afterAll(() => t.pool.end());

type Agent = ReturnType<typeof request.agent>;
const CLAVES: Record<string, string> = {
  'pablo.garcia@correo.test': 'Pablo2024!',
  'irene.dominguez@correo.test': 'Irene2025ok',
  'sergio.llorens@correo.test': 'Sergio#Vuela7',
  'hector.benet@correo.test': 'Hector1234',
  'raquel.font@correo.test': 'RaquelFont!',
  'nuria.peris@santuario.test': 'NuriaPeris26#!',
};

/** Un agente nuevo con su propia sesión. */
async function entrar(email: string, password = CLAVES[email]): Promise<Agent> {
  const agent = request.agent(t.app);
  const res = await agent.post('/api/auth/login').send({ email, password });
  expect(res.status).toBe(200);
  return agent;
}

const nombresPublicos = async (animalId: number) =>
  (await request(t.app).get(`/api/animals/${animalId}`)).body.publicAdopterNames as string[];

describe('CU-23 Gestionar el perfil y las preferencias', () => {
  it('2: muestra los datos y las preferencias del adoptante', async () => {
    const res = await (await entrar('irene.dominguez@correo.test')).get('/api/me/profile');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      firstName: 'Irene',
      lastName: 'Domínguez Prats',
      email: 'irene.dominguez@correo.test',
      phone: '611222010',
      role: 'adopter',
      emailNotifications: true,
      emailFrequency: 'per_update',
      showPublicName: true,
    });
  });

  it('3-4: guarda solo lo enviado y devuelve el perfil actualizado', async () => {
    const pablo = await entrar('pablo.garcia@correo.test');
    const res = await pablo
      .patch('/api/me/profile')
      .send({ firstName: ' Pablo José ', phone: '622-33-44-55', emailFrequency: 'monthly_digest' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      firstName: 'Pablo José',
      lastName: 'García Esteve',
      phone: '622334455',
      emailFrequency: 'monthly_digest',
    });
    expect((await pablo.get('/api/auth/me')).body.user.firstName).toBe('Pablo José');
  });

  it('postcondición: activar o desactivar «aparecer en la ficha» se ve al momento (RN-16)', async () => {
    const pablo = await entrar('pablo.garcia@correo.test');
    expect(await nombresPublicos(1)).toEqual(['Lucía']);
    await pablo.patch('/api/me/profile').send({ showPublicName: true });
    expect(await nombresPublicos(1)).toEqual(['Lucía', 'Pablo José']);
    await pablo.patch('/api/me/profile').send({ showPublicName: false });
    expect(await nombresPublicos(1)).toEqual(['Lucía']);
  });

  it('3a: datos no válidos dan errores en los campos y no se guarda nada', async () => {
    const irene = await entrar('irene.dominguez@correo.test');
    const res = await irene.patch('/api/me/profile').send({ firstName: '', phone: '+34 612 345 678' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d: { field: string }) => d.field).sort()).toEqual(['firstName', 'phone']);
    expect((await irene.get('/api/me/profile')).body).toMatchObject({ firstName: 'Irene', phone: '611222010' });
  });

  it('3b: el email no se puede cambiar', async () => {
    const irene = await entrar('irene.dominguez@correo.test');
    expect((await irene.patch('/api/me/profile').send({ email: 'otra@correo.test' })).status).toBe(400);
    expect((await irene.get('/api/me/profile')).body.email).toBe('irene.dominguez@correo.test');
  });

  it('un trabajador gestiona sus datos, pero no tiene preferencias de adoptante', async () => {
    const nuria = await entrar('nuria.peris@santuario.test');
    expect((await nuria.get('/api/me/profile')).body).toMatchObject({ firstName: 'Nuria', role: 'caretaker' });
    expect((await nuria.patch('/api/me/profile').send({ phone: '699888777' })).body.phone).toBe('699888777');
    const res = await nuria.patch('/api/me/profile').send({ showPublicName: true });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ADOPTER_ONLY_PREFERENCE');
  });

  it('sin sesión responde 401', async () => {
    expect((await request(t.app).get('/api/me/profile')).status).toBe(401);
    expect((await request(t.app).patch('/api/me/profile').send({ firstName: 'X' })).status).toBe(401);
  });
});

describe('CU-24 Cambiar la contraseña', () => {
  it('3: cambia la contraseña, cierra las demás sesiones y mantiene la actual', async () => {
    const actual = await entrar('sergio.llorens@correo.test');
    const otra = await entrar('sergio.llorens@correo.test');
    const res = await actual
      .put('/api/me/password')
      .send({ currentPassword: 'Sergio#Vuela7', newPassword: 'NuevaClave#2026' });
    expect(res.status).toBe(204);
    expect((await actual.get('/api/auth/me')).body.user).toMatchObject({ firstName: 'Sergio' });
    expect((await otra.get('/api/auth/me')).body.user).toBeNull();

    const conLaVieja = await request(t.app)
      .post('/api/auth/login')
      .send({ email: 'sergio.llorens@correo.test', password: 'Sergio#Vuela7' });
    expect(conLaVieja.status).toBe(401);
    await entrar('sergio.llorens@correo.test', 'NuevaClave#2026');
  });

  it('anula los enlaces de recuperación de contraseña pendientes', async () => {
    await request(t.app).post('/api/auth/forgot-password').send({ email: 'raquel.font@correo.test' });
    const raquel = await entrar('raquel.font@correo.test');
    await raquel.put('/api/me/password').send({ currentPassword: 'RaquelFont!', newPassword: 'OtraClave#2026' });
    const { rows } = await t.pool.query(
      "SELECT count(*)::int AS n FROM user_tokens WHERE user_id = 12 AND type = 'password_reset' AND used_at IS NULL",
    );
    expect(rows[0].n).toBe(0);
  });

  it('2a: la contraseña actual incorrecta da un error en su campo', async () => {
    const irene = await entrar('irene.dominguez@correo.test');
    const res = await irene.put('/api/me/password').send({ currentPassword: 'mal', newPassword: 'NuevaClave#2026' });
    expect(res.status).toBe(422);
    expect(res.body.error).toEqual({
      code: 'INVALID_CURRENT_PASSWORD',
      message: 'La contraseña actual no es correcta.',
      details: [{ field: 'currentPassword', message: 'La contraseña actual no es correcta.' }],
    });
  });

  it('2b: la nueva debe cumplir el mínimo y ser distinta de la actual', async () => {
    const irene = await entrar('irene.dominguez@correo.test');
    const corta = await irene.put('/api/me/password').send({ currentPassword: 'Irene2025ok', newPassword: 'corta' });
    expect(corta.status).toBe(400);
    expect(corta.body.error.details[0].field).toBe('newPassword');
    const igual = await irene
      .put('/api/me/password')
      .send({ currentPassword: 'Irene2025ok', newPassword: 'Irene2025ok' });
    expect(igual.status).toBe(400);
    expect(igual.body.error.details).toEqual([
      { field: 'newPassword', message: 'La nueva contraseña debe ser distinta de la actual.' },
    ]);
  });

  it('limita los intentos fallidos: 5 cada 15 minutos', async () => {
    const hector = await entrar('hector.benet@correo.test');
    for (let i = 0; i < 5; i++) {
      expect(
        (await hector.put('/api/me/password').send({ currentPassword: 'mal', newPassword: 'NuevaClave#2026' })).status,
      ).toBe(422);
    }
    const bloqueado = await hector
      .put('/api/me/password')
      .send({ currentPassword: 'Hector1234', newPassword: 'NuevaClave#2026' });
    expect(bloqueado.status).toBe(429);
  });

  it('sin sesión responde 401', async () => {
    const res = await request(t.app)
      .put('/api/me/password')
      .send({ currentPassword: 'a', newPassword: 'NuevaClave#2026' });
    expect(res.status).toBe(401);
  });
});
