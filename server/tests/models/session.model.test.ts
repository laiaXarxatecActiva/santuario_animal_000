import { describe, expect, it } from 'vitest';
import { deleteByUserId } from '../../src/models/session.model.js';
import { usarBaseDeDatos } from '../helpers/db-fixture.js';

const db = usarBaseDeDatos();

const sesion = (sid: string, sess: object) =>
  db.pool.query("INSERT INTO user_sessions (sid, sess, expire) VALUES ($1, $2, NOW() + INTERVAL '1 day')", [
    sid,
    JSON.stringify(sess),
  ]);

describe('session.model', () => {
  it('CU-10 borra todas las sesiones de un usuario y deja las demás', async () => {
    await sesion('a', { cookie: {}, userId: 7 });
    await sesion('b', { cookie: {}, userId: 7 });
    await sesion('c', { cookie: {}, userId: 6 });
    await sesion('d', { cookie: {} });
    await deleteByUserId(db.pool, 7);
    const { rows } = await db.pool.query('SELECT sid FROM user_sessions ORDER BY sid');
    expect(rows.map((r: { sid: string }) => r.sid)).toEqual(['c', 'd']);
  });
});
