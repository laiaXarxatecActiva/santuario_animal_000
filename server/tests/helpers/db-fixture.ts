import type { Pool } from 'pg';
import { afterAll, beforeAll } from 'vitest';
import { createPool } from '../../src/db/pool.js';
import { resetDatabase } from '../../src/db/reset.js';
import { databaseDir, testDatabaseUrl } from './test-db.js';

/** Reinicia la BD de pruebas antes del archivo y devuelve un pool para las pruebas de modelos. */
export function usarBaseDeDatos(): { readonly pool: Pool } {
  const ref: { pool: Pool } = { pool: createPool(testDatabaseUrl()) };
  beforeAll(() => resetDatabase(testDatabaseUrl(), databaseDir));
  afterAll(() => ref.pool.end());
  return ref;
}
