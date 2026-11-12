import { describe, expect, it } from 'vitest';
import { create, findByHash, invalidateUnused, markUsed } from '../../src/models/user-token.model.js';
import { usarBaseDeDatos } from '../helpers/db-fixture.js';

const db = usarBaseDeDatos();
const caduca = new Date('2026-11-13T10:00:00Z');
const ahora = new Date('2026-11-12T10:00:00Z');

describe('user-token.model', () => {
  it('crea un token y lo encuentra por su hash', async () => {
    await create(db.pool, { userId: 13, type: 'email_verification', tokenHash: 'h1', expiresAt: caduca });
    expect(await findByHash(db.pool, 'h1')).toEqual({
      id: expect.any(Number),
      userId: 13,
      type: 'email_verification',
      expiresAt: caduca,
      usedAt: null,
    });
    expect(await findByHash(db.pool, 'no-existe')).toBeNull();
  });

  it('marca un token como usado una sola vez', async () => {
    const token = await findByHash(db.pool, 'h1');
    expect(await markUsed(db.pool, token!.id, ahora)).toBe(true);
    expect(await markUsed(db.pool, token!.id, ahora)).toBe(false);
    expect((await findByHash(db.pool, 'h1'))?.usedAt).toEqual(ahora);
  });

  it('invalida solo los tokens sin usar del usuario y del tipo indicados', async () => {
    await create(db.pool, { userId: 13, type: 'email_verification', tokenHash: 'h2', expiresAt: caduca });
    await create(db.pool, { userId: 13, type: 'password_reset', tokenHash: 'h3', expiresAt: caduca });
    await create(db.pool, { userId: 6, type: 'email_verification', tokenHash: 'h4', expiresAt: caduca });
    await invalidateUnused(db.pool, 13, 'email_verification', ahora);
    expect((await findByHash(db.pool, 'h2'))?.usedAt).toEqual(ahora);
    expect((await findByHash(db.pool, 'h3'))?.usedAt).toBeNull();
    expect((await findByHash(db.pool, 'h4'))?.usedAt).toBeNull();
  });
});
