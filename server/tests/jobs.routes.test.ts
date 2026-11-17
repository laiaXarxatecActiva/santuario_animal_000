import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { entrarComo } from './helpers/sesion.js';
import { prepararApp, type TestApp } from './helpers/test-app.js';

let t: TestApp;
beforeAll(async () => {
  t = await prepararApp();
});
afterAll(() => t.pool.end());

describe('POST /api/admin/jobs/:jobName/run (CU-43 a CU-45)', () => {
  it('sin sesión 401; adoptante y cuidadora 403', async () => {
    expect((await request(t.app).post('/api/admin/jobs/billing/run').send({})).status).toBe(401);
    expect((await (await entrarComo(t.app, 'lucia')).post('/api/admin/jobs/billing/run').send({})).status).toBe(403);
    expect((await (await entrarComo(t.app, 'nuria')).post('/api/admin/jobs/billing/run').send({})).status).toBe(403);
  });

  it('una administradora la lanza y recibe el resumen', async () => {
    const marta = await entrarComo(t.app, 'marta');
    const res = await marta.post('/api/admin/jobs/expire-pending/run').send({});
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ job: 'expire-pending', result: { cancelled: 1, expiredTokensDeleted: 0 } });
    const { rows } = await t.pool.query('SELECT status FROM adoptions WHERE id = 12');
    expect(rows[0].status).toBe('cancelled');
  });

  it('una tarea desconocida responde 404', async () => {
    const marta = await entrarComo(t.app, 'marta');
    const res = await marta.post('/api/admin/jobs/no-existe/run').send({});
    expect(res.status).toBe(404);
  });
});
