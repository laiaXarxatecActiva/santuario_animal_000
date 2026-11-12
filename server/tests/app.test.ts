import request from 'supertest';
import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { createApp, type AppOptions } from '../src/app.js';
import { createPool } from '../src/db/pool.js';
import { relojFijo } from '../src/dominio/reloj.js';
import { createLogger } from '../src/utils/logger.js';
import { opcionesDePrueba } from './helpers/test-app.js';
import { testDatabaseUrl } from './helpers/test-db.js';

// El pool no se conecta hasta la primera consulta; estas pruebas no la hacen.
const base: AppOptions = {
  db: createPool(testDatabaseUrl()),
  reloj: relojFijo('2026-11-12T12:00:00Z'),
  ...opcionesDePrueba(),
};

describe('app', () => {
  const app = createApp({ ...base, logError: () => {} });

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

  it('sirve los archivos subidos en /uploads', async () => {
    const res = await request(app).get('/uploads/seedsql.sql');
    expect(res.status).toBe(200);
  });

  it('un archivo subido que no existe responde 404 en el formato estándar', async () => {
    const res = await request(app).get('/uploads/animals/99/no-existe.jpg');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('no permite salir de la carpeta de archivos subidos', async () => {
    const res = await request(app).get('/uploads/..%2F..%2Fpackage.json');
    expect([403, 404]).toContain(res.status);
    expect(res.text).not.toContain('workspaces');
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
    const app = createApp({ ...base, logger: createLogger('development', stream) });

    await request(app).get('/api/health').set('Cookie', 'sid=secreto');

    expect(lineas).toHaveLength(1);
    expect(JSON.parse(lineas[0] ?? '{}')).toMatchObject({
      req: { method: 'GET', url: '/api/health' },
      res: { statusCode: 200 },
    });
    expect(lineas[0]).not.toContain('secreto');
  });
});
