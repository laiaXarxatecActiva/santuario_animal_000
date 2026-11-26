import type { DonationResultDto } from '@sanctuary/shared';
import type { Express } from 'express';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { entrarComo } from './helpers/sesion.js';
import { opcionesDePrueba, prepararApp, type TestApp } from './helpers/test-app.js';

let t: TestApp;
beforeAll(async () => {
  t = await prepararApp();
});
afterAll(() => t.pool.end());
beforeEach(() => {
  t.mailer.outbox.length = 0;
});

/** Datos obligatorios del donante (CU-05 paso 2). */
const DONANTE = {
  donorName: 'Marta',
  donorSurname: 'Soler Ruiz',
  donorEmail: 'marta@correo.test',
  acceptPrivacy: true,
};

const donacion = async (id: number) =>
  (
    await t.pool.query(
      `SELECT user_id, donor_name, donor_email, amount, is_anonymous, message, status,
              payment_reference, failure_reason, paid_at IS NOT NULL AS pagada
         FROM donations WHERE id = $1`,
      [id],
    )
  ).rows[0];

describe('CU-05 Hacer una donación', () => {
  it('6-7: un visitante dona sin cuenta: se cobra, se guarda y recibe el email con el recibo', async () => {
    const res = await request(t.app)
      .post('/api/donations')
      .send({
        ...DONANTE,
        amount: '12.5',
        message: 'Para la comida',
        simulatedOutcome: 'success',
      });
    expect(res.status).toBe(201);
    const resultado = res.body as DonationResultDto;
    expect(resultado).toEqual({
      id: expect.any(Number),
      status: 'completed',
      amount: '12.50',
      method: 'card',
      reference: expect.stringMatching(/^CARD-/),
      paidAt: expect.any(String),
      failureReason: null,
      donorName: 'Marta',
      donorSurname: 'Soler Ruiz',
      donorEmail: 'marta@correo.test',
      isAnonymous: false,
      receiptToken: expect.any(String),
    });
    expect(await donacion(resultado.id)).toEqual({
      user_id: null,
      donor_name: 'Marta',
      donor_email: 'marta@correo.test',
      amount: '12.50',
      is_anonymous: false,
      message: 'Para la comida',
      status: 'completed',
      payment_reference: resultado.reference,
      failure_reason: null,
      pagada: true,
    });
    expect(t.mailer.outbox.map((m) => [m.to, m.subject])).toEqual([['marta@correo.test', '¡Gracias por tu donación!']]);
    expect(t.mailer.outbox[0]?.text).toContain(resultado.reference);
    expect(t.mailer.outbox[0]?.text).toMatch(/12,50\s€/);
  });

  it('7a: sin email no se acepta la donación; anónima y sin mínimo, con email, sí', async () => {
    const sinEmail = await request(t.app)
      .post('/api/donations')
      .send({ ...DONANTE, donorEmail: undefined, amount: '0.50', isAnonymous: true });
    expect(sinEmail.status).toBe(400);
    expect(sinEmail.body.error.details).toContainEqual(expect.objectContaining({ field: 'donorEmail' }));
    expect(t.mailer.outbox).toHaveLength(0);

    const res = await request(t.app)
      .post('/api/donations')
      .send({ ...DONANTE, amount: '0.50', isAnonymous: true });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'completed', amount: '0.50', isAnonymous: true });
    expect(t.mailer.outbox.map((m) => m.to)).toEqual(['marta@correo.test']);
  });

  it('5a: un pago fallido se guarda como failed y otro intento crea otra donación', async () => {
    const fallo = await request(t.app)
      .post('/api/donations')
      .send({ ...DONANTE, amount: '10', donorEmail: 'marcos@correo.test', simulatedOutcome: 'failure' });
    expect(fallo.status).toBe(201);
    expect(fallo.body).toMatchObject({ status: 'failed', paidAt: null, failureReason: expect.any(String) });
    expect((await donacion(fallo.body.id)).status).toBe('failed');
    expect(t.mailer.outbox).toHaveLength(0);

    const reintento = await request(t.app)
      .post('/api/donations')
      .send({ ...DONANTE, amount: '10', donorEmail: 'marcos@correo.test', simulatedOutcome: 'success' });
    expect(reintento.body.status).toBe('completed');
    expect(reintento.body.id).not.toBe(fallo.body.id);
  });

  it('8: un adoptante: se vincula a su cuenta, usa su email, recibe la notificación y sale en sus aportaciones', async () => {
    const lucia = await entrarComo(t.app, 'lucia');
    const res = await lucia.post('/api/donations').send({
      ...DONANTE,
      donorName: 'Lucía',
      donorSurname: 'Martínez',
      donorEmail: 'lucia.martinez@correo.test',
      amount: '7',
      simulatedOutcome: 'success',
    });
    expect(res.status).toBe(201);
    expect(await donacion(res.body.id)).toMatchObject({ user_id: 6, donor_email: 'lucia.martinez@correo.test' });
    expect(t.mailer.outbox.map((m) => m.to)).toEqual(['lucia.martinez@correo.test']);
    const { rows } = await t.pool.query(
      "SELECT message FROM notifications WHERE user_id = 6 AND type = 'donation_thanks' ORDER BY id DESC LIMIT 1",
    );
    expect(rows[0]?.message).toMatch(/7,00\s€/);
    const aportaciones = await lucia.get('/api/me/contributions');
    expect(aportaciones.body.donations.map((d: { id: number }) => d.id)).toContain(res.body.id);
  });

  it('6a: con sesión de trabajador la donación no se vincula a su cuenta (RN-03)', async () => {
    const nuria = await entrarComo(t.app, 'nuria');
    const res = await nuria.post('/api/donations').send({ ...DONANTE, amount: '3', simulatedOutcome: 'success' });
    expect(res.status).toBe(201);
    expect((await donacion(res.body.id)).user_id).toBeNull();
  });

  it('3a, 3b: importe o email no válidos responden 400 con el campo', async () => {
    const cero = await request(t.app)
      .post('/api/donations')
      .send({ ...DONANTE, amount: '0' });
    expect(cero.status).toBe(400);
    expect(cero.body.error.details).toContainEqual(expect.objectContaining({ field: 'amount' }));
    const email = await request(t.app)
      .post('/api/donations')
      .send({ ...DONANTE, amount: '5', donorEmail: 'x' });
    expect(email.status).toBe(400);
    expect(email.body.error.details).toContainEqual(expect.objectContaining({ field: 'donorEmail' }));
  });

  it('como mucho 10 donaciones por hora desde una IP (cada una puede enviar un email)', async () => {
    let estado = 0;
    for (let i = 0; i < 11 && estado !== 429; i++) {
      estado = (
        await request(t.app)
          .post('/api/donations')
          .send({ ...DONANTE, amount: '1' })
      ).status;
    }
    expect(estado).toBe(429);
  });
});

describe('CU-05 Datos del donante y recibo sin cuenta', () => {
  // App propia: el límite de donaciones por IP de la app común ya se ha gastado.
  let app: Express;
  beforeAll(() => {
    app = createApp({ db: t.pool, reloj: t.reloj, ...opcionesDePrueba(t.mailer, t.reloj) });
  });
  const FISCAL = {
    taxCertificate: true,
    donorTaxId: '12345678Z',
    donorAddress: 'Calle Mayor 1',
    donorPostalCode: '46001',
    donorProvince: 'Valencia',
    donorCountry: 'España',
  };

  it('guarda apellidos, teléfono y los datos fiscales si pide el certificado', async () => {
    const res = await request(app)
      .post('/api/donations')
      .send({ ...DONANTE, ...FISCAL, amount: '30', donorPhone: '612-345-678', simulatedOutcome: 'success' });
    expect(res.status).toBe(201);
    const { rows } = await t.pool.query(
      `SELECT donor_surname, donor_phone, tax_certificate, donor_tax_id, donor_address, donor_postal_code,
              donor_province, donor_country FROM donations WHERE id = $1`,
      [res.body.id],
    );
    expect(rows[0]).toEqual({
      donor_surname: 'Soler Ruiz',
      donor_phone: '612345678',
      tax_certificate: true,
      donor_tax_id: '12345678Z',
      donor_address: 'Calle Mayor 1',
      donor_postal_code: '46001',
      donor_province: 'Valencia',
      donor_country: 'España',
    });
  });

  it('sin aceptar la privacidad o con el certificado sin NIF, 400 con el campo', async () => {
    const privacidad = await request(app)
      .post('/api/donations')
      .send({ ...DONANTE, acceptPrivacy: false, amount: '5' });
    expect(privacidad.status).toBe(400);
    expect(privacidad.body.error.details).toContainEqual(expect.objectContaining({ field: 'acceptPrivacy' }));
    const nif = await request(app)
      .post('/api/donations')
      .send({ ...DONANTE, ...FISCAL, donorTaxId: '', amount: '5' });
    expect(nif.status).toBe(400);
    expect(nif.body.error.details).toContainEqual(expect.objectContaining({ field: 'donorTaxId' }));
  });

  it('el recibo en PDF se puede ver o descargar con el token de la donación; el email lleva el enlace', async () => {
    const res = await request(app)
      .post('/api/donations')
      .send({ ...DONANTE, ...FISCAL, amount: '30', simulatedOutcome: 'success' });
    const { id, receiptToken, reference } = res.body as DonationResultDto;
    const url = `/api/donations/${id}/receipt.pdf?token=${receiptToken}`;
    expect(t.mailer.outbox[0]?.text).toContain(url);

    const ver = await request(app).get(url);
    expect(ver.status).toBe(200);
    expect(ver.headers['content-type']).toBe('application/pdf');
    expect(ver.headers['content-disposition']).toMatch(/^inline; filename=".*\.pdf"$/);
    expect(ver.headers['content-disposition']).toContain(reference.toLowerCase());
    const descarga = await request(app).get(`${url}&download=1`);
    expect(descarga.headers['content-disposition']).toMatch(/^attachment;/);
  });

  it('con un token que no es el suyo o sin token, 404', async () => {
    const a = await request(app)
      .post('/api/donations')
      .send({ ...DONANTE, amount: '2' });
    const b = await request(app)
      .post('/api/donations')
      .send({ ...DONANTE, amount: '3' });
    const tokenB = (b.body as DonationResultDto).receiptToken;
    expect((await request(app).get(`/api/donations/${a.body.id}/receipt.pdf?token=${tokenB}`)).status).toBe(404);
    expect((await request(app).get(`/api/donations/${a.body.id}/receipt.pdf?token=x`)).status).toBe(404);
    expect((await request(app).get(`/api/donations/${a.body.id}/receipt.pdf`)).status).toBe(404);
  });

  it('una donación fallida no tiene recibo', async () => {
    const res = await request(app)
      .post('/api/donations')
      .send({ ...DONANTE, amount: '2', simulatedOutcome: 'failure' });
    const { id, receiptToken } = res.body as DonationResultDto;
    expect((await request(app).get(`/api/donations/${id}/receipt.pdf?token=${receiptToken}`)).status).toBe(404);
  });
});
