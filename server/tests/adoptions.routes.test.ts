import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { periodoCuota, sumarMeses } from '../src/dominio/adopcion.js';
import { prepararApp, type TestApp } from './helpers/test-app.js';

let t: TestApp;
beforeAll(async () => {
  t = await prepararApp();
});
afterAll(() => t.pool.end());
beforeEach(() => {
  t.mailer.outbox.length = 0;
});

type Agent = ReturnType<typeof request.agent>;
const sesiones = new Map<string, Agent>();
const CLAVES: Record<string, string> = {
  'lucia.martinez@correo.test': 'Lucia.buitres1',
  'elena.rubio@correo.test': 'elenita_88',
  'irene.dominguez@correo.test': 'Irene2025ok',
  'hector.benet@correo.test': 'Hector1234',
  'raquel.font@correo.test': 'RaquelFont!',
  'sergio.llorens@correo.test': 'Sergio#Vuela7',
  'adrian.moreno@correo.test': 'Adrian_99',
  'nuria.peris@santuario.test': 'NuriaPeris26#!',
};

/** Agente con la sesión iniciada (se reutiliza para no gastar intentos de login). */
async function como(email: string): Promise<Agent> {
  const existente = sesiones.get(email);
  if (existente) return existente;
  const agent = request.agent(t.app);
  const res = await agent.post('/api/auth/login').send({ email, password: CLAVES[email] });
  expect(res.status).toBe(200);
  sesiones.set(email, agent);
  return agent;
}

const adoptar = async (email: string, animalId: number, planId = 2) =>
  (await como(email)).post('/api/adoptions').send({ animalId, planId });
const pagar = async (email: string, adoptionId: number, simulatedOutcome?: 'success' | 'failure') =>
  (await como(email)).post(`/api/me/adoptions/${adoptionId}/pay`).send(simulatedOutcome ? { simulatedOutcome } : {});

const pagosDe = async (adoptionId: number) =>
  (
    await t.pool.query(
      'SELECT status, amount, period_start, period_end, failure_reason, paid_at, method, payment_reference FROM payments WHERE adoption_id = $1 ORDER BY id',
      [adoptionId],
    )
  ).rows;
const notificacionesDe = async (userId: number, type: string) =>
  (await t.pool.query('SELECT message, link FROM notifications WHERE user_id = $1 AND type = $2', [userId, type])).rows;

describe('CU-13 Adoptar un animal', () => {
  it('2: sin sesión responde 401', async () => {
    const res = await request(t.app).post('/api/adoptions').send({ animalId: 4, planId: 2 });
    expect(res.status).toBe(401);
  });

  it('2a: un trabajador no puede adoptar (RN-03)', async () => {
    const res = await adoptar('nuria.peris@santuario.test', 4);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatchObject({
      code: 'WORKER_CANNOT_ADOPT',
      message: 'Las cuentas de trabajador no pueden adoptar.',
    });
  });

  it('2b: con el email sin verificar no puede adoptar (RN-21)', async () => {
    const res = await adoptar('adrian.moreno@correo.test', 4);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('5-8: crea la adopción pendiente y, con el pago correcto, la activa', async () => {
    const adoptantesAntes: number = (await request(t.app).get('/api/animals/4')).body.adopterCount;
    const creada = await adoptar('raquel.font@correo.test', 4);
    expect(creada.status).toBe(201);
    expect(creada.body).toEqual({
      id: expect.any(Number),
      status: 'pending',
      animal: { id: 4, name: 'Olmo' },
      plan: { id: 2, name: 'Usual', monthlyAmount: '5.00' },
      startDate: null,
      nextBillingDate: null,
      createdAt: expect.any(String),
      canPay: true,
    });
    const id: number = creada.body.id;
    expect(await pagosDe(id)).toEqual([]);

    const res = await pagar('raquel.font@correo.test', id, 'success');
    expect(res.status).toBe(200);
    const periodo = periodoCuota(t.hoy);
    expect(res.body.adoption).toMatchObject({
      id,
      status: 'active',
      startDate: t.hoy,
      nextBillingDate: periodo.nextBillingDate,
      canPay: false,
    });
    expect(res.body.payment).toEqual({
      id: expect.any(Number),
      status: 'completed',
      amount: '5.00',
      periodStart: t.hoy,
      periodEnd: periodo.periodEnd,
      failureReason: null,
    });

    const [pago] = await pagosDe(id);
    expect(pago).toMatchObject({ method: 'simulated', paid_at: t.reloj.ahora() });
    expect(pago.payment_reference).toMatch(/^SIM-\d{8}-[0-9A-F]{10}$/);

    // TEST_DATA.sql ya trae la bienvenida de su adopción anterior.
    expect(await notificacionesDe(12, 'adoption_welcome')).toContainEqual({
      message: '¡Ya adoptas a Olmo! Gracias por tu apoyo.',
      link: '/my-animals/4',
    });
    expect(t.mailer.outbox).toHaveLength(1);
    expect(t.mailer.outbox[0]).toMatchObject({ to: 'raquel.font@correo.test', subject: '¡Ya adoptas a Olmo!' });
    expect(t.mailer.outbox[0]?.text).toContain(pago.payment_reference);

    // El animal suma un adoptante activo.
    expect((await request(t.app).get('/api/animals/4')).body.adopterCount).toBe(adoptantesAntes + 1);
  });

  it('sin resultado pedido, decide el modo configurado (always_succeed en las pruebas)', async () => {
    const creada = await adoptar('sergio.llorens@correo.test', 2, 1);
    const res = await pagar('sergio.llorens@correo.test', creada.body.id);
    expect(res.body.payment).toMatchObject({ status: 'completed', amount: '1.00' });
  });

  it('6a: el pago fallido se guarda y la adopción sigue pendiente; después se puede reintentar', async () => {
    const creada = await adoptar('raquel.font@correo.test', 5, 3);
    const id: number = creada.body.id;

    const fallo = await pagar('raquel.font@correo.test', id, 'failure');
    expect(fallo.status).toBe(200);
    expect(fallo.body.adoption).toMatchObject({ status: 'pending', canPay: true });
    expect(fallo.body.payment).toMatchObject({
      status: 'failed',
      amount: '12.00',
      failureReason: 'Pago rechazado por la pasarela simulada.',
    });
    expect(t.mailer.outbox).toHaveLength(0);

    const exito = await pagar('raquel.font@correo.test', id, 'success');
    expect(exito.body.adoption.status).toBe('active');
    expect((await pagosDe(id)).map((p) => p.status)).toEqual(['failed', 'completed']);
  });

  it('6b: si abandona el pago, la adopción queda pendiente y aparece en sus adopciones', async () => {
    const creada = await adoptar('lucia.martinez@correo.test', 6);
    const res = await (await como('lucia.martinez@correo.test')).get('/api/me/adoptions').query({ animalId: 6 });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([expect.objectContaining({ id: creada.body.id, status: 'pending', canPay: true })]);
  });

  it('5a: ya tiene una adopción abierta de ese animal (RN-05)', async () => {
    const activa = await adoptar('lucia.martinez@correo.test', 1);
    expect(activa.status).toBe(409);
    expect(activa.body.error).toMatchObject({
      code: 'ADOPTION_ALREADY_OPEN',
      message: 'Ya tienes una adopción en curso de Rufo.',
    });
    // También con una pendiente (la de Canelo del caso anterior).
    expect((await adoptar('lucia.martinez@correo.test', 6)).status).toBe(409);
  });

  it('5b: el animal no admite adopciones', async () => {
    const res = await adoptar('lucia.martinez@correo.test', 15);
    expect(res.status).toBe(422);
    expect(res.body.error).toMatchObject({
      code: 'ANIMAL_NOT_ADOPTABLE',
      message: 'Este animal ya no admite adopciones.',
    });
  });

  it('un animal sin publicar, fallecido o inexistente no está disponible (404)', async () => {
    for (const animalId of [14, 12, 999]) {
      const res = await adoptar('lucia.martinez@correo.test', animalId);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('ANIMAL_NOT_AVAILABLE');
    }
  });

  it('5c: el plan elegido ya no está activo', async () => {
    await t.pool.query('UPDATE adoption_plans SET is_active = FALSE WHERE id = 3');
    for (const planId of [3, 99]) {
      const res = await adoptar('lucia.martinez@correo.test', 7, planId);
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('PLAN_NOT_AVAILABLE');
    }
    await t.pool.query('UPDATE adoption_plans SET is_active = TRUE WHERE id = 3');
  });

  it('valida los datos', async () => {
    const res = await (await como('lucia.martinez@correo.test')).post('/api/adoptions').send({ animalId: 'Rufo' });
    expect(res.status).toBe(400);
  });

  it('si falla el email de bienvenida, la adopción queda activa igualmente', async () => {
    const creada = await adoptar('irene.dominguez@correo.test', 7);
    t.mailer.failNext = true;
    const res = await pagar('irene.dominguez@correo.test', creada.body.id, 'success');
    expect(res.status).toBe(200);
    expect(res.body.adoption.status).toBe('active');
  });
});

describe('CU-14 Reintentar el pago de una adopción', () => {
  it('paga una adopción pendiente reciente (Irene con Brisa)', async () => {
    const res = await pagar('irene.dominguez@correo.test', 11, 'success');
    expect(res.status).toBe(200);
    expect(res.body.adoption).toMatchObject({ id: 11, status: 'active', startDate: t.hoy });
  });

  it('1a: una pendiente de hace más de 7 días ya no se puede pagar', async () => {
    const res = await pagar('hector.benet@correo.test', 12, 'success');
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('ADOPTION_PAYMENT_EXPIRED');
    expect(await pagosDe(12)).toEqual([]);
  });

  it('una pausada cobra el periodo pendiente y avanza el siguiente cobro (Elena con Lupe)', async () => {
    const { rows } = await t.pool.query<{ next_billing_date: string; start_date: string }>(
      'SELECT next_billing_date, start_date FROM adoptions WHERE id = 7',
    );
    const pendiente = rows[0]!.next_billing_date;

    const res = await pagar('elena.rubio@correo.test', 7, 'success');
    expect(res.status).toBe(200);
    expect(res.body.adoption).toMatchObject({
      status: 'active',
      startDate: rows[0]!.start_date,
      nextBillingDate: sumarMeses(pendiente, 1),
    });
    expect(res.body.payment).toMatchObject({ status: 'completed', periodStart: pendiente });
    expect(await notificacionesDe(8, 'payment_completed')).toEqual([
      { message: 'Hemos cobrado la cuota de Lupe. ¡Gracias!', link: '/my-animals/11' },
    ]);
    expect(t.mailer.outbox[0]).toMatchObject({ to: 'elena.rubio@correo.test', subject: 'Cuota cobrada: Lupe' });
  });

  it('3a: un pago fallido no cambia el estado', async () => {
    await t.pool.query("UPDATE adoptions SET status = 'paused' WHERE id = 6");
    const res = await pagar('elena.rubio@correo.test', 6, 'failure');
    expect(res.body).toMatchObject({ adoption: { status: 'paused' }, payment: { status: 'failed' } });
  });

  it('una adopción de otra persona no existe (404)', async () => {
    const res = await pagar('lucia.martinez@correo.test', 6, 'success');
    expect(res.status).toBe(404);
  });

  it('una adopción activa no tiene nada que pagar', async () => {
    const res = await pagar('lucia.martinez@correo.test', 1, 'success');
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('ADOPTION_NOT_PAYABLE');
  });

  it('4a: una adopción cerrada (el animal falleció) lo indica', async () => {
    const res = await pagar('lucia.martinez@correo.test', 3, 'success');
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('ADOPTION_CLOSED');
  });

  it('si el animal dejó de ser adoptable, la pendiente no se puede pagar', async () => {
    const creada = await adoptar('sergio.llorens@correo.test', 9);
    await t.pool.query('UPDATE animals SET is_adoptable = FALSE WHERE id = 9');
    const res = await pagar('sergio.llorens@correo.test', creada.body.id, 'success');
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('ANIMAL_NOT_ADOPTABLE');
    await t.pool.query('UPDATE animals SET is_adoptable = TRUE WHERE id = 9');
  });

  it('sin sesión 401, trabajador 403 y resultado no válido 400', async () => {
    expect((await request(t.app).post('/api/me/adoptions/11/pay').send({})).status).toBe(401);
    expect((await pagar('nuria.peris@santuario.test', 11)).status).toBe(403);
    const res = await (
      await como('irene.dominguez@correo.test')
    )
      .post('/api/me/adoptions/11/pay')
      .send({ simulatedOutcome: 'quizas' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/me/adoptions', () => {
  it('lista solo las adopciones propias, con si se pueden pagar', async () => {
    const res = await (await como('hector.benet@correo.test')).get('/api/me/adoptions');
    expect(res.status).toBe(200);
    expect(
      res.body.data.map((a: { id: number; status: string; canPay: boolean }) => [a.id, a.status, a.canPay]),
    ).toEqual([
      [12, 'pending', false],
      [13, 'cancelled', false],
    ]);
  });

  it('sin sesión 401 y trabajadores 403', async () => {
    expect((await request(t.app).get('/api/me/adoptions')).status).toBe(401);
    expect((await (await como('nuria.peris@santuario.test')).get('/api/me/adoptions')).status).toBe(403);
  });
});
