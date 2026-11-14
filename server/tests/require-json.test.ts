import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createErrorHandler } from '../src/middlewares/error-handler.js';
import { requireJson } from '../src/middlewares/require-json.js';

function app() {
  const a = express();
  a.use(requireJson);
  a.all('/', (_req, res) => {
    res.json({ ok: true });
  });
  a.use(createErrorHandler({ logError: () => {} }));
  return a;
}

describe('requireJson (TECH_SPEC §13, CSRF)', () => {
  it('deja pasar las lecturas sin cuerpo', async () => {
    expect((await request(app()).get('/')).status).toBe(200);
    expect((await request(app()).head('/')).status).toBe(200);
  });

  it('acepta las modificaciones en JSON', async () => {
    for (const metodo of ['post', 'put', 'patch', 'delete'] as const) {
      expect((await request(app())[metodo]('/').send({})).status).toBe(200);
    }
    const conCharset = await request(app()).post('/').set('Content-Type', 'application/json; charset=utf-8').send('{}');
    expect(conCharset.status).toBe(200);
  });

  it('rechaza formularios, texto y peticiones sin tipo con 415', async () => {
    expect((await request(app()).post('/').type('form').send('a=1')).status).toBe(415);
    expect((await request(app()).post('/').set('Content-Type', 'text/plain').send('hola')).status).toBe(415);
    const sinTipo = await request(app()).post('/');
    expect(sinTipo.status).toBe(415);
    expect(sinTipo.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });
});

describe('requireJson: subidas multipart (CU-29, TECH_SPEC §13)', () => {
  it('acepta multipart solo con la cabecera X-Requested-With', async () => {
    const conCabecera = await request(app())
      .post('/')
      .set('X-Requested-With', 'XMLHttpRequest')
      .attach('files', Buffer.from('x'), 'a.jpg');
    expect(conCabecera.status).toBe(200);
    const sinCabecera = await request(app()).post('/').attach('files', Buffer.from('x'), 'a.jpg');
    expect(sinCabecera.status).toBe(415);
  });
});
