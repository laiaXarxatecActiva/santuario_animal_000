import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createErrorHandler } from '../src/middlewares/error-handler.js';
import { createLoginLimiter } from '../src/middlewares/rate-limit.js';

/** App mínima: el login «acierta» solo con la contraseña `buena`. */
function appDeLogin() {
  const app = express();
  app.use(express.json());
  app.post('/login', ...createLoginLimiter(), (req, res) => {
    const { password } = req.body as { password?: string };
    res.status(password === 'buena' ? 200 : 401).end();
  });
  app.use(createErrorHandler());
  return app;
}

const intento = (app: express.Express, email: string, password: string) =>
  request(app).post('/login').send({ email, password });

describe('CU-09 Límite de intentos de login', () => {
  it('3c: 5 intentos fallidos por IP y email cada 15 minutos', async () => {
    const app = appDeLogin();
    for (let i = 0; i < 5; i++) expect((await intento(app, 'ana@correo.test', 'mala')).status).toBe(401);
    expect((await intento(app, 'ANA@correo.test ', 'buena')).status).toBe(429);
    expect((await intento(app, 'otra@correo.test', 'buena')).status).toBe(200);
  });

  it('3c: 50 intentos fallidos por IP cada 15 minutos, sea cual sea el email', async () => {
    const app = appDeLogin();
    for (let i = 0; i < 50; i++) {
      expect((await intento(app, `persona${i}@correo.test`, 'mala')).status).toBe(401);
    }
    const bloqueado = await intento(app, 'nueva@correo.test', 'buena');
    expect(bloqueado.status).toBe(429);
    expect(bloqueado.body.error.code).toBe('TOO_MANY_REQUESTS');
  });

  it('3c: el 429 indica en Retry-After los segundos que faltan', async () => {
    const app = appDeLogin();
    for (let i = 0; i < 5; i++) await intento(app, 'ana@correo.test', 'mala');
    const bloqueado = await intento(app, 'ana@correo.test', 'buena');
    expect(bloqueado.status).toBe(429);
    const segundos = Number(bloqueado.headers['retry-after']);
    expect(segundos).toBeGreaterThan(0);
    expect(segundos).toBeLessThanOrEqual(15 * 60);
  });

  it('los intentos correctos no cuentan para el límite por IP', async () => {
    const app = appDeLogin();
    for (let i = 0; i < 60; i++) {
      expect((await intento(app, `persona${i}@correo.test`, 'buena')).status).toBe(200);
    }
  });
});
