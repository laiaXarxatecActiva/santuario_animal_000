import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { createErrorHandler } from '../src/middlewares/error-handler.js';
import { validate, validated } from '../src/middlewares/validate.js';

const querySchema = z.object({ n: z.coerce.number().int().default(1) });
const paramsSchema = z.object({ id: z.coerce.number().int().positive() });
const bodySchema = z.object({ name: z.string().min(1), tags: z.array(z.string()) });

function app() {
  const a = express();
  a.use(express.json());
  a.get('/q', validate({ query: querySchema }), (_req, res) => {
    res.json(validated(res, 'query', querySchema));
  });
  a.post('/b/:id', validate({ params: paramsSchema, body: bodySchema }), (_req, res) => {
    res.json({ params: validated(res, 'params', paramsSchema), body: validated(res, 'body', bodySchema) });
  });
  a.use(createErrorHandler({ logError: () => {} }));
  return a;
}

describe('validate', () => {
  it('deja los datos convertidos y con valores por defecto para el controlador', async () => {
    expect((await request(app()).get('/q')).body).toEqual({ n: 1 });
    expect((await request(app()).get('/q?n=5')).body).toEqual({ n: 5 });
  });

  it('valida params y body a la vez', async () => {
    const res = await request(app()).post('/b/3').send({ name: 'Rufo', tags: [] });
    expect(res.body).toEqual({ params: { id: 3 }, body: { name: 'Rufo', tags: [] } });
  });

  it('responde 400 con un detalle por campo, incluidos los anidados', async () => {
    const res = await request(app())
      .post('/b/x')
      .send({ name: '', tags: [1] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d: { field: string }) => d.field)).toEqual(['id', 'name', 'tags.0']);
  });
});
