import type { Pool, PoolClient } from 'pg';

/**
 * Ejecuta `fn` dentro de una transacción: COMMIT si termina bien y ROLLBACK
 * (relanzando el error) si falla. La conexión siempre se devuelve al pool.
 */
export async function withTransaction<T>(pool: Pool, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
