import express from 'express';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createSessionMiddleware, regenerateSession, sessionCookieName } from '../src/middlewares/session.js';
import { hashToken } from '../src/utils/tokens.js';
import { usarBaseDeDatos } from './helpers/db-fixture.js';

const db = usarBaseDeDatos();
const SECRETO = 'secreto-de-pruebas-de-al-menos-32-caracteres';

function app(secure: boolean) {
  const a = express();
  if (secure) a.set('trust proxy', 1);
  a.use(createSessionMiddleware({ pool: db.pool, secret: SECRETO, secure, prune: false }));
  a.post('/login', async (req, res) => {
    await regenerateSession(req);
    req.session.userId = 6;
    res.json({ sid: req.sessionID });
  });
  a.get('/me', (req, res) => {
    res.json({ userId: req.session.userId ?? null });
  });
  return a;
}

const cookieDe = (res: request.Response) => ([] as string[]).concat(res.headers['set-cookie'] ?? [])[0] ?? '';

afterAll(() => db.pool.query('DELETE FROM user_sessions'));

describe('sesiones (TECH_SPEC §9.1)', () => {
  it('en local la cookie se llama sid; en producción, __Host-sid', () => {
    expect(sessionCookieName(false)).toBe('sid');
    expect(sessionCookieName(true)).toBe('__Host-sid');
  });

  it('la cookie es HttpOnly, SameSite=Lax, Path=/, sin Domain y con caducidad', async () => {
    const cookie = cookieDe(await request(app(false)).post('/login'));
    expect(cookie).toMatch(/^sid=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).toMatch(/Expires=/);
    expect(cookie).not.toMatch(/Domain=/i);
    expect(cookie).not.toMatch(/Secure/);
  });

  it('en producción la cookie es __Host-sid y Secure', async () => {
    const res = await request(app(true)).post('/login').set('X-Forwarded-Proto', 'https');
    const cookie = cookieDe(res);
    expect(cookie).toMatch(/^__Host-sid=/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).not.toMatch(/Domain=/i);
  });

  it('en la base de datos solo está el hash del identificador de sesión', async () => {
    const res = await request(app(false)).post('/login');
    const sid: string = res.body.sid;
    const { rows } = await db.pool.query('SELECT sid_hash, user_id, sess::text AS sess FROM user_sessions');
    expect(rows).toContainEqual(expect.objectContaining({ sid_hash: hashToken(sid), user_id: 6 }));
    expect(JSON.stringify(rows)).not.toContain(sid);
  });

  it('la sesión se recupera con la cookie y deja de valer si se borra de la base de datos', async () => {
    const agent = request.agent(app(false));
    await agent.post('/login');
    expect((await agent.get('/me')).body).toEqual({ userId: 6 });
    await db.pool.query('DELETE FROM user_sessions');
    expect((await agent.get('/me')).body).toEqual({ userId: null });
  });

  it('la sesión caducada en el servidor no vale aunque el navegador conserve la cookie', async () => {
    const agent = request.agent(app(false));
    await agent.post('/login');
    await db.pool.query("UPDATE user_sessions SET expire = NOW() - INTERVAL '1 minute'");
    expect((await agent.get('/me')).body).toEqual({ userId: null });
  });

  it('una cookie con un identificador inventado no carga ninguna sesión', async () => {
    const res = await request(app(false)).get('/me').set('Cookie', 'sid=s%3Ainventado.firma-falsa');
    expect(res.body).toEqual({ userId: null });
  });
});
