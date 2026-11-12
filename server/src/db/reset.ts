import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';

const ARCHIVOS = ['seedsql.sql', 'TEST_DATA.sql'] as const;

/**
 * Reinicia la base de datos: ejecuta `seedsql.sql` (estructura) y después
 * `TEST_DATA.sql` (datos de prueba) sin necesitar `psql` (TECH_SPEC §8.6).
 */
export async function resetDatabase(connectionString: string, databaseDir: string): Promise<void> {
  const scripts: string[] = [];
  for (const archivo of ARCHIVOS) {
    const ruta = join(databaseDir, archivo);
    try {
      scripts.push(await readFile(ruta, 'utf8'));
    } catch {
      throw new Error(`No se encuentra ${archivo} en ${ruta}`);
    }
  }

  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    // Cada archivo gestiona su propia transacción (BEGIN … COMMIT).
    for (const sql of scripts) {
      await client.query(sql);
    }
  } finally {
    await client.end();
  }
}
