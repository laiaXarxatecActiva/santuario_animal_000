import { afterAll, describe, expect, it } from 'vitest';
import { createPool } from '../../src/db/pool.js';
import { testDatabaseUrl } from '../helpers/test-db.js';

describe('createPool', () => {
  const pool = createPool(testDatabaseUrl());
  afterAll(() => pool.end());

  it('lee DATE como string YYYY-MM-DD y NUMERIC como string', async () => {
    const { rows } = await pool.query<{ fecha: unknown; importe: unknown }>(
      "SELECT DATE '2026-03-01' AS fecha, 12.50::numeric(10,2) AS importe",
    );
    expect(rows[0]).toEqual({ fecha: '2026-03-01', importe: '12.50' });
  });

  it('lee TIMESTAMPTZ como Date', async () => {
    const { rows } = await pool.query<{ momento: unknown }>("SELECT TIMESTAMPTZ '2026-03-01T10:00:00Z' AS momento");
    expect(rows[0]?.momento).toEqual(new Date('2026-03-01T10:00:00Z'));
  });
});
