import { afterAll, describe, expect, it } from 'vitest';
import { createPool } from '../../src/db/pool.js';
import { resetDatabase } from '../../src/db/reset.js';
import { databaseDir, testDatabaseUrl } from '../helpers/test-db.js';

describe('resetDatabase', () => {
  const pool = createPool(testDatabaseUrl());
  afterAll(() => pool.end());

  it('crea el esquema y carga los datos de prueba', async () => {
    await resetDatabase(testDatabaseUrl(), databaseDir);
    const { rows } = await pool.query<{ email: string; role: string }>(
      "SELECT email, role FROM users WHERE email = 'marta.soler@santuario.test'",
    );
    expect(rows).toEqual([{ email: 'marta.soler@santuario.test', role: 'admin' }]);
  });

  it('se puede ejecutar varias veces y deja siempre el mismo estado', async () => {
    await pool.query(
      'DELETE FROM species WHERE NOT EXISTS (SELECT 1 FROM animals WHERE animals.species_id = species.id)',
    );
    await resetDatabase(testDatabaseUrl(), databaseDir);
    const antes = await pool.query<{ total: string }>('SELECT count(*) AS total FROM users');
    await resetDatabase(testDatabaseUrl(), databaseDir);
    const despues = await pool.query<{ total: string }>('SELECT count(*) AS total FROM users');
    expect(despues.rows).toEqual(antes.rows);
  });

  it('falla con un mensaje claro si no encuentra los archivos SQL', async () => {
    await expect(resetDatabase(testDatabaseUrl(), '/no/existe')).rejects.toThrow(/seedsql\.sql/);
  });
});
