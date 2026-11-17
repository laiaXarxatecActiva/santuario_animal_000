import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createErrorHandler } from '../src/middlewares/error-handler.js';
import { createRequireSameOrigin } from '../src/middlewares/require-same-origin.js';

function app() {
  const a = express();
  a.use(createRequireSameOrigin(['http://localhost:5173']));
  a.all('/', (_req, res) => {
    res.json({ ok: true });
  });
  a.use(createErrorHandler({ logError: () => {} }));
  return a;
}

describe('requireSameOrigin (TECH_SPEC §13, CSRF)', () => {
  it('deja pasar las lecturas aunque vengan de otro origen', async () => {
    const res = await request(app()).get('/').set('Origin', 'https://malicioso.test');
    expect(res.status).toBe(200);
  });

  it('acepta las modificaciones desde el origen del cliente', async () => {
    for (const metodo of ['post', 'put', 'patch', 'delete'] as const) {
      const res = await request(app())[metodo]('/').set('Origin', 'http://localhost:5173');
      expect(res.status).toBe(200);
    }
  });

  it('acepta las modificaciones sin cabecera Origin (clientes que no son navegadores)', async () => {
    expect((await request(app()).post('/')).status).toBe(200);
  });

  it('rechaza con 403 las modificaciones desde otro origen', async () => {
    for (const origen of ['https://malicioso.test', 'http://localhost:5174', 'null']) {
      const res = await request(app()).post('/').set('Origin', origen);
      expect(res.status).toBe(403);
      expect(res.body.error).toMatchObject({
        code: 'ORIGIN_NOT_ALLOWED',
        message: 'La petición no procede de la web del santuario.',
      });
    }
  });

  it('rechaza las modificaciones que el navegador marca como de otro sitio', async () => {
    const res = await request(app()).post('/').set('Sec-Fetch-Site', 'cross-site');
    expect(res.status).toBe(403);
    expect((await request(app()).post('/').set('Sec-Fetch-Site', 'same-origin')).status).toBe(200);
  });
});
