import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { entrarComo, type Agente } from './helpers/sesion.js';
import { prepararApp, type TestApp } from './helpers/test-app.js';

let t: TestApp;
let lucia: Agente;
beforeAll(async () => {
  t = await prepararApp();
  lucia = await entrarComo(t.app, 'lucia');
});
afterAll(() => t.pool.end());

const esPdf = (res: request.Response) => {
  expect(res.status).toBe(200);
  expect(res.headers['content-type']).toBe('application/pdf');
  expect(res.headers['cache-control']).toBe('no-store');
  expect((res.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
};

const pdf = (agente: Agente | ReturnType<typeof request>, url: string) =>
  agente
    .get(url)
    .buffer(true)
    .parse((res, callback) => {
      const trozos: Buffer[] = [];
      res.on('data', (trozo: Buffer) => trozos.push(trozo));
      res.on('end', () => callback(null, Buffer.concat(trozos)));
    });

describe('CU-22 Descargar el certificado de adopción', () => {
  it('3: genera el PDF de una adopción activa propia, con el nombre certificado-<animal>.pdf', async () => {
    const res = await pdf(lucia, '/api/me/adoptions/1/certificate?download=1');
    esPdf(res);
    expect(res.headers['content-disposition']).toBe('attachment; filename="certificado-rufo.pdf"');
  });

  it('sin «download» se abre en el navegador (para verlo o imprimirlo)', async () => {
    const res = await pdf(lucia, '/api/me/adoptions/1/certificate');
    esPdf(res);
    expect(res.headers['content-disposition']).toBe('inline; filename="certificado-rufo.pdf"');
  });

  it('1a: con la adopción pausada no hay certificado', async () => {
    await t.pool.query("UPDATE adoptions SET status = 'paused' WHERE id = 1");
    try {
      const res = await lucia.get('/api/me/adoptions/1/certificate');
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('CERTIFICATE_NOT_AVAILABLE');
    } finally {
      await t.pool.query("UPDATE adoptions SET status = 'active' WHERE id = 1");
    }
  });

  it('una adopción ajena es 404; sin sesión 401; un trabajador 403', async () => {
    const ajena = await t.pool.query<{ id: number }>(
      "SELECT ad.id FROM adoptions ad JOIN users u ON u.id = ad.user_id WHERE u.email <> 'lucia.martinez@correo.test' AND ad.status = 'active' LIMIT 1",
    );
    expect((await lucia.get(`/api/me/adoptions/${ajena.rows[0]!.id}/certificate`)).status).toBe(404);
    expect((await request(t.app).get('/api/me/adoptions/1/certificate')).status).toBe(401);
    const nuria = await entrarComo(t.app, 'nuria');
    expect((await nuria.get('/api/me/adoptions/1/certificate')).status).toBe(403);
  });

  it('2a: sin foto de portada (o sin el archivo) el PDF se genera igualmente', async () => {
    await t.pool.query('UPDATE animals SET cover_photo_id = NULL WHERE id = 1');
    esPdf(await pdf(lucia, '/api/me/adoptions/1/certificate'));
  });
});

describe('CU-19 Recibos en PDF', () => {
  /** Una cuota cobrada de Lucía y su referencia (la de su recibo). */
  const idPago = async (adoptionId: number, status: string) => {
    const { rows } = await t.pool.query<{ id: number }>(
      'SELECT id FROM payments WHERE adoption_id = $1 AND status = $2 ORDER BY id LIMIT 1',
      [adoptionId, status],
    );
    const id = rows[0]!.id;
    const { body } = await lucia.get(`/api/me/payments/${id}/receipt`);
    return { id, reference: body.reference as string };
  };

  it('5: el recibo de una cuota cobrada se descarga como recibo-<referencia>.pdf', async () => {
    const pago = await idPago(1, 'completed');
    const res = await pdf(lucia, `/api/me/payments/${pago.id}/receipt.pdf?download=1`);
    esPdf(res);
    expect(res.headers['content-disposition']).toBe(
      `attachment; filename="recibo-${pago.reference.toLowerCase()}.pdf"`,
    );
    const ver = await pdf(lucia, `/api/me/payments/${pago.id}/receipt.pdf`);
    expect(ver.headers['content-disposition']).toMatch(/^inline; /);
  });

  it('5: el recibo de una donación', async () => {
    const res = await pdf(lucia, '/api/me/donations/1/receipt.pdf?download=1');
    esPdf(res);
    expect(res.headers['content-disposition']).toBe('attachment; filename="recibo-card-d0001.pdf"');
  });

  it('4a: sin cobrar no hay recibo (422); uno ajeno es 404; un valor de «download» no válido es 400', async () => {
    const irene = request.agent(t.app);
    await irene.post('/api/auth/login').send({ email: 'irene.dominguez@correo.test', password: 'Irene2025ok' });
    expect((await irene.get('/api/me/donations/10/receipt.pdf')).status).toBe(422);
    expect((await lucia.get('/api/me/donations/5/receipt.pdf')).status).toBe(404);
    expect((await lucia.get('/api/me/donations/1/receipt.pdf?download=si')).status).toBe(400);
    expect((await request(t.app).get('/api/me/donations/1/receipt.pdf')).status).toBe(401);
    expect((await request(t.app).get('/api/me/payments/1/receipt.pdf')).status).toBe(401);
  });
});
