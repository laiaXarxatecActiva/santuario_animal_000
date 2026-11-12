import request from 'supertest';
import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createLogger } from '../src/utils/logger.js';

describe('app', () => {
  const app = createApp({ logError: () => {} });

  it('GET /api/health responde que el servidor está en marcha', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('una ruta de la API inexistente responde 404 en el formato estándar', async () => {
    const res = await request(app).get('/api/no-existe');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'No encontrado.', details: [] } });
  });

  it('no revela que usa Express', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('app con logger', () => {
  it('registra cada petición sin la cookie de sesión', async () => {
    const lineas: string[] = [];
    const stream = new Writable({
      write(chunk: Buffer, _enc, done) {
        lineas.push(chunk.toString());
        done();
      },
    });
    const app = createApp({ logger: createLogger('development', stream) });

    await request(app).get('/api/health').set('Cookie', 'sid=secreto');

    expect(lineas).toHaveLength(1);
    expect(JSON.parse(lineas[0] ?? '{}')).toMatchObject({
      req: { method: 'GET', url: '/api/health' },
      res: { statusCode: 200 },
    });
    expect(lineas[0]).not.toContain('secreto');
  });
});
