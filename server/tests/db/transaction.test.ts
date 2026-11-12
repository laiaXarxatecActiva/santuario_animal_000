import type { Pool, PoolClient } from 'pg';
import { describe, expect, it } from 'vitest';
import { withTransaction } from '../../src/db/transaction.js';

// Pool falso que registra las sentencias de control de la transacción.
function fakePool() {
  const queries: string[] = [];
  let released = 0;
  const client = {
    query: async (sql: string) => {
      queries.push(sql);
      return { rows: [] };
    },
    release: () => {
      released += 1;
    },
  } as unknown as PoolClient;
  const pool = { connect: async () => client } as unknown as Pool;
  return { pool, client, queries, released: () => released };
}

describe('withTransaction', () => {
  it('hace COMMIT y devuelve el resultado si todo va bien', async () => {
    const { pool, queries, released } = fakePool();
    const result = await withTransaction(pool, async (client) => {
      await client.query('SELECT 1');
      return 42;
    });
    expect(result).toBe(42);
    expect(queries).toEqual(['BEGIN', 'SELECT 1', 'COMMIT']);
    expect(released()).toBe(1);
  });

  it('hace ROLLBACK y relanza el error si algo falla', async () => {
    const { pool, queries, released } = fakePool();
    const fallo = new Error('fallo');
    await expect(
      withTransaction(pool, async () => {
        throw fallo;
      }),
    ).rejects.toBe(fallo);
    expect(queries).toEqual(['BEGIN', 'ROLLBACK']);
    expect(released()).toBe(1);
  });
});
