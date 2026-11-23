import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { entrarComo } from './helpers/sesion.js';
import { prepararApp, type TestApp } from './helpers/test-app.js';

let t: TestApp;
beforeAll(async () => {
  t = await prepararApp();
});
afterAll(() => t.pool.end());

describe('Fase 3 Idioma preferido (preferred_language)', () => {
  it('la sesión y el perfil indican el idioma; por defecto, castellano', async () => {
    const lucia = await entrarComo(t.app, 'lucia');
    expect((await lucia.get('/api/auth/me')).body.user.preferredLanguage).toBe('es');
    expect((await lucia.get('/api/me/profile')).body.preferredLanguage).toBe('es');
  });

  it('CU-23: el usuario lo cambia en su perfil y la sesión lo refleja', async () => {
    const lucia = await entrarComo(t.app, 'lucia');
    const res = await lucia.patch('/api/me/profile').send({ preferredLanguage: 'ca' });
    expect(res.status).toBe(200);
    expect(res.body.preferredLanguage).toBe('ca');
    expect((await lucia.get('/api/auth/me')).body.user.preferredLanguage).toBe('ca');
  });

  it('también los trabajadores', async () => {
    const nuria = await entrarComo(t.app, 'nuria');
    const res = await nuria.patch('/api/me/profile').send({ preferredLanguage: 'en' });
    expect(res.status).toBe(200);
    expect(res.body.preferredLanguage).toBe('en');
  });

  it('solo admite es, ca y en', async () => {
    const lucia = await entrarComo(t.app, 'lucia');
    const res = await lucia.patch('/api/me/profile').send({ preferredLanguage: 'fr' });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('preferredLanguage');
  });

  it('CU-07: el registro guarda el idioma con el que se usaba la web', async () => {
    const res = await request(t.app).post('/api/auth/register').send({
      firstName: 'Jordi',
      lastName: 'Mas Vidal',
      email: 'jordi.mas@correo.test',
      password: 'voltors-2026',
      passwordConfirm: 'voltors-2026',
      privacyAccepted: true,
      preferredLanguage: 'ca',
    });
    expect(res.status).toBe(202);
    const { rows } = await t.pool.query<{ preferred_language: string }>(
      "SELECT preferred_language FROM users WHERE email = 'jordi.mas@correo.test'",
    );
    expect(rows[0]?.preferred_language).toBe('ca');
  });
});

describe('Fase 3 Emails y avisos en el idioma de cada persona', () => {
  const ultimo = (to: string) => t.mailer.outbox.filter((m) => m.to === to).at(-1);

  it('CU-07: el email de verificación sale en el idioma del registro', () => {
    expect(ultimo('jordi.mas@correo.test')?.subject).toBe('Verifica el teu correu');
  });

  it('CU-10: la recuperación de la contraseña sale en el idioma del perfil', async () => {
    const lucia = await entrarComo(t.app, 'lucia');
    await lucia.patch('/api/me/profile').send({ preferredLanguage: 'en' });
    await request(t.app).post('/api/auth/forgot-password').send({ email: 'lucia.martinez@correo.test' });
    expect(ultimo('lucia.martinez@correo.test')?.subject).toBe('Reset your password');
  });

  it('CU-05: el agradecimiento de una donación y el aviso de la campana, en su idioma', async () => {
    const lucia = await entrarComo(t.app, 'lucia');
    await lucia.patch('/api/me/profile').send({ preferredLanguage: 'en' });
    const donante = { donorName: 'Lucía', donorSurname: 'Martínez', acceptPrivacy: true };
    expect(
      (await lucia.post('/api/donations').send({ ...donante, donorEmail: 'lucia.martinez@correo.test', amount: '10' }))
        .status,
    ).toBe(201);
    const email = ultimo('lucia.martinez@correo.test');
    expect(email?.subject).toBe('Thank you for your donation!');
    expect(email?.text).toContain('Amount: €10.00');
    const avisos = (await lucia.get('/api/me/notifications')).body.data as { message: string }[];
    expect(avisos[0]?.message).toBe('Thank you for your donation of €10.00.');
  });

  it('CU-05: sin cuenta, el agradecimiento sale en el idioma de la web al donar', async () => {
    const res = await request(t.app).post('/api/donations').send({
      donorName: 'Jordi',
      donorSurname: 'Puig',
      acceptPrivacy: true,
      amount: '5',
      donorEmail: 'anonim@correo.test',
      language: 'ca',
    });
    expect(res.status).toBe(201);
    expect(ultimo('anonim@correo.test')?.subject).toBe('Gràcies per la teua donació!');
  });

  it('CU-31: cada adoptante recibe el aviso de una actualización en su idioma', async () => {
    const lucia = await entrarComo(t.app, 'lucia');
    await lucia.patch('/api/me/profile').send({ preferredLanguage: 'ca' });
    const { rows } = await t.pool.query<{ animal_id: number }>(
      "SELECT animal_id FROM adoptions WHERE user_id = 6 AND status = 'active' ORDER BY id LIMIT 1",
    );
    const animalId = rows[0]!.animal_id;
    const nuria = await entrarComo(t.app, 'nuria');
    const res = await nuria
      .post('/api/admin/updates')
      .set('X-Requested-With', 'XMLHttpRequest')
      .field('animalId', String(animalId))
      .field('title', 'Prova')
      .field('body', 'Text de la prova')
      .field('meta', '[]');
    expect(res.status).toBe(201);
    const avisos = (await lucia.get('/api/me/notifications')).body.data as { message: string }[];
    expect(avisos[0]?.message).toMatch(/^Nova actualització de .+: «Prova»\.$/);
  });
});
