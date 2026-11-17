import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prepararApp, type TestApp } from './helpers/test-app.js';

let t: TestApp;
beforeAll(async () => {
  t = await prepararApp();
});
afterAll(() => t.pool.end());
beforeEach(() => {
  t.mailer.outbox.length = 0;
});

const mensaje = {
  name: 'Ana Pérez',
  email: 'ana@correo.test',
  subject: 'Visita con un colegio',
  message: '¿Podemos visitar el santuario con una clase?',
  acceptPrivacy: true,
};
const enviar = (cuerpo: object) => request(t.app).post('/api/contact').send(cuerpo);

describe('CU-06 Enviar el formulario de contacto', () => {
  it('3-4: envía el mensaje al buzón del santuario con el email del visitante para responder', async () => {
    const res = await enviar(mensaje);
    expect(res.status).toBe(202);
    expect(res.body).toEqual({ message: 'Mensaje enviado. Te responderemos lo antes posible.' });
    expect(t.mailer.outbox).toHaveLength(1);
    const email = t.mailer.outbox[0];
    expect(email).toMatchObject({
      to: 'santuario@santuario.test',
      replyTo: 'ana@correo.test',
      subject: 'Contacto: Visita con un colegio',
    });
    for (const texto of ['Ana Pérez', 'ana@correo.test', '¿Podemos visitar el santuario con una clase?']) {
      expect(email?.text).toContain(texto);
    }
  });

  it('el mensaje no se guarda en la base de datos', async () => {
    const { rows } = await t.pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%contact%'",
    );
    expect(rows).toEqual([]);
  });

  it('3a: faltan campos o el email no es válido: 400 con los campos', async () => {
    const res = await enviar({ ...mensaje, email: 'ana', message: '' });
    expect(res.status).toBe(400);
    const campos = (res.body.error.details as { field: string }[]).map((d) => d.field);
    expect(campos).toEqual(expect.arrayContaining(['email', 'message']));
    expect(t.mailer.outbox).toHaveLength(0);
  });

  it('3c: si falla el envío, responde 503 para que el formulario conserve lo escrito', async () => {
    t.mailer.failNext = true;
    const res = await enviar(mensaje);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('EMAIL_NOT_SENT');
  });

  it('3b: más de 5 envíos por hora desde la misma IP: 429', async () => {
    let estado = 0;
    for (let i = 0; i < 6 && estado !== 429; i++) estado = (await enviar(mensaje)).status;
    expect(estado).toBe(429);
  });
});
