import { describe, expect, it } from 'vitest';
import { markRead, markUnread } from '../../src/models/update-read.model.js';
import { usarBaseDeDatos } from '../helpers/db-fixture.js';

const db = usarBaseDeDatos();

const leida = async (userId: number, updateId: number) =>
  (await db.pool.query('SELECT 1 FROM update_reads WHERE user_id = $1 AND update_id = $2', [userId, updateId]))
    .rowCount === 1;

describe('update-read.model (CU-17)', () => {
  it('marca como leída una sola vez aunque se repita', async () => {
    await markRead(db.pool, 8, 6);
    await markRead(db.pool, 8, 6);
    expect(await leida(8, 6)).toBe(true);
  });

  it('marca como no leída, también si ya lo estaba', async () => {
    await markUnread(db.pool, 8, 6);
    await markUnread(db.pool, 8, 6);
    expect(await leida(8, 6)).toBe(false);
  });
});
