import type { SessionUser } from '@sanctuary/shared';
import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { requireAuth, requireRole, requireVerifiedEmail } from '../src/middlewares/auth.js';
import { createErrorHandler } from '../src/middlewares/error-handler.js';

const usuario = (datos: Partial<SessionUser> = {}): SessionUser => ({
  id: 1,
  firstName: 'Ana',
  lastName: 'Ferrer',
  email: 'ana@correo.test',
  role: 'adopter',
  emailVerified: true,
  ...datos,
});

/** App mínima en la que `loadUser` se sustituye por un usuario fijo. */
function app(user: SessionUser | undefined, ...middlewares: RequestHandler[]) {
  const a = express();
  a.use((req, _res, next) => {
    req.user = user;
    next();
  });
  a.get('/', ...middlewares, (_req, res) => {
    res.json({ ok: true });
  });
  a.use(createErrorHandler({ logError: () => {} }));
  return a;
}

describe('middlewares de autorización (TECH_SPEC §9.4)', () => {
  it('requireAuth: 401 sin usuario', async () => {
    const res = await request(app(undefined, requireAuth)).get('/');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect((await request(app(usuario(), requireAuth)).get('/')).status).toBe(200);
  });

  it('requireRole: 401 sin usuario y 403 si el rol no coincide', async () => {
    const soloTrabajadores = requireRole('caretaker', 'admin');
    expect((await request(app(undefined, soloTrabajadores)).get('/')).status).toBe(401);
    const res = await request(app(usuario(), soloTrabajadores)).get('/');
    expect(res.status).toBe(403);
    expect(res.body.error).toMatchObject({ code: 'FORBIDDEN', message: 'No tienes permiso para esta acción.' });
    expect((await request(app(usuario({ role: 'caretaker' }), soloTrabajadores)).get('/')).status).toBe(200);
  });

  it('requireVerifiedEmail: 403 con el email sin verificar (RN-21)', async () => {
    expect((await request(app(undefined, requireVerifiedEmail)).get('/')).status).toBe(401);
    const res = await request(app(usuario({ emailVerified: false }), requireVerifiedEmail)).get('/');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('EMAIL_NOT_VERIFIED');
    expect((await request(app(usuario(), requireVerifiedEmail)).get('/')).status).toBe(200);
  });
});
