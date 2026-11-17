import type { DonationResultDto } from '@sanctuary/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { entrarComo } from './helpers/sesion.js';
import { prepararApp, type TestApp } from './helpers/test-app.js';

let t: TestApp;
beforeAll(async () => {
  t = await prepararApp();
});
afterAll(() => t.pool.end());
beforeEach(() => {
  t.mailer.outbox.length = 0;
});

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
    const res = await request(t.app).post('/api/donations').send({
      amount: '12.5',
      donorName: 'Marta',
      donorEmail: 'marta@correo.test',
      message: 'Para la comida',
      simulatedOutcome: 'success',
    });
    expect(res.status).toBe(201);
    const resultado = res.body as DonationResultDto;
    expect(resultado).toEqual({
      id: expect.any(Number),
      status: 'completed',
      amount: '12.50',
      method: 'simulated',
      reference: expect.stringMatching(/^SIM-/),
      paidAt: expect.any(String),
      failureReason: null,
      donorName: 'Marta',
      donorEmail: 'marta@correo.test',
      isAnonymous: false,
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
    expect(t.mailer.outbox.map((m) => [m.to, m.subject])).toEqual([
      ['marta@correo.test', '¡Gracias por tu donación!'],
    ]);
    expect(t.mailer.outbox[0]?.text).toContain(resultado.reference);
    expect(t.mailer.outbox[0]?.text).toMatch(/12,50\s€/);
  });

  it('7a: sin email no se envía nada; anónima y sin mínimo', async () => {
    const res = await request(t.app).post('/api/donations').send({ amount: '0.50', isAnonymous: true });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'completed', amount: '0.50', isAnonymous: true, donorEmail: null });
    expect(t.mailer.outbox).toHaveLength(0);
  });

  it('5a: un pago fallido se guarda como failed y otro intento crea otra donación', async () => {
    const fallo = await request(t.app)
      .post('/api/donations')
      .send({ amount: '10', donorEmail: 'marcos@correo.test', simulatedOutcome: 'failure' });
    expect(fallo.status).toBe(201);
    expect(fallo.body).toMatchObject({ status: 'failed', paidAt: null, failureReason: expect.any(String) });
    expect((await donacion(fallo.body.id)).status).toBe('failed');
    expect(t.mailer.outbox).toHaveLength(0);

    const reintento = await request(t.app)
      .post('/api/donations')
      .send({ amount: '10', donorEmail: 'marcos@correo.test', simulatedOutcome: 'success' });
    expect(reintento.body.status).toBe('completed');
    expect(reintento.body.id).not.toBe(fallo.body.id);
  });

  it('8: un adoptante: se vincula a su cuenta, usa su email, recibe la notificación y sale en sus aportaciones', async () => {
    const lucia = await entrarComo(t.app, 'lucia');
    const res = await lucia.post('/api/donations').send({ amount: '7', simulatedOutcome: 'success' });
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
    const res = await nuria.post('/api/donations').send({ amount: '3', simulatedOutcome: 'success' });
    expect(res.status).toBe(201);
    expect((await donacion(res.body.id)).user_id).toBeNull();
  });

  it('3a, 3b: importe o email no válidos responden 400 con el campo', async () => {
    const cero = await request(t.app).post('/api/donations').send({ amount: '0' });
    expect(cero.status).toBe(400);
    expect(cero.body.error.details).toContainEqual(expect.objectContaining({ field: 'amount' }));
    const email = await request(t.app).post('/api/donations').send({ amount: '5', donorEmail: 'x' });
    expect(email.status).toBe(400);
    expect(email.body.error.details).toContainEqual(expect.objectContaining({ field: 'donorEmail' }));
  });

  it('como mucho 10 donaciones por hora desde una IP (cada una puede enviar un email)', async () => {
    let estado = 0;
    for (let i = 0; i < 11 && estado !== 429; i++) {
      estado = (await request(t.app).post('/api/donations').send({ amount: '1' })).status;
    }
    expect(estado).toBe(429);
  });
});
