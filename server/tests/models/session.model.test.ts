import { describe, expect, it } from 'vitest';
import {
  deleteByUserId,
  deleteExpired,
  deleteOthersByUserId,
  destroy,
  find,
  save,
  touch,
} from '../../src/models/session.model.js';
import { hashToken } from '../../src/utils/tokens.js';
import { usarBaseDeDatos } from '../helpers/db-fixture.js';

const db = usarBaseDeDatos();

const dentroDe = (horas: number) => new Date(Date.now() + horas * 3600_000);

const sesion = (sid: string, userId?: number, expire = dentroDe(24)) =>
  save(db.pool, sid, { cookie: {}, ...(userId === undefined ? {} : { userId }) }, expire);

const sidsGuardados = async () => {
  const { rows } = await db.pool.query<{ sid_hash: string }>('SELECT sid_hash FROM user_sessions ORDER BY sid_hash');
  return rows.map((r) => r.sid_hash);
};

describe('session.model', () => {
  it('guarda solo el SHA-256 del identificador, nunca el identificador', async () => {
    await sesion('identificador-secreto', 6);
    const { rows } = await db.pool.query('SELECT sid_hash, user_id FROM user_sessions');
    expect(rows).toEqual([{ sid_hash: hashToken('identificador-secreto'), user_id: 6 }]);
    expect(JSON.stringify(rows)).not.toContain('identificador-secreto');
    await destroy(db.pool, 'identificador-secreto');
  });

  it('lee una sesión vigente por su identificador', async () => {
    await sesion('vigente', 7);
    expect(await find(db.pool, 'vigente')).toEqual({ cookie: {}, userId: 7 });
    expect(await find(db.pool, 'no-existe')).toBeNull();
    await destroy(db.pool, 'vigente');
  });

  it('una sesión caducada no se devuelve, aunque siga en la tabla', async () => {
    await sesion('caducada', 7, dentroDe(-1));
    expect(await find(db.pool, 'caducada')).toBeNull();
    await destroy(db.pool, 'caducada');
  });

  it('guardar otra vez el mismo identificador sustituye la sesión', async () => {
    await sesion('repetida');
    await sesion('repetida', 8);
    expect(await find(db.pool, 'repetida')).toEqual({ cookie: {}, userId: 8 });
    await destroy(db.pool, 'repetida');
  });

  it('touch alarga la caducidad', async () => {
    await sesion('alargar', 7, dentroDe(-1));
    await touch(db.pool, 'alargar', dentroDe(1));
    expect(await find(db.pool, 'alargar')).not.toBeNull();
    await destroy(db.pool, 'alargar');
  });

  it('deleteExpired borra solo las caducadas', async () => {
    await sesion('vieja', 7, dentroDe(-1));
    await sesion('nueva', 7);
    expect(await deleteExpired(db.pool)).toBe(1);
    expect(await sidsGuardados()).toEqual([hashToken('nueva')]);
    await destroy(db.pool, 'nueva');
  });

  it('CU-10 borra todas las sesiones de un usuario y deja las demás', async () => {
    await sesion('a', 7);
    await sesion('b', 7);
    await sesion('c', 6);
    await sesion('d');
    await deleteByUserId(db.pool, 7);
    expect(await sidsGuardados()).toEqual([hashToken('c'), hashToken('d')].sort());
    await deleteByUserId(db.pool, 6);
    await destroy(db.pool, 'd');
  });

  it('CU-24 borra las demás sesiones del usuario y mantiene la actual', async () => {
    await sesion('e', 9);
    await sesion('f', 9);
    await sesion('g', 9);
    await deleteOthersByUserId(db.pool, 9, 'f');
    expect(await sidsGuardados()).toEqual([hashToken('f')]);
  });

  it('borrar al usuario borra sus sesiones', async () => {
    await db.pool.query('DELETE FROM user_sessions');
    const { rows } = await db.pool.query<{ id: number }>(
      `INSERT INTO users (first_name, last_name, email, password_hash, role, privacy_accepted_at)
       VALUES ('Temporal', 'Borrable', 'temporal@correo.test', 'x', 'adopter', NOW()) RETURNING id`,
    );
    const id = rows[0]?.id ?? 0;
    await sesion('h', id);
    await db.pool.query('DELETE FROM users WHERE id = $1', [id]);
    expect(await sidsGuardados()).toEqual([]);
  });
});
