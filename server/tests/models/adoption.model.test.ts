import { describe, expect, it } from 'vitest';
import { listPublicAdopterNames } from '../../src/models/adoption.model.js';
import { usarBaseDeDatos } from '../helpers/db-fixture.js';

const db = usarBaseDeDatos();

describe('RN-16 listPublicAdopterNames', () => {
  it('solo nombra a los adoptantes activos que lo han permitido', async () => {
    expect(await listPublicAdopterNames(db.pool, 8)).toEqual(['Lucía']);
  });

  it('una adopción pausada no cuenta', async () => {
    await db.pool.query("UPDATE adoptions SET status = 'paused' WHERE animal_id = 9 AND status = 'active'");
    expect(await listPublicAdopterNames(db.pool, 9)).toEqual([]);
  });

  it('si el adoptante desactiva la opción, deja de aparecer', async () => {
    await db.pool.query("UPDATE users SET show_public_name = FALSE WHERE email = 'lucia.martinez@correo.test'");
    expect(await listPublicAdopterNames(db.pool, 1)).toEqual([]);
  });
});
