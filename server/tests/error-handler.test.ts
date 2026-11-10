import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { ConflictError } from '../src/errors/app-error.js';
import { createErrorHandler, notFoundHandler } from '../src/middlewares/error-handler.js';

function appQueLanza(error: unknown, logError = vi.fn()) {
  const app = express();
  app.use(express.json({ limit: '1kb' }));
  app.get('/boom', () => {
    throw error;
  });
  app.post('/eco', (req, res) => {
    res.json(req.body);
  });
  app.use(notFoundHandler);
  app.use(createErrorHandler({ logError }));
  return app;
}

describe('errorHandler', () => {
  it('traduce un AppError a su estado y al formato estándar', async () => {
    const res = await request(
      appQueLanza(new ConflictError('ADOPTION_ALREADY_OPEN', 'Ya tienes una adopción en curso.')),
    ).get('/boom');
    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: { code: 'ADOPTION_ALREADY_OPEN', message: 'Ya tienes una adopción en curso.', details: [] },
    });
  });

  it('un error inesperado da 500 sin detalles técnicos y se registra', async () => {
    const logError = vi.fn();
    const res = await request(appQueLanza(new Error('fallo interno de pg'), logError)).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toContain('pg');
    expect(logError).toHaveBeenCalledOnce();
  });

  it('una ruta inexistente da 404', async () => {
    const res = await request(appQueLanza(null)).get('/no-existe');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('un JSON mal formado da 400', async () => {
    const res = await request(appQueLanza(null)).post('/eco').set('Content-Type', 'application/json').send('{ roto');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it('un cuerpo demasiado grande da 413', async () => {
    const res = await request(appQueLanza(null))
      .post('/eco')
      .send({ texto: 'x'.repeat(2048) });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});
